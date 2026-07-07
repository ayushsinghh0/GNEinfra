import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { getCompany } from "@/lib/company";
import PrintBar from "@/components/PrintBar";
import { cn } from "@/components/ui";

export const dynamic = "force-dynamic";

// This page mirrors the GNE-002 "Note for Approval" Word template line by
// line (docs/formats — "GNE Infra - Approval Note (office purpose only)").
// Fields the system knows are filled in; everything else prints as a blank
// form line for hand-filling, exactly like the Word original.
//
// Print-safety notes: hierarchy comes from borders + font weight (browsers
// strip background colors when printing), checkboxes are drawn boxes (glyphs
// like ☐ vary by font), and all numbers/dates/codes are tabular (.nums).

// A drawn checkbox — checked state is a dark tick inside a heavy box, so it
// survives print without background graphics and never relies on color alone.
function CheckOpt({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "relative top-[1.5px] inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border bg-white",
          checked ? "border-[1.5px] border-slate-900" : "border-slate-400"
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 5.5l2.5 2.5 4.5-5.5" />
          </svg>
        )}
      </span>
      <span className={checked ? "font-bold text-slate-900" : "text-slate-600"}>{label}</span>
    </span>
  );
}

// "Label:" followed by a dotted fill line (blank when the system has no value —
// it prints as a writing line, like the Word form).
function Line({ label, value, full, check }: { label: string; value?: string | null; full?: boolean; check?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2 py-[7px] text-[12px]", full && "col-span-2")}>
      {check ? (
        <CheckOpt checked={false} label={label} />
      ) : (
        <span className="shrink-0 text-slate-600">{label}</span>
      )}
      <span className="nums min-w-0 flex-1 border-b border-dotted border-slate-400 pb-px font-medium text-slate-900">
        {value || " "}
      </span>
    </div>
  );
}

