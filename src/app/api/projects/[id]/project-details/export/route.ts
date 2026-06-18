import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildProjectDetailsWorkbook } from "@/lib/workbook";

// GET /api/projects/[id]/project-details/export — download the project's
// "Project Details" row as a source-shaped .xlsx (one project per sheet row).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildProjectDetailsWorkbook([
    {
      gneId: project.gneId,
      clientName: project.clientName,
      tenderId: project.tenderId,
      state: project.state,
      cluster: project.cluster,
      plantName: project.plantName,
      capacityAcMw: project.capacityAcMw,
      capacityDcMw: project.capacityDcMw,
      epcScope: project.epcScope,
      poNumber: project.poNumber,
      poValueCr: project.poValueCr,
      subPartner: project.subPartner,
      startDate: project.startDate,
      liveDate: project.liveDate,
      completeDate: project.completeDate,
      handoverDate: project.handoverDate,
      plantAddress: project.plantAddress,
      clientAddress: project.clientAddress,
    },
  ]);

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ProjectDetails-${project.gneId}.xlsx"`,
    },
  });
}
