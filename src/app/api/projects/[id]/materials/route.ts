import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { materialSchema, toDate } from "@/lib/project-schemas";

// POST /api/projects/[id]/materials  (admin only)
// Adds a procurement / material-receipt item (PO & MRC) to a project.
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
    const parsed = materialSchema.safeParse(body);
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

    await prisma.procurementItem.create({
      data: {
        projectId: id,
        description: d.description,
        type: d.type,
        partner: d.partner,
        uom: d.uom,
        approvedQty: d.approvedQty,
        receivedQty: d.receivedQty,
        receivedDate: toDate(d.receivedDate),
        drawingApproved: d.drawingApproved,
        poReleased: d.poReleased,
        qualitySignoff: d.qualitySignoff,
        mrcStatus: d.mrcStatus,
        remarks: d.remarks,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not add the material item." },
      { status: 500 }
    );
  }
}
