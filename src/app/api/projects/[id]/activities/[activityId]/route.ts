import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { activitySchema, toDate } from "@/lib/project-schemas";

async function owned(id: string, activityId: string) {
  const a = await prisma.projectActivity.findUnique({ where: { id: activityId }, select: { projectId: true } });
  return !!a && a.projectId === id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, activityId } = await params;
  if (!(await owned(id, activityId))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.projectActivity.update({
    where: { id: activityId },
    data: {
      activity: d.activity, subActivity: d.subActivity, uom: d.uom, totalQty: d.totalQty,
      startDate: toDate(d.startDate), endDate: toDate(d.endDate),
      activitySerial: d.activitySerial, sortOrder: d.sortOrder ?? 0, remarks: d.remarks,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, activityId } = await params;
  if (!(await owned(id, activityId))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  await prisma.projectActivity.delete({ where: { id: activityId } }); // DprEntry cascades
  return NextResponse.json({ ok: true });
}
