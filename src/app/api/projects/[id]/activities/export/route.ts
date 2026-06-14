import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildActivitiesWorkbook } from "@/lib/activities-excel";

// GET /api/projects/[id]/activities/export — download the project's execution
// activities as .xlsx (with cumulative done + completion %).
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
        include: { entries: true },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildActivitiesWorkbook({
    gneId: project.gneId,
    items: project.activities.map((a) => ({
      activity: a.activity,
      subActivity: a.subActivity,
      uom: a.uom,
      totalQty: a.totalQty,
      cumulative: a.entries.reduce((s, e) => s + e.qtyDone, 0),
    })),
  });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Activities-${project.gneId}.xlsx"`,
    },
  });
}
