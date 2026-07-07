import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_VIEW } from "@/lib/rbac";
import { tallyExportSchema, zodErrorMessage } from "@/lib/finance-validation";
import { getTallySettings } from "@/lib/tally-settings";
import {
  buildEnvelope,
  partyName,
  receiptVoucherXml,
  salesVoucherXml,
} from "@/lib/tally";

export const dynamic = "force-dynamic";

// GET /api/finance/tally/export?type=sales|receipts|both&from=YYYY-MM-DD&to=YYYY-MM-DD[&preview=1]
// preview=1 → JSON { sales:{count,total}, receipts:{count,total} }; otherwise the
// Tally XML file as a download. FINANCE_VIEW (managers may export; read-only op).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = tallyExportSchema.safeParse({
    type: sp.get("type") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    preview: sp.get("preview") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const { type, from, to, preview } = parsed.data;

  // Inclusive [from, to] over UTC-midnight dates → [from 00:00Z, to+1day 00:00Z).
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toExclusive = new Date(Date.parse(`${to}T00:00:00.000Z`) + 86_400_000);

  const needSales = type === "sales" || type === "both";
  const needReceipts = type === "receipts" || type === "both";

  const salesWhere = { status: "APPROVED" as const, invoiceDate: { gte: fromDate, lt: toExclusive } };
  const receiptsWhere = { paymentStatus: "PAID" as const, paymentDate: { gte: fromDate, lt: toExclusive } };

  if (preview === "1") {
    const [salesAgg, receiptsAgg] = await Promise.all([
      needSales
        ? prisma.invoice.aggregate({ where: salesWhere, _count: { _all: true }, _sum: { total: true } })
        : Promise.resolve(null),
      needReceipts
        ? prisma.invoice.aggregate({ where: receiptsWhere, _count: { _all: true }, _sum: { total: true } })
        : Promise.resolve(null),
    ]);
    return NextResponse.json({
      sales: needSales ? { count: salesAgg!._count._all, total: salesAgg!._sum.total ?? 0 } : null,
      receipts: needReceipts ? { count: receiptsAgg!._count._all, total: receiptsAgg!._sum.total ?? 0 } : null,
    });
  }

  const ledgers = await getTallySettings();
  const vouchers: string[] = [];

  if (needSales) {
    const sales = await prisma.invoice.findMany({
      where: salesWhere,
      orderBy: { invoiceDate: "asc" },
      select: {
        invoiceNo: true, invoiceDate: true, subtotal: true, gstAmount: true, total: true,
        billTo: true, orderNo: true, nopa: { select: { partyName: true } },
      },
    });
    for (const inv of sales) {
      vouchers.push(
        salesVoucherXml(
          {
            voucherNumber: inv.invoiceNo,
            date: inv.invoiceDate,
            party: partyName(inv.nopa?.partyName, inv.billTo),
            subtotal: inv.subtotal,
            gstAmount: inv.gstAmount,
            total: inv.total,
            narration: inv.orderNo ? `Order ${inv.orderNo}` : null,
          },
          ledgers
        )
      );
    }
  }

  if (needReceipts) {
    const receipts = await prisma.invoice.findMany({
      where: receiptsWhere,
      orderBy: { paymentDate: "asc" },
      select: {
        invoiceNo: true, paymentDate: true, paymentRef: true, total: true,
        billTo: true, nopa: { select: { partyName: true } },
      },
    });
    for (const inv of receipts) {
      if (!inv.paymentDate) continue; // PAID rows always have a date, but be safe
      vouchers.push(
        receiptVoucherXml(
          {
            voucherNumber: inv.paymentRef || inv.invoiceNo,
            date: inv.paymentDate,
            party: partyName(inv.nopa?.partyName, inv.billTo),
            total: inv.total,
            narration: `Received against ${inv.invoiceNo}${inv.paymentRef ? ` (ref ${inv.paymentRef})` : ""}`,
          },
          ledgers
        )
      );
    }
  }

  const xml = buildEnvelope(ledgers.tallyCompanyName, vouchers);
  const filename = `tally-${type}-${from}_${to}.xml`;
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
