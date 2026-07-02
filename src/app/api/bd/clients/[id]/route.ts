import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, BD_WRITE } from "@/lib/rbac";
import { clientSchema } from "@/lib/bd-validation";
import { clientData } from "@/lib/bd-mappers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const parsed = clientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const client = await prisma.bdClient.update({ where: { id }, data: clientData(parsed.data) });
    return NextResponse.json({ ok: true, client });
  } catch {
    return NextResponse.json({ error: "Could not update the client." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const [enquiries, pos] = await Promise.all([
    prisma.bdEnquiry.count({ where: { clientId: id } }),
    prisma.bdPurchaseOrder.count({ where: { clientId: id } }),
  ]);
  if (enquiries > 0 || pos > 0) {
    return NextResponse.json(
      { error: "This client has enquiries or POs on record — remove those first." },
      { status: 409 }
    );
  }
  try {
    await prisma.bdClient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the client." }, { status: 500 });
  }
}
