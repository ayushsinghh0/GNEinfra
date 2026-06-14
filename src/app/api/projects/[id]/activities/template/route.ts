import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildActivitiesWorkbook } from "@/lib/activities-excel";

// GET /api/projects/[id]/activities/template — download a blank activities import
// template (correct headers + an example row).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { gneId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildActivitiesWorkbook({ gneId: project.gneId, template: true });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Activities-template-${project.gneId}.xlsx"`,
    },
  });
}