// "Label: ☐ A ☐ B ☐ C" — inline checkbox row, options verbatim from the template.
function Checks({ label, options, full }: { label: string; options: [string, boolean][]; full?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-6 gap-y-1 py-[7px] text-[12px]", full && "col-span-2")}>
      <span className="text-slate-600">{label}</span>
      {options.map(([o, checked]) => (
        <CheckOpt key={o} checked={checked} label={o} />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="font-display border-b-2 border-slate-900 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-10 px-1 pt-1">{children}</div>
    </section>
  );
}

const TH = "border border-slate-300 px-2 pb-1 pt-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500";
const TD = "border border-slate-300 px-2 py-1.5 text-[11.5px] font-bold text-slate-900";

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
    include: {
      items: { orderBy: { sortOrder: "asc" }, select: { qty: true, uom: true, description: true } },
      nopa: {
        select: { nopaNo: true, partyName: true, dueDate: true, itemDescription: true, poRef: true },
      },
    },
  });
  // The approval note exists only once the invoice has been approved.
  if (!invoice || invoice.status !== "APPROVED" || !invoice.decidedAt) notFound();
  const company = await getCompany();

  // Slot the actual approver into the signature column their role owns.
  const deciderRole = invoice.decidedByRole ?? "";
  const decidedDate = fmtDateOnly(invoice.decidedAt);
  const signatures = [
    { title: "Prepared by", name: invoice.submittedByName, date: fmtDateOnly(invoice.submittedAt) },
    { title: "Manager", name: deciderRole === "MANAGER" ? invoice.decidedByName : null, date: deciderRole === "MANAGER" ? decidedDate : null },
    { title: "Approval CFO/COO", name: deciderRole === "ADMIN" ? invoice.decidedByName : null, date: deciderRole === "ADMIN" ? decidedDate : null },
    { title: "Approval CEO", name: deciderRole === "SUPERADMIN" ? invoice.decidedByName : null, date: deciderRole === "SUPERADMIN" ? decidedDate : null },
  ];

  const quantity = invoice.items.map((i) => `${i.qty}${i.uom ? ` ${i.uom}` : ""}`).join(", ");
  const paymentStatus =
    invoice.paymentStatus === "PAID"
      ? `Paid${fmtDateOnly(invoice.paymentDate) ? ` — ${fmtDateOnly(invoice.paymentDate)}` : ""}${invoice.paymentRef ? ` · ${invoice.paymentRef}` : ""}`
      : "Unpaid";

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/finance/invoices/${invoice.id}`} />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">
        {/* ── Letterhead (consistent with the other GNE documents) ─────────── */}
        <div className="flex items-center justify-between pb-4 break-inside-avoid">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/gne-infra.png"
              alt={company.name}
              width={110}
              height={31}
              className="h-8 w-auto"
              priority
            />
            <div className="text-[14px] font-bold leading-tight text-slate-900">{company.name}</div>
          </div>
          <div className="nums text-right text-[10px] leading-relaxed text-slate-500">
            <div>Ref: <span className="font-semibold text-slate-700">{invoice.invoiceNo}</span></div>
            {invoice.nopa && <div>NOPA: <span className="font-semibold text-slate-700">{invoice.nopa.nopaNo}</span></div>}
          </div>
        </div>

        {/* ── Document-control tables (verbatim from the GNE-002 template) ── */}
        <table className="w-full border-collapse border-2 border-slate-900 text-center break-inside-avoid">
          <thead>
            <tr>
              <th className={TH}>Document No</th>
              <th className={TH}>Note for Approval</th>
              <th className={TH}>Date</th>
              <th className={TH}>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cn(TD, "nums")}>GNE-002</td>
              <td className={TD}>CAPEX/OPEX</td>
              <td className={cn(TD, "nums")}>{decidedDate ?? " "}</td>
              <td className={TD}>{" "}</td>
            </tr>
          </tbody>
        </table>

        <div className="font-display mt-3 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
          Note for Approval Format
        </div>

        <table className="mt-3 w-full border-collapse border-2 border-slate-900 text-center break-inside-avoid">
          <thead>
            <tr>
              <th className={TH}>Revision No</th>
              <th className={TH}>Creation date</th>
              <th className={TH}>Date of Revision</th>
              <th className={TH}>Prepared By</th>
              <th className={TH}>Approved By</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cn(TD, "nums")}>Rev 00</td>
              <td className={cn(TD, "nums")}>{fmtDateOnly(invoice.submittedAt) ?? " "}</td>
              <td className={TD}>{" "}</td>
              <td className={TD}>{invoice.submittedByName ?? " "}</td>
              <td className={TD}>{invoice.decidedByName ?? " "}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <h1 className="font-display mt-7 text-center text-[16px] font-bold uppercase tracking-[0.16em] text-slate-900">
          Office Requirement Approval Note
        </h1>

        {/* ── 1. Basic Information ─────────────────────────────────────────── */}
        <Section title="1. Basic Information">
          <Line label="Date:" value={decidedDate} />
          <Line label="Department:" value="Finance" />
          <Line label="Requested By:" value={invoice.submittedByName} />
          <Line label="Designation:" />
        </Section>

        {/* ── 2. Requirement Details ───────────────────────────────────────── */}
        <Section title="2. Requirement Details">
          <div className="col-span-2 pt-[7px] text-[12px] text-slate-600">Type of Requirement:</div>
          <div className="col-span-2 grid grid-cols-2 gap-x-10 pl-5">
            <Line label="Office Supplies:" check />
            <Line label="IT Equipment:" check />
            <Line label="Furniture & Fixtures:" check />
            <Line label="Admin / Facility Expense:" check />
            <Line label="Others:" check />
          </div>
          <Line
            label="Description of Requirement:"
            value={invoice.nopa?.itemDescription || invoice.items[0]?.description}
            full
          />
          <Line label="Quantity:" value={quantity} />
          <Line label="Required By (Date):" value={fmtDateOnly(invoice.nopa?.dueDate ?? null)} />
        </Section>

        {/* ── 3. Justification ─────────────────────────────────────────────── */}
        <Section title="3. Justification">
          <Line label="Purpose:" full />
          <Line label="Business Need / Use Case:" full />
          <Checks label="Urgency:" options={[["High", false], ["Medium", false], ["Low", false]]} full />
        </Section>

        {/* ── 4. Cost Details ──────────────────────────────────────────────── */}
        <Section title="4. Cost Details">
          <Line label="Estimated Cost:" value={fmtINR(invoice.subtotal)} />
          <Line
            label="Taxes (if applicable):"
            value={`${fmtINR(invoice.gstAmount)} (${invoice.gstLabel} @ ${invoice.gstRate}%)`}
          />
          <Line label="Total Cost:" value={fmtINR(invoice.total)} />
          <Line label="Budget Head:" />
          <Checks label="Budget Availability:" options={[["Yes", false], ["No", false]]} full />
        </Section>

        {/* ── 5. Vendor Details ────────────────────────────────────────────── */}
        <Section title="5. Vendor Details (if applicable)">
          <Line
            label="Vendor Name:"
            value={invoice.nopa?.partyName || invoice.billTo.split("\n")[0]}
            full
          />
          <Checks label="Quotation Attached:" options={[["Yes", false], ["No", false]]} />
          <Checks label="Comparison Done:" options={[["Yes", false], ["No", false]]} />
        </Section>

        {/* ── 6. Recommendation ────────────────────────────────────────────── */}
        <Section title="6. Recommendation">
          <Line label="Recommended By:" value={invoice.submittedByName} />
          <Line label="Remarks:" value={invoice.decisionRemarks} />
          <Checks
            label="Decision:"
            options={[["Approved", true], ["Rejected", false], ["Modify", false]]}
            full
          />
        </Section>

        {/* ── 7. Approval ──────────────────────────────────────────────────── */}
        <Section title="7. Approval">
          <Line label="Requestor:" value={invoice.submittedByName} />
          <Line label="Department Head:" />
          <Line label="Admin / Procurement:" />
          <Line label="Finance/Accounts:" value={invoice.createdByName} />
          <Line
            label="Final Approval:"
            value={
              invoice.decidedByName
                ? `${invoice.decidedByName}${invoice.decidedByRole ? ` (${invoice.decidedByRole})` : ""} — ${fmtDate(invoice.decidedAt) ?? ""}`
                : null
            }
            full
          />
        </Section>

        {/* ── 8. Post-Approval ─────────────────────────────────────────────── */}
        <Section title="8. Post-Approval (For Admin Use)">
          <Line label="PO / Purchase Ref No.:" value={invoice.orderNo || invoice.nopa?.poRef} />
          <Line label="Procurement Date:" />
          <Line label="Delivery Status:" />
          <Line label="Payment Status:" value={paymentStatus} />
        </Section>

        {/* ── Signature grid (verbatim: Signature / Name / Date rows) ─────── */}
        <table className="mt-8 w-full border-collapse border-2 border-slate-900 break-inside-avoid">
          <thead>
            <tr>
              <th className={cn(TH, "w-20")}>{" "}</th>
              {signatures.map((s) => (
                <th key={s.title} className={cn(TH, "text-slate-700")}>{s.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 text-[10.5px] text-slate-500">Signature:</td>
              {signatures.map((s) => (
                <td key={s.title} className="h-16 border border-slate-300">{" "}</td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 text-[10.5px] text-slate-500">Name:</td>
              {signatures.map((s) => (
                <td key={s.title} className="border border-slate-300 px-2 py-1.5 text-center text-[11.5px] font-semibold text-slate-900">
                  {s.name ?? " "}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 text-[10.5px] text-slate-500">Date:</td>
              {signatures.map((s) => (
                <td key={s.title} className="nums border border-slate-300 px-2 py-1.5 text-center text-[11px] text-slate-900">
                  {s.date ?? " "}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Generated by GNE ERP · {fmtDate(new Date())} · System-recorded approval — signatures on file digitally.
        </div>
      </div>
    </main>
  );
}
