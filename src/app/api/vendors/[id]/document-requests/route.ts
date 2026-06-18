import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { newDocumentRequestToken } from "@/lib/tokens";
import { sendMail, documentReuploadEmail } from "@/lib/mailer";
import { docLabel } from "@/lib/doc-labels";

// POST /api/vendors/<id>/document-requests   (admin only)
// Body: { documentId }. Emails the vendor a single-use link to re-upload that
// specific document. Revokes any earlier pending request for the same document
// so only one live link exists.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: vendorId } = await params;
  const body = await req.json().catch(() => null);
  const documentId = body && typeof body.documentId === "string" ? body.documentId : "";
  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  // The document must exist AND belong to this vendor.
  const doc = await prisma.vendorDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.vendorId !== vendorId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { email: true, companyName: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const token = newDocumentRequestToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  try {
    // Only one live link per document.
    await prisma.$transaction([
      prisma.documentRequest.updateMany({
        where: { documentId, status: "PENDING" },
        data: { status: "REVOKED" },
      }),
      prisma.documentRequest.create({
        data: { token, vendorId, documentId, docType: doc.docType, expiresAt },
      }),
    ]);
  } catch {
    return NextResponse.json({ error: "Could not create the request." }, { status: 500 });
  }

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const link = `${base}/reupload/${token}`;
  const tpl = documentReuploadEmail(link, vendor.companyName, docLabel(doc.docType));

  // Always return the link so the admin can copy + share it (e.g. on WhatsApp),
  // regardless of whether the email went through.
  try {
    await sendMail({ to: vendor.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (err) {
    console.error("[document-requests] email send failed", err);
    return NextResponse.json({
      ok: true,
      emailed: false,
      link,
      warning: "Request created but the email could not be sent. Share the link manually.",
    });
  }

  return NextResponse.json({ ok: true, emailed: true, link });
}
