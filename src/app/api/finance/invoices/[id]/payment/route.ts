import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { paymentSchema, zodErrorMessage } from "@/lib/finance-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

// Payment marking is the Finance role's call (plus Admin/Superadmin) and only
// applies to invoices that cleared approval.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status !== "APPROVED") {
    return NextResponse.json({ error: "Payment can only be marked on an approved invoice." }, { status: 409 });
  }
  const updated = await prisma.invoice.update({
    where: { id },
    data: d.paid
      ? {
          paymentStatus: "PAID",
          paymentDate: toDate(d.paymentDate) ?? new Date(),
          paymentRef: d.paymentRef || null,
          paymentMarkedBy: user.name,
        }
      : {
          paymentStatus: "UNPAID",
          paymentDate: null,
          paymentRef: null,
          paymentMarkedBy: user.name,
        },
  });
  return NextResponse.json({ ok: true, invoice: updated });
}
