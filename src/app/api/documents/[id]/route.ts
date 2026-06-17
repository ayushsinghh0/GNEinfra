import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { readDocument } from "@/lib/documents";

// Days after the FIRST download before the file is purged from storage.
// Validated so a misconfigured (non-numeric / <=0) env value can't silently
// disable purging or stamp an Invalid Date.
function purgeDays() {
  const n = Number(process.env.DOC_PURGE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

// GET /api/documents/<id>            → view the file inline (no side effects)
// GET /api/documents/<id>?download=1 → force a file download; this counts as a
//   download and, on the FIRST one, starts the purge countdown so storage cost
//   stays low. Simply viewing a file never triggers deletion.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const isDownload = req.nextUrl.searchParams.get("download") === "1";

  const doc = await prisma.vendorDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.purgedAt) {
    return NextResponse.json(
      {
        error:
          "This file was automatically deleted after its retention window to save storage cost.",
      },
      { status: 410 }
    );
  }

  let data: Buffer;
  try {
    data = await readDocument(doc);
  } catch (err) {
    // Distinguish "file is gone" (404) from a real storage/decompress failure (502).
    const code = (err as { code?: string })?.code;
    if (code === "ENOENT" || code === "NoSuchKey") {
      return NextResponse.json({ error: "File no longer in storage" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not read the file" }, { status: 502 });
  }

  // Only an actual download records a download / starts the purge countdown.
  // A counter-write failure must NOT fail the download itself.
  if (isDownload) {
    const now = new Date();
    try {
      // Counter increment is unconditionally atomic.
      await prisma.vendorDocument.update({
        where: { id: doc.id },
        data: { downloadCount: { increment: 1 } },
      });
      // Stamp first-download fields exactly once, at the DB level (race-safe):
      // updateMany only matches while firstDownloadedAt is still null.
      await prisma.vendorDocument.updateMany({
        where: { id: doc.id, firstDownloadedAt: null },
        data: {
          firstDownloadedAt: now,
          purgeAfter: new Date(now.getTime() + purgeDays() * 86400_000),
        },
      });
    } catch (e) {
      console.error("[documents] failed to record download", doc.id, e);
    }
  }

  // Build a Content-Disposition that can never break the header: an ASCII-only
  // quoted filename (control chars / quotes / non-ASCII removed) plus an RFC 6266
  // filename* with the full UTF-8 name percent-encoded.
  const baseName = (doc.originalName || "document").replace(/[\r\n"\\]/g, "");
  const asciiName = baseName.replace(/[^\x20-\x7e]/g, "_").slice(0, 200) || "document";
  const disposition = isDownload ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        baseName
      )}`,
    },
  });
}
