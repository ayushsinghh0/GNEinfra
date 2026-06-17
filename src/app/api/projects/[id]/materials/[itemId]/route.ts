import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { materialSchema, toDate } from "@/lib/project-schemas";

async function owned(id: string, itemId: string) {
  const m = await prisma.procurementItem.findUnique({ where: { id: itemId }, select: { projectId: true } });
  return !!m && m.projectId === id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  if (!(await owned(id, itemId))) return NextResponse.json({ error: "Material not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = materialSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.procurementItem.update({
    where: { id: itemId },
    data: {
      description: d.description, type: d.type, partner: d.partner, uom: d.uom,
      approvedQty: d.approvedQty, receivedQty: d.receivedQty,
      receivedDate: toDate(d.receivedDate), deliveryDate: toDate(d.deliveryDate),
      mdcc: d.mdcc, signoffBel: d.signoffBel, mahagenco: d.mahagenco,
      drawingApproved: d.drawingApproved, poReleased: d.poReleased, qualitySignoff: d.qualitySignoff,
      mrcStatus: d.mrcStatus, paymentStatus: d.paymentStatus, remarks: d.remarks,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  if (!(await owned(id, itemId))) return NextResponse.json({ error: "Material not found" }, { status: 404 });
  await prisma.procurementItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
