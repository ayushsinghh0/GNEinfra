import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { invoiceSchema, computeInvoiceTotals } from "@/lib/finance-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

// Invoice content is editable only before it enters (or after it fails)
// approval — never while pending or after sign-off.
const EDITABLE = new Set(["DRAFT", "REJECTED"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!EDITABLE.has(existing.status)) {
    return NextResponse.json(
      { error: "Only draft or rejected invoices can be edited." },
      { status: 409 }
    );
  }
  const parsed = invoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const invoiceDate = toDate(d.invoiceDate);
  if (!invoiceDate) {
    return NextResponse.json({ error: "Invoice date is invalid" }, { status: 400 });
  }
  const { amounts, subtotal, gstAmount, total } = computeInvoiceTotals(d.items, d.gstRate);
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          invoiceNo: d.invoiceNo,
          invoiceDate,
          orderNo: d.orderNo || null,
          orderDate: toDate(d.orderDate),
          contactPerson: d.contactPerson || null,
          contactNumber: d.contactNumber || null,
          billTo: d.billTo,
          shipTo: d.shipTo || null,
          gstLabel: d.gstLabel,
          gstRate: d.gstRate,
          subtotal,
          gstAmount,
          total,
          notes: d.notes || null,
          items: {
            create: d.items.map((item, i) => ({
              description: item.description,
              sacCode: item.sacCode || null,
              qty: item.qty,
              uom: item.uom || null,
              rate: item.rate,
              amount: amounts[i],
              sortOrder: i,
            })),
          },
        },
      });
    });
    return NextResponse.json({ ok: true, invoice });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An invoice with that number already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft invoices can be deleted — submitted invoices are part of the approval record." },
      { status: 409 }
    );
  }
  try {
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the invoice." }, { status: 500 });
  }
}
