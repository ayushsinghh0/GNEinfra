import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildMaterialsWorkbook } from "@/lib/materials-excel";

// GET /api/projects/[id]/materials/export — download the project's materials as .xlsx
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { materials: { orderBy: { createdAt: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildMaterialsWorkbook({
    gneId: project.gneId,
    items: project.materials.map((m) => ({
      partner: m.partner,
      type: m.type,
      description: m.description,
      uom: m.uom,
      approvedQty: m.approvedQty,
      receivedQty: m.receivedQty,
      receivedDate: m.receivedDate,
      drawingApproved: m.drawingApproved,
      poReleased: m.poReleased,
      qualitySignoff: m.qualitySignoff,
      mrcStatus: m.mrcStatus,
      paymentStatus: m.paymentStatus,
      remarks: m.remarks,
    })),
  });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Materials-${project.gneId}.xlsx"`,
    },
  });
}
