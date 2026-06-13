import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { readDocument } from "@/lib/documents";

// Days after the FIRST download before the file is purged from storage.
function purgeDays() {
  return Number(process.env.DOC_PURGE_DAYS || 7);
}

// GET /api/documents/<id>  (admin only) — streams an uploaded vendor document.
// On the first download we start the purge countdown so storage cost stays low.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
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

  // Record the download and (on the first one) start the purge countdown.
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

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
    },
  });
}
