import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, BD_WRITE } from "@/lib/rbac";
import { bdPoSchema } from "@/lib/bd-validation";
import { poData } from "@/lib/bd-mappers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const parsed = bdPoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const po = await prisma.bdPurchaseOrder.update({ where: { id }, data: poData(parsed.data) });
    return NextResponse.json({ ok: true, po });
  } catch {
    return NextResponse.json({ error: "Could not update the PO." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  try {
    await prisma.bdPurchaseOrder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the PO." }, { status: 500 });
  }
}
