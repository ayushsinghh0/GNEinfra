import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import PrintBar from "@/components/PrintBar";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-2 text-[12px] last:border-0">
      <span className="w-56 shrink-0 text-slate-600">{label}</span>
      <span className="nums min-w-0 flex-1 font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SectionTitle({ no, title }: { no: number; title: string }) {
  return (
    <div className="mt-5 border-b-2 border-slate-900 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-800">
      {no}. {title}
    </div>
  );
}

export default async function ApprovalNotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.mustChangePassword || !FINANCE_VIEW.includes(viewer.role)) notFound();

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { nopa: { select: { nopaNo: true, partyName: true, dueDate: true, grandTotal: true } } },
  });
  // The approval note exists only once the invoice has been approved.
  if (!invoice || invoice.status !== "APPROVED" || !invoice.decidedAt) notFound();

  // Slot the actual approver into the signature column their role owns.
  const deciderRole = invoice.decidedByRole ?? "";
  const signatures = [
    { title: "Prepared By", name: invoice.submittedByName, date: invoice.submittedAt ? fmtDate(invoice.submittedAt) : null },
    { title: "Manager", name: deciderRole === "MANAGER" ? invoice.decidedByName : null, date: deciderRole === "MANAGER" && invoice.decidedAt ? fmtDate(invoice.decidedAt) : null },
    { title: "Approval CFO/COO", name: deciderRole === "ADMIN" ? invoice.decidedByName : null, date: deciderRole === "ADMIN" && invoice.decidedAt ? fmtDate(invoice.decidedAt) : null },
    { title: "Approval CEO", name: deciderRole === "SUPERADMIN" ? invoice.decidedByName : null, date: deciderRole === "SUPERADMIN" && invoice.decidedAt ? fmtDate(invoice.decidedAt) : null },
  ];

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/finance/invoices/${invoice.id}`} />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">
        {/* ── Document control header (mirrors the GNE-002 format) ─────────── */}
        <div className="grid grid-cols-4 border-2 border-slate-900 text-center text-[11px] break-inside-avoid">
          <div className="border-r border-slate-300 px-2 py-2">
            <div className="text-slate-500">Document No</div>
            <div className="nums font-bold text-slate-900">GNE-002</div>
          </div>
          <div className="border-r border-slate-300 px-2 py-2">
            <div className="text-slate-500">Type</div>
            <div className="font-bold text-slate-900">Note for Approval</div>
          </div>
          <div className="border-r border-slate-300 px-2 py-2">
            <div className="text-slate-500">Date</div>
            <div className="nums font-bold text-slate-900">{fmtDate(invoice.decidedAt) ?? "—"}</div>
          </div>
          <div className="px-2 py-2">
            <div className="text-slate-500">Revision</div>
            <div className="nums font-bold text-slate-900">Rev 00</div>
          </div>
        </div>

        <div className="mt-5 text-center break-inside-avoid">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/brand/gne-infra.png"
              alt={COMPANY.name}
              width={110}
              height={31}
              className="h-8 w-auto"
              priority
            />
            <div className="text-[15px] font-bold text-slate-900">{COMPANY.name}</div>
          </div>
          <div className="mt-2 text-[13px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Payment Approval Note
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-600 px-4 py-1 text-[12px] font-bold uppercase tracking-widest text-emerald-700">
            Approved
          </span>
        </div>

        <SectionTitle no={1} title="Basic Information" />
        <div className="px-1">
          <Row label="Date" value={fmtDate(invoice.decidedAt) ?? "—"} />
          <Row label="Department" value="Finance" />
          <Row label="Requested By" value={invoice.submittedByName ?? "—"} />
          <Row label="Requested On" value={fmtDate(invoice.submittedAt) ?? "—"} />
        </div>

        <SectionTitle no={2} title="Payment Details" />
        <div className="px-1">
          <Row label="Invoice No" value={invoice.invoiceNo} />
          <Row label="Invoice Date" value={fmtDateOnly(invoice.invoiceDate) ?? "—"} />
          <Row label="NOPA No" value={invoice.nopa?.nopaNo ?? "—"} />
          <Row label="Party" value={invoice.nopa?.partyName ?? invoice.billTo.split("\n")[0]} />
          <Row label="Due Date for Payment" value={fmtDateOnly(invoice.nopa?.dueDate ?? null) ?? "—"} />
        </div>

        <SectionTitle no={3} title="Cost Details" />
        <div className="px-1">
          <Row label="Basic Amount" value={fmtINR(invoice.subtotal)} />
          <Row label={`${invoice.gstLabel} (${invoice.gstRate}%)`} value={fmtINR(invoice.gstAmount)} />
          <Row label="Total Cost" value={fmtINR(invoice.total)} />
          {invoice.nopa && invoice.nopa.grandTotal !== invoice.total && (
            <Row label="NOPA Grand Total" value={fmtINR(invoice.nopa.grandTotal)} />
          )}
        </div>

        <SectionTitle no={4} title="Decision" />
        <div className="px-1">
          <Row label="Decision" value="Approved" />
          <Row label="Approved By" value={`${invoice.decidedByName ?? "—"}${invoice.decidedByRole ? ` (${invoice.decidedByRole})` : ""}`} />
          <Row label="Approved On" value={fmtDate(invoice.decidedAt) ?? "—"} />
          <Row label="Remarks" value={invoice.decisionRemarks ?? "—"} />
        </div>

        <SectionTitle no={5} title="Post-Approval (For Finance Use)" />
        <div className="px-1">
          <Row
            label="Payment Status"
            value={invoice.paymentStatus === "PAID" ? "Paid" : "Pending"}
          />
          <Row label="Payment Date" value={fmtDateOnly(invoice.paymentDate) ?? "—"} />
          <Row label="Payment Reference" value={invoice.paymentRef ?? "—"} />
          <Row label="Marked By" value={invoice.paymentMarkedBy ?? "—"} />
        </div>

        {/* ── Signature strip ──────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-4 gap-3 break-inside-avoid">
          {signatures.map((s) => (
            <div key={s.title} className="rounded-lg border border-slate-200 px-3 pb-3 pt-10 text-center">
              <div className="border-t border-slate-300 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {s.title}
              </div>
              <div className="mt-0.5 min-h-4 text-[11px] font-medium text-slate-900">{s.name ?? ""}</div>
              {s.date && <div className="nums text-[10px] text-slate-400">{s.date}</div>}
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Generated by GNE ERP · {fmtDate(new Date())} · System-recorded approval — signatures on file digitally.
        </div>
      </div>
    </main>
  );
}
