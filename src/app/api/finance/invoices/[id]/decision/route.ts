import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_APPROVE } from "@/lib/rbac";
import { decisionSchema, zodErrorMessage } from "@/lib/finance-validation";

// Sign-off is reserved for the oversight tier (Manager / Admin / Superadmin) —
// the Finance initiator can never approve their own invoice.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_APPROVE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  // Conditional transition: only a PENDING_APPROVAL invoice can be decided —
  // a concurrent double-decision loses (count 0) instead of overwriting.
  const { count } = await prisma.invoice.updateMany({
    where: { id, status: "PENDING_APPROVAL" },
    data: {
      status: d.decision,
      decidedByName: user.name,
      decidedByRole: user.role,
      decidedAt: new Date(),
      decisionRemarks: d.remarks || null,
    },
  });
  if (count === 0) {
    const exists = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!exists) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(
      { error: "This invoice is not awaiting approval (it may have just been decided)." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
