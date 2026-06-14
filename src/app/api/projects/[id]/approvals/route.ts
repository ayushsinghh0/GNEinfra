import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { approvalSchema, toDate } from "@/lib/project-schemas";

// POST /api/projects/[id]/approvals  (admin only)
// Records an approved-material delivery per parcel/block.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => null);
    const parsed = approvalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.materialApproval.create({
      data: {
        projectId: id,
        parcel: d.parcel,
        block: d.block,
        item: d.item,
        equipment: d.equipment,
        capacityUom: d.capacityUom,
        uom: d.uom,
        requiredQty: d.requiredQty,
        receivedQty: d.receivedQty,
        receivedAt: toDate(d.receivedAt),
        note: d.note,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not record the approval." },
      { status: 500 }
    );
  }
}
