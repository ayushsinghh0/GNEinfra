import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import PrintBar from "@/components/PrintBar";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

function FactRow({ no, label, value }: { no: string; label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-2 text-[12px] last:border-0">
      <span className="w-5 shrink-0 text-slate-400">{no}</span>
      <span className="w-52 shrink-0 text-slate-600">{label}</span>
      <span className="nums min-w-0 flex-1 font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function NopaPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.mustChangePassword || !FINANCE_VIEW.includes(viewer.role)) notFound();

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { nopa: { include: { lines: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!invoice || !invoice.nopa) notFound();
  const nopa = invoice.nopa;

  const approved = invoice.status === "APPROVED";

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/finance/invoices/${invoice.id}`} />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="border-b-2 border-slate-900 pb-4 text-center break-inside-avoid">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/brand/gne-infra.png"
              alt={COMPANY.name}
              width={110}
              height={31}
              className="h-8 w-auto"
              priority
            />
            <div className="text-[15px] font-bold text-slate-900">{nopa.companyName}</div>
          </div>
          <div className="mt-2 text-[13px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Note on Payment Approval
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[12px] break-inside-avoid">
          <div>
            <span className="text-slate-500">NOPA No: </span>
            <span className="nums font-semibold text-slate-900">{nopa.nopaNo}</span>
          </div>
          <div>
            <span className="text-slate-500">Date: </span>
            <span className="nums font-semibold text-slate-900">{fmtDateOnly(nopa.nopaDate) ?? "—"}</span>
          </div>
        </div>

        {/* ── Numbered facts (mirrors the NOPA sheet) ──────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 px-4 py-1 break-inside-avoid">
          <FactRow no="1" label="Plant Name / Description" value={nopa.plantName ?? "—"} />
          <FactRow no="2" label="Vendor / Party Name" value={nopa.partyName ?? "—"} />
          <FactRow no="3" label="Description of Item" value={nopa.itemDescription ?? "—"} />
          <FactRow no="4" label="Invoice No." value={invoice.invoiceNo} />
          <FactRow no="5" label="PO/WO Reference No" value={nopa.poRef ?? "—"} />
          <FactRow no="6" label="Total TI Amount (₹)" value={fmtINR(invoice.total)} />
        </div>

        {/* ── Item lines ───────────────────────────────────────────────────── */}
        <table className="mt-5 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y-2 border-slate-900 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
              <th className="py-2 pr-3">S.No</th>
              <th className="px-3 py-2">Description of Item</th>
              <th className="px-3 py-2">Qty (words)</th>
              <th className="px-3 py-2">UOM</th>
              <th className="px-3 py-2 text-right">Unit Price</th>
              <th className="py-2 pl-3 text-right">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {nopa.lines.map((line, i) => (
              <tr key={line.id} className="border-b border-slate-200">
                <td className="nums py-2.5 pr-3 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2.5 text-slate-800">{line.description}</td>
                <td className="px-3 py-2.5 text-slate-600">{line.qtyWords ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{line.uom ?? "—"}</td>
                <td className="nums px-3 py-2.5 text-right text-slate-800">{fmtINR(line.unitPrice)}</td>
                <td className="nums py-2.5 pl-3 text-right font-medium text-slate-900">{fmtINR(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals block ─────────────────────────────────────────────────── */}
        <div className="mt-4 flex justify-end break-inside-avoid">
          <div className="w-80 space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Basic Amount (INR)</span>
              <span className="nums font-medium text-slate-900">{fmtINR(nopa.basicAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">GST ({nopa.gstRate}%)</span>
              <span className="nums font-medium text-slate-900">{fmtINR(nopa.gstAmount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-[13px] font-bold text-slate-900">
              <span>Grand Total with GST</span>
              <span className="nums">{fmtINR(nopa.grandTotal)}</span>
            </div>
            {nopa.advancePaid > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Advance 1st Payment Paid (INR)</span>
                <span className="nums font-medium text-slate-900">{fmtINR(nopa.advancePaid)}</span>
              </div>
            )}
            {nopa.advanceRequest > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Advance Payment Requested (INR)</span>
                <span className="nums font-medium text-slate-900">{fmtINR(nopa.advanceRequest)}</span>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-right text-[11px] italic text-slate-500">{amountInWords(nopa.grandTotal)}</p>

        {/* ── Payment terms + bank ─────────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 px-4 py-1 break-inside-avoid">
          <FactRow no="7" label="Due Date for Payment" value={fmtDateOnly(nopa.dueDate) ?? "—"} />
          <FactRow no="8" label="Bank Name" value={nopa.bankName ?? "—"} />
          <FactRow no="" label="Bank Account No." value={nopa.accountNo ?? "—"} />
          <FactRow no="" label="IFSC Code" value={nopa.ifsc ?? "—"} />
          <FactRow no="" label="Branch Name" value={nopa.branchName ?? "—"} />
        </div>

        {/* ── Sign-off strip ───────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-4 gap-3 break-inside-avoid">
          {(
            [
              { role: "Initiated By", name: nopa.initiatedBy, date: fmtDateOnly(nopa.nopaDate) },
              { role: "Checked By", name: nopa.checkedBy, date: null },
              { role: "Finance", name: invoice.submittedByName, date: invoice.submittedAt ? fmtDate(invoice.submittedAt) : null },
              {
                role: "Approving Authority",
                name: approved ? invoice.decidedByName : null,
                date: approved && invoice.decidedAt ? fmtDate(invoice.decidedAt) : null,
              },
            ] as { role: string; name: string | null; date: string | null }[]
          ).map((s) => (
            <div key={s.role} className="rounded-lg border border-slate-200 px-3 pb-3 pt-10 text-center">
              <div className="border-t border-slate-300 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {s.role}
              </div>
              <div className="mt-0.5 min-h-4 text-[11px] font-medium text-slate-900">{s.name ?? ""}</div>
              {s.date && <div className="nums text-[10px] text-slate-400">{s.date}</div>}
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Generated by GNE ERP · {fmtDate(new Date())}
        </div>
      </div>
    </main>
  );
}
