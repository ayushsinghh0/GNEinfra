import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveDocument, deleteDocument } from "@/lib/documents";

// Reject obviously huge bodies up front (saveDocument also enforces 10 MB/file).
const MAX_REQUEST_BYTES = 15 * 1024 * 1024;

// POST /api/reupload   (public; protected by the single-use token)
// multipart/form-data: token + a single `file`. Saves the new file, deletes the
// old corrupt one, and marks the request USED.
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
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const reqRow = await prisma.documentRequest.findUnique({ where: { token } });
  if (!reqRow) {
    return NextResponse.json({ error: "Invalid upload link" }, { status: 404 });
  }
  if (reqRow.status === "USED") {
    return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  }
  if (reqRow.status === "REVOKED") {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 403 });
  }
  if (reqRow.expiresAt && reqRow.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  // Claim the request first (race-safe single-use): only the request that flips
  // PENDING->USED proceeds; a concurrent double-submit matches 0 rows and stops
  // before storing a duplicate file.
  const claimed = await prisma.documentRequest.updateMany({
    where: { id: reqRow.id, status: "PENDING" },
    data: { status: "USED", fulfilledAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  }

  // Store the new file (enforces type + 10 MB). On failure, release the claim so
  // the vendor can retry with the same link.
  let saved;
  try {
    saved = await saveDocument(reqRow.vendorId, file);
  } catch (e) {
    await prisma.documentRequest.updateMany({
      where: { id: reqRow.id, status: "USED" },
      data: { status: "PENDING", fulfilledAt: null },
    });
    const msg = e instanceof Error ? e.message : "Could not store the file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    await prisma.vendorDocument.create({
      data: {
        vendorId: reqRow.vendorId,
        docType: reqRow.docType,
        originalName: saved.originalName,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        originalSize: saved.originalSize,
        storedSize: saved.storedSize,
        compressed: saved.compressed,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  }

  // Replace: delete the old corrupt document (storage object + row). Best-effort —
  // the file may already be purged; never fail the upload over the cleanup.
  if (reqRow.documentId) {
    try {
      const old = await prisma.vendorDocument.findUnique({ where: { id: reqRow.documentId } });
      if (old) {
        try {
          await deleteDocument(old.storageKey);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code !== "ENOENT" && code !== "NoSuchKey") {
            console.error("[reupload] old file delete failed", old.storageKey, err);
          }
        }
        await prisma.vendorDocument.delete({ where: { id: old.id } });
      }
    } catch (err) {
      console.error("[reupload] old document cleanup failed", reqRow.documentId, err);
    }
  }

  return NextResponse.json({ ok: true });
}
