import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrationSchema } from "@/lib/validation";
import { saveDocument } from "@/lib/documents";
import {
  sendMail,
  vendorConfirmationEmail,
  adminNotificationEmail,
} from "@/lib/mailer";

// Document form-field name -> stored docType.
const DOC_FIELDS: Record<string, string> = {
  cancelledCheque: "CANCELLED_CHEQUE",
  gstCertificate: "GST_CERTIFICATE",
  panCard: "PAN_CARD",
  otherDocs: "OTHER",
};

// POST /api/register  (public, requires a valid invite token)
// Accepts multipart/form-data: text fields + `projects` JSON + document files.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected form data" }, { status: 400 });
  }

  const token = String(form.get("token") || "");
  if (!token) {
    return NextResponse.json({ error: "Missing registration token" }, { status: 400 });
  }

  const invite = await prisma.vendorInvite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invalid registration link" }, { status: 404 });
  }
  if (invite.status === "USED") {
    return NextResponse.json(
      { error: "This registration link has already been used." },
      { status: 409 }
    );
  }
  if (invite.status === "REVOKED") {
    return NextResponse.json({ error: "This link has been revoked." }, { status: 403 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This registration link has expired." }, { status: 410 });
  }

  // Collect scalar fields.
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && key !== "projects" && key !== "token") {
      raw[key] = value;
    }
  }

  // Projects arrive as a JSON string.
  let projects: unknown = [];
  const projectsRaw = form.get("projects");
  if (typeof projectsRaw === "string" && projectsRaw.trim()) {
    try {
      projects = JSON.parse(projectsRaw);
    } catch {
      return NextResponse.json({ error: "Malformed projects data" }, { status: 400 });
    }
  }
  raw.projects = projects;

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid input",
        field: parsed.error.issues[0]?.path?.join("."),
      },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Drop fully-empty project rows.
  const cleanProjects = (d.projects ?? []).filter((p) =>
    Object.entries(p).some(([k, v]) => k !== "serialNo" && v)
  );

  const doi = d.dateOfIncorporation ? new Date(d.dateOfIncorporation) : null;

  // Atomically consume the invite first — prevents a double-submit or a race
  // between two concurrent requests from creating two vendors for one invite.
  // Only the request that flips PENDING -> USED proceeds.
  const consumed = await prisma.vendorInvite.updateMany({
    where: { id: invite.id, status: "PENDING" },
    data: { status: "USED", usedAt: new Date() },
  });
  if (consumed.count === 0) {
    return NextResponse.json(
      { error: "This registration link has already been used." },
      { status: 409 }
    );
  }

  // Create the vendor + its projects atomically (Prisma nested create).
  const vendor = await prisma.vendor.create({
    data: {
      status: "SUBMITTED",
      companyName: d.companyName,
      contactPerson: d.contactPerson,
      mobileNumber: d.mobileNumber,
      email: d.email,
      address: d.address,
      state: d.state,
      website: d.website,
      dateOfIncorporation: doi && !isNaN(doi.getTime()) ? doi : null,
      yearsOfService: d.yearsOfService,
      annualTurnover: d.annualTurnover,
      gstNo: d.gstNo,
      panNo: d.panNo,
      exciseNo: d.exciseNo,
      tinNo: d.tinNo,
      vatLstNo: d.vatLstNo,
      cstNo: d.cstNo,
      serviceTaxNo: d.serviceTaxNo,
      msmeNo: d.msmeNo,
      bankName: d.bankName,
      bankBranchAddress: d.bankBranchAddress,
      bankAccountNo: d.bankAccountNo,
      bankBranchCode: d.bankBranchCode,
      ifscCode: d.ifscCode,
      swiftCode: d.swiftCode,
      ibanCode: d.ibanCode,
      projects: {
        create: cleanProjects.map((p) => ({
          serialNo: p.serialNo,
          clientName: p.clientName,
          capacity: p.capacity,
          projectType: p.projectType,
          contractType: p.contractType,
          location: p.location,
          yearOfCompletion: p.yearOfCompletion,
          scopeOfWork: p.scopeOfWork,
          percentCompleted: p.percentCompleted,
          remarks: p.remarks,
        })),
      },
    },
  }).catch(() => null);
  if (!vendor) {
    // Roll the invite back so the vendor can retry with the same link.
    await prisma.vendorInvite
      .updateMany({
        where: { id: invite.id, status: "USED", vendorId: null },
        data: { status: "PENDING", usedAt: null },
      })
      .catch(() => {});
    return NextResponse.json(
      { error: "Could not save your registration. Please try again." },
      { status: 500 }
    );
  }

  // Save uploaded documents (best-effort; collect any that fail).
  const docErrors: string[] = [];
  for (const [field, docType] of Object.entries(DOC_FIELDS)) {
    const files = form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      try {
        const saved = await saveDocument(vendor.id, file);
        await prisma.vendorDocument.create({
          data: {
            vendorId: vendor.id,
            docType,
            originalName: saved.originalName,
            storageKey: saved.storageKey,
            mimeType: saved.mimeType,
            originalSize: saved.originalSize,
            storedSize: saved.storedSize,
            compressed: saved.compressed,
          },
        });
      } catch (e) {
        docErrors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  // Link the (already consumed) invite to the created vendor.
  await prisma.vendorInvite
    .update({ where: { id: invite.id }, data: { vendorId: vendor.id } })
    .catch(() => {});

  // Fire off notification emails (failures shouldn't fail the registration).
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const notify = process.env.PROCUREMENT_NOTIFY_EMAIL;
  await Promise.allSettled([
    (async () => {
      const tpl = vendorConfirmationEmail(d.companyName);
      await sendMail({ to: d.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    })(),
    (async () => {
      if (!notify) return;
      const tpl = adminNotificationEmail({
        company: d.companyName,
        email: d.email,
        gstNo: d.gstNo,
        panNo: d.panNo,
        adminLink: `${base}/admin/vendors/${vendor.id}`,
      });
      await sendMail({
        to: notify.split(",").map((s) => s.trim()),
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    })(),
  ]);

  return NextResponse.json({
    ok: true,
    vendorId: vendor.id,
    docWarnings: docErrors.length ? docErrors : undefined,
  });
}
