import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildBoqWorkbook } from "@/lib/boq-excel";

// GET /api/projects/[id]/boq/template — download a blank BOQ import template
// (correct headers + a reference sheet of the standard sections).
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

  const buf = await buildBoqWorkbook({ gneId: project.gneId, template: true });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BOQ-template-${project.gneId}.xlsx"`,
    },
  });
}
