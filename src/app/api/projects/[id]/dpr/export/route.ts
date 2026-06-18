import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildDprWorkbook } from "@/lib/workbook";

// GET /api/projects/[id]/dpr/export — download the project's "Activity DPR" sheet
// (one row per activity, with the union of all DprEntry dates as day-columns).
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
    include: {
      activities: {
        orderBy: { id: "asc" },
        include: { entries: { orderBy: { date: "asc" } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildDprWorkbook({
    gneId: project.gneId,
    plantName: project.plantName,
    capacityAcMw: project.capacityAcMw,
    subPartner: project.subPartner,
    activities: project.activities.map((a) => ({
      activitySerial: a.activitySerial,
      activity: a.activity,
      subActivity: a.subActivity,
      uom: a.uom,
      totalQty: a.totalQty,
      startDate: a.startDate,
      endDate: a.endDate,
      entries: a.entries.map((e) => ({
        date: e.date,
        qtyDone: e.qtyDone,
        kind: e.kind,
      })),
    })),
  });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="DPR-${project.gneId}.xlsx"`,
    },
  });
}
