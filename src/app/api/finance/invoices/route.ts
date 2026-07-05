import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { invoiceSchema, computeInvoiceTotals, zodErrorMessage } from "@/lib/finance-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = invoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const invoiceDate = toDate(d.invoiceDate);
  if (!invoiceDate) {
    return NextResponse.json({ error: "Invoice date is invalid" }, { status: 400 });
  }
  // Totals are server-authoritative — the client's display math is ignored.
  const { amounts, subtotal, gstAmount, total } = computeInvoiceTotals(d.items, d.gstRate);
  try {
    const invoice = await prisma.invoice.create({
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
        createdByName: user.name,
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
    return NextResponse.json({ ok: true, invoice });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An invoice with that number already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 500 });
  }
}
