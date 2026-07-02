import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, BD_WRITE } from "@/lib/rbac";
import { bdPoSchema } from "@/lib/bd-validation";
import { poData } from "@/lib/bd-mappers";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = bdPoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const po = await prisma.bdPurchaseOrder.create({ data: poData(parsed.data) });
    return NextResponse.json({ ok: true, po });
  } catch {
    return NextResponse.json({ error: "Could not record the PO." }, { status: 500 });
  }
}
