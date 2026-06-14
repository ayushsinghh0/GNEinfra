import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildBoqWorkbook } from "@/lib/boq-excel";

// GET /api/projects/[id]/boq/export — download the project's BOQ as .xlsx
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
    include: { boqItems: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildBoqWorkbook({
    gneId: project.gneId,
    items: project.boqItems.map((b) => ({
      category: b.category,
      section: b.section,
      serialNo: b.serialNo,
      description: b.description,
      rating: b.rating,
      specification: b.specification,
      uom: b.uom,
      quantity: b.quantity,
      unitRate: b.unitRate,
      responsibility: b.responsibility,
    })),
  });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BOQ-${project.gneId}.xlsx"`,
    },
  });
}
