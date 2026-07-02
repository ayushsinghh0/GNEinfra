import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import PrintBar from "@/components/PrintBar";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // RBAC guard — standalone page outside the app layout so it prints clean.
  const viewer = await getCurrentUser();
  if (!viewer || viewer.mustChangePassword || !FINANCE_VIEW.includes(viewer.role)) notFound();

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/finance/invoices/${invoice.id}`} />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">
        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <div className="text-center text-[15px] font-bold uppercase tracking-widest text-slate-900">
          Tax Invoice
        </div>

        {/* ── Letterhead: company block + invoice meta ─────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-6 border-y-2 border-slate-900 py-5 break-inside-avoid">
          <div>
            <Image
              src="/brand/gne-infra.png"
              alt={COMPANY.name}
              width={120}
              height={34}
              className="h-9 w-auto"
              priority
            />
            <div className="mt-2 text-sm font-bold leading-tight text-slate-900">{COMPANY.name}</div>
            {COMPANY.addressLines.map((l) => (
              <div key={l} className="text-[11px] leading-snug text-slate-600">{l}</div>
            ))}
            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
              <div>GSTIN: <span className="nums font-medium text-slate-800">{COMPANY.gstin}</span></div>
              <div>PAN: <span className="nums font-medium text-slate-800">{COMPANY.pan}</span></div>
              <div>Phone: <span className="nums">{COMPANY.phone}</span> · Email: {COMPANY.email}</div>
              <div>
                Bank: {COMPANY.bank.name} · A/c <span className="nums">{COMPANY.bank.accountNo}</span> · IFSC{" "}
                <span className="nums">{COMPANY.bank.ifsc}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 border-l border-slate-200 pl-6 text-[12px]">
            {(
              [
                ["Invoice No", invoice.invoiceNo],
                ["Date", fmtDateOnly(invoice.invoiceDate) ?? "—"],
                ["Order No", invoice.orderNo ?? "—"],
                ["Order Date", fmtDateOnly(invoice.orderDate) ?? "—"],
                ["Contact Person", invoice.contactPerson ?? "—"],
                ["Contact Number", invoice.contactNumber ?? "—"],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="w-32 shrink-0 text-slate-500">{label}</span>
                <span className="nums font-medium text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Parties ──────────────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-4 break-inside-avoid">
          <div className="rounded-lg border border-slate-300 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill To</div>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-800">{invoice.billTo}</p>
          </div>
          <div className="rounded-lg border border-slate-300 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ship To</div>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-800">
              {invoice.shipTo ?? "Same as Bill To"}
            </p>
          </div>
        </div>

        {/* ── Items ────────────────────────────────────────────────────────── */}
        <table className="mt-5 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y-2 border-slate-900 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
              <th className="py-2 pr-3">Description</th>
              <th className="px-3 py-2">SAC Code</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">UOM</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="py-2 pl-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-2.5 pr-3 text-slate-800">{item.description}</td>
                <td className="nums px-3 py-2.5 text-slate-600">{item.sacCode ?? "—"}</td>
                <td className="nums px-3 py-2.5 text-right text-slate-800">{item.qty}</td>
                <td className="px-3 py-2.5 text-slate-600">{item.uom ?? "—"}</td>
                <td className="nums px-3 py-2.5 text-right text-slate-800">{fmtINR(item.rate)}</td>
                <td className="nums py-2.5 pl-3 text-right font-medium text-slate-900">{fmtINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ───────────────────────────────────────────────────────── */}
        <div className="mt-4 flex justify-end break-inside-avoid">
          <div className="w-72 space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="nums font-medium text-slate-900">{fmtINR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{invoice.gstLabel} Amount ({invoice.gstRate}%)</span>
              <span className="nums font-medium text-slate-900">{fmtINR(invoice.gstAmount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-[13px] font-bold text-slate-900">
              <span>Total Amount</span>
              <span className="nums">{fmtINR(invoice.total)}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-right text-[11px] italic text-slate-500">{amountInWords(invoice.total)}</p>

        {invoice.notes && (
          <div className="mt-4 break-inside-avoid rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes</span>
            <p className="mt-0.5 text-[12px] text-slate-700">{invoice.notes}</p>
          </div>
        )}

        {/* ── Signature ────────────────────────────────────────────────────── */}
        <div className="mt-12 flex justify-end break-inside-avoid">
          <div className="text-center">
            <div className="text-[12px] font-medium text-slate-900">
              For Green Next Energy Infra Private Limited
            </div>
            <div className="mt-16 border-t border-slate-400 pt-1.5 text-[11px] text-slate-500">
              Authorised Signatory
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Generated by GNE ERP · {fmtDate(new Date())}
        </div>
      </div>
    </main>
  );
}
