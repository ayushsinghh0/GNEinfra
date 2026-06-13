import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { readDocument } from "@/lib/documents";

// Days after the FIRST download before the file is purged from storage.
function purgeDays() {
  return Number(process.env.DOC_PURGE_DAYS || 7);
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
        error: `This file was automatically deleted ${purgeDays()} days after it was first downloaded, to save storage cost.`,
      },
      { status: 410 }
    );
  }

  let data: Buffer;
  try {
    data = await readDocument(doc);
  } catch {
    return NextResponse.json({ error: "File missing in storage" }, { status: 404 });
  }

  // Only an actual download records a download / starts the purge countdown.
  if (isDownload) {
    const now = new Date();
    await prisma.vendorDocument.update({
      where: { id: doc.id },
      data: {
        downloadCount: { increment: 1 },
        ...(doc.firstDownloadedAt
          ? {}
          : {
              firstDownloadedAt: now,
              purgeAfter: new Date(now.getTime() + purgeDays() * 86400_000),
            }),
      },
    });
  }

  const disposition = isDownload ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${doc.originalName.replace(/"/g, "")}"`,
    },
  });
}
