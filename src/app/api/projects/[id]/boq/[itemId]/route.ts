import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// PATCH /api/projects/[id]/boq/[itemId]  (admin only)
// Assigns or clears the vendor on a single BOQ line item.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;

  try {
    const body = await req.json().catch(() => null);
    const raw = (body as { vendorId?: string | null } | null)?.vendorId;
    // Normalize empty string / undefined to null (clears the assignment).
    const vendorId = raw || null;

    const result = await prisma.boqItem.updateMany({
      where: { id: itemId, projectId: id },
      data: { vendorId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "BOQ item not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not update the BOQ item vendor." },
      { status: 500 }
    );
  }
}
