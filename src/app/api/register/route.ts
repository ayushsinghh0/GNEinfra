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

// Thrown inside the registration transaction when another request already
// consumed this invite (the conditional PENDING->USED update matched 0 rows).
class InviteAlreadyUsedError extends Error {}

// Abuse caps for this public endpoint.
const MAX_REQUEST_BYTES = 60 * 1024 * 1024; // reject obviously huge bodies up front
const MAX_DOC_FILES = 12; // total document files per submission
const MAX_DOC_BYTES_TOTAL = 50 * 1024 * 1024; // aggregate document bytes
const MAX_SERVICES_JSON = 64 * 1024; // raw `services` JSON string length

// POST /api/register  (public, requires a valid invite token)
// Accepts multipart/form-data: text fields + `services` JSON + document files.
export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Upload too large." }, { status: 413 });
  }

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
    if (typeof value === "string" && key !== "services" && key !== "token") {
      raw[key] = value;
    }
  }

  // Services arrive as a JSON string.
  let services: unknown = [];
  const servicesRaw = form.get("services");
  if (typeof servicesRaw === "string" && servicesRaw.trim()) {
    if (servicesRaw.length > MAX_SERVICES_JSON) {
      return NextResponse.json({ error: "Too much service data." }, { status: 413 });
    }
    try {
      services = JSON.parse(servicesRaw);
    } catch {
      return NextResponse.json({ error: "Malformed services data" }, { status: 400 });
    }
  }
  raw.services = services;

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    // Return every issue (field + message) so the client can route each error
    // to the right wizard step. The client validates first, so this is a backstop.
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return NextResponse.json(
      {
        error: issues[0]?.message ?? "Invalid input",
        field: issues[0]?.field,
        issues,
      },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Drop service rows that have no category.
  const cleanServices = (d.services ?? []).filter((s) => s.category && s.category.trim());

  const doi = d.dateOfIncorporation ? new Date(d.dateOfIncorporation) : null;

  // Cap document count + aggregate size BEFORE consuming the invite or doing any
  // CPU-heavy compression, so a single valid token can't be used to DoS the server.
  let docCount = 0;
  let docBytes = 0;
  for (const field of Object.keys(DOC_FIELDS)) {
    for (const f of form.getAll(field)) {
      if (f instanceof File && f.size > 0) {
        docCount++;
        docBytes += f.size;
      }
    }
  }
  if (docCount > MAX_DOC_FILES || docBytes > MAX_DOC_BYTES_TOTAL) {
    return NextResponse.json(
      { error: "Too many or too large documents. Please reduce the files and try again." },
      { status: 413 }
    );
  }

  // Create the vendor and consume the invite in ONE transaction so the outcome
  // is all-or-nothing: either a vendor exists and the invite is USED + linked to
  // it, or neither happened. This closes two holes a two-step approach has —
  //  (a) a crash between consuming and creating that would burn the link with no
  //      vendor saved, and
  //  (b) an orphaned invite whose vendorId link failed to set.
  // The conditional `status: PENDING` update also blocks the concurrent
  // double-submit race: only the request that flips PENDING->USED commits; any
  // loser matches 0 rows, throws, and the whole transaction (vendor included)
  // rolls back.
  let vendor: { id: string } | null = null;
  try {
    vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          status: "SUBMITTED",
          companyName: d.companyName,
          contactPerson: d.contactPerson,
          mobileNumber: d.mobileNumber,
          email: d.email,
          address: d.address,
          state: d.state,
          country: d.country,
          pinCode: d.pinCode,
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
          services: {
            create: cleanServices.map((s) => ({
              category: s.category.trim(),
              item: s.item,
            })),
          },
        },
      });
      const consumed = await tx.vendorInvite.updateMany({
        where: { id: invite.id, status: "PENDING" },
        data: { status: "USED", usedAt: new Date(), vendorId: created.id },
      });
      if (consumed.count === 0) throw new InviteAlreadyUsedError();
      return created;
    });
  } catch (e) {
    if (e instanceof InviteAlreadyUsedError) {
      return NextResponse.json(
        { error: "This registration link has already been used." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not save your registration. Please try again." },
      { status: 500 }
    );
  }
  if (!vendor) {
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

  // Fire off notification emails WITHOUT awaiting: holding the response open on
  // SMTP (1–3s to Gmail) would throttle throughput under load. The Node server is
  // long-running (pm2), so these finish in the background; failures are non-fatal
  // and already swallowed by allSettled.
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const notify = process.env.PROCUREMENT_NOTIFY_EMAIL;
  void Promise.allSettled([
    (async () => {
      const tpl = vendorConfirmationEmail(d.companyName);
      await sendMail({ to: d.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    })(),
    (async () => {
      if (!notify) return;
      const tpl = adminNotificationEmail({
        company: d.companyName,
        email: d.email,
        gstNo: d.gstNo ?? "—",
        panNo: d.panNo ?? "—",
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
