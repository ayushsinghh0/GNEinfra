import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  FileCheck2,
  Printer,
  SendHorizonal,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE, FINANCE_APPROVE } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import { COMPANY } from "@/lib/company";
import DecisionActions from "@/components/finance/DecisionActions";
import PaymentActions from "@/components/finance/PaymentActions";
import DeleteRowButton from "@/components/bd/DeleteRowButton";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatusChip,
  KeyValue,
  btn,
  cn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function Step({
  state,
  title,
  detail,
}: {
  state: "done" | "active" | "todo" | "failed";
  title: string;
  detail?: string | null;
}) {
  const Icon =
    state === "done" ? CheckCircle2 : state === "failed" ? XCircle : state === "active" ? Clock : CircleDashed;
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          state === "done" && "text-emerald-500",
          state === "failed" && "text-rose-500",
          state === "active" && "text-amber-500",
          state === "todo" && "text-slate-300"
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div
          className={cn(
            "text-[13px] font-semibold",
            state === "todo" ? "text-slate-400" : "text-slate-900"
          )}
        >
          {title}
        </div>
        {detail && <div className="mt-0.5 truncate text-[12px] text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);
  const canApprove = FINANCE_APPROVE.includes(viewer.role);
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      nopa: { select: { id: true, nopaNo: true, grandTotal: true, dueDate: true } },
    },
  });
  if (!invoice) notFound();

  const editable = invoice.status === "DRAFT" || invoice.status === "REJECTED";
  const pending = invoice.status === "PENDING_APPROVAL";
  const approved = invoice.status === "APPROVED";

  // Workflow stepper states
  const submitState = invoice.submittedAt ? "done" : editable ? "active" : "todo";
  const decisionState = approved
    ? "done"
    : invoice.status === "REJECTED"
      ? "failed"
      : pending
        ? "active"
        : "todo";
  const paymentState = approved
    ? invoice.paymentStatus === "PAID"
      ? "done"
      : "active"
    : "todo";

  return (
    <>
      <PageHeader
        title={invoice.invoiceNo}
        subtitle={invoice.billTo.split("\n")[0]}
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: invoice.invoiceNo },
        ]}
      >
        <a
          href={`/finance/invoices/${invoice.id}/print`}
          target="_blank"
          rel="noopener"
          className={btn("ghost", "sm")}
        >
          <Printer className="h-3.5 w-3.5" /> Invoice PDF
        </a>
        {invoice.nopa && (
          <a
            href={`/finance/invoices/${invoice.id}/nopa/print`}
            target="_blank"
            rel="noopener"
            className={btn("ghost", "sm")}
          >
            <Printer className="h-3.5 w-3.5" /> NOPA
          </a>
        )}
        {approved && (
          <a
            href={`/finance/invoices/${invoice.id}/approval-note/print`}
            target="_blank"
            rel="noopener"
            className={btn("ghost", "sm")}
          >
            <FileCheck2 className="h-3.5 w-3.5" /> Approval note
          </a>
        )}
        {canWrite && editable && (
          <>
            <Link href={`/finance/invoices/${invoice.id}/edit`} className={btn("secondary", "sm")}>
              Edit
            </Link>
            <Link href={`/finance/invoices/${invoice.id}/nopa`} className={btn("primary", "sm")}>
              <SendHorizonal className="h-3.5 w-3.5" />
              {invoice.status === "REJECTED" ? "Resubmit" : "Send for approval"}
            </Link>
          </>
        )}
        {canWrite && pending && (
          <Link href={`/finance/invoices/${invoice.id}/nopa`} className={btn("secondary", "sm")}>
            Edit NOPA
          </Link>
        )}
        {canApprove && pending && <DecisionActions invoiceId={invoice.id} invoiceNo={invoice.invoiceNo} />}
        {canWrite && approved && (
          <PaymentActions
            invoiceId={invoice.id}
            invoiceNo={invoice.invoiceNo}
            paid={invoice.paymentStatus === "PAID"}
          />
        )}
        {canWrite && invoice.status === "DRAFT" && (
          <DeleteRowButton
            endpoint={`/api/finance/invoices/${invoice.id}`}
            redirectTo="/finance/invoices"
            title="Delete this draft invoice?"
            message={`${invoice.invoiceNo} will be permanently removed.`}
            doneToast="Invoice deleted"
          />
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Workflow strip */}
        <Card>
          <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex items-center gap-2">
              <StatusChip status={invoice.status} />
              {approved && <StatusChip status={invoice.paymentStatus} />}
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 sm:border-l sm:border-slate-200 sm:pl-6">
              <Step
                state={submitState}
                title="Raised & submitted"
                detail={
                  invoice.submittedAt
                    ? `${invoice.submittedByName ?? "Finance"} · ${fmtDate(invoice.submittedAt)}`
                    : invoice.createdByName
                      ? `Draft by ${invoice.createdByName}`
                      : "Draft — not yet submitted"
                }
              />
              <Step
                state={decisionState}
                title={invoice.status === "REJECTED" ? "Rejected" : "Approval"}
                detail={
                  invoice.decidedAt
                    ? `${invoice.decidedByName ?? "—"} (${invoice.decidedByRole ?? ""}) · ${fmtDate(invoice.decidedAt)}`
                    : pending
                      ? "Awaiting Manager / Admin / Superadmin"
                      : "Not submitted yet"
                }
              />
              <Step
                state={paymentState}
                title="Payment"
                detail={
                  invoice.paymentStatus === "PAID"
                    ? `${fmtDateOnly(invoice.paymentDate) ?? ""}${invoice.paymentRef ? ` · ${invoice.paymentRef}` : ""} · by ${invoice.paymentMarkedBy ?? "Finance"}`
                    : approved
                      ? "Awaiting payment — Finance marks it done"
                      : "After approval"
                }
              />
            </div>
          </CardBody>
        </Card>

        {invoice.status === "REJECTED" && invoice.decisionRemarks && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="font-semibold">Rejection remarks:</span> {invoice.decisionRemarks}
          </div>
        )}
        {approved && invoice.decisionRemarks && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="font-semibold">Approver remarks:</span> {invoice.decisionRemarks}
          </div>
        )}

        {/* On-screen document preview */}
        <Card className="overflow-hidden">
          <CardHeader title="Tax Invoice" subtitle="On-screen preview — use Invoice PDF for the printable copy" />
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">From</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{COMPANY.name}</div>
                {COMPANY.addressLines.map((l) => (
                  <div key={l} className="text-[12px] text-slate-500">{l}</div>
                ))}
                <div className="mt-1 text-[12px] text-slate-500">
                  GSTIN {COMPANY.gstin} · PAN {COMPANY.pan}
                </div>
              </div>
              <KeyValue
                cols={2}
                items={[
                  { label: "Invoice no", value: invoice.invoiceNo, mono: true },
                  { label: "Invoice date", value: fmtDateOnly(invoice.invoiceDate) ?? "—" },
                  { label: "Order no", value: invoice.orderNo ?? "—", mono: true },
                  { label: "Order date", value: fmtDateOnly(invoice.orderDate) ?? "—" },
                  { label: "Contact person", value: invoice.contactPerson ?? "—" },
                  { label: "Contact number", value: invoice.contactNumber ?? "—", mono: true },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bill to</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{invoice.billTo}</p>
              </div>
              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ship to</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {invoice.shipTo ?? "Same as Bill to"}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5">Description</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">SAC</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">UOM</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-800">{item.description}</td>
                      <td className="nums hidden px-3 py-2.5 text-slate-500 sm:table-cell">{item.sacCode ?? "—"}</td>
                      <td className="nums px-3 py-2.5 text-right text-slate-700">{item.qty}</td>
                      <td className="hidden px-3 py-2.5 text-slate-500 sm:table-cell">{item.uom ?? "—"}</td>
                      <td className="nums px-3 py-2.5 text-right text-slate-700">{fmtINR(item.rate)}</td>
                      <td className="nums px-4 py-2.5 text-right font-medium text-slate-900">{fmtINR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="ml-auto w-full max-w-xs space-y-1.5">
              <div className="flex items-center justify-between text-[13px] text-slate-500">
                <span>Subtotal</span>
                <span className="nums font-medium text-slate-700">{fmtINR(invoice.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px] text-slate-500">
                <span>{invoice.gstLabel} @ {invoice.gstRate}%</span>
                <span className="nums font-medium text-slate-700">{fmtINR(invoice.gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-sm font-bold text-slate-900">
                <span>Total</span>
                <span className="nums">{fmtINR(invoice.total)}</span>
              </div>
              <p className="text-right text-[11px] italic text-slate-400">{amountInWords(invoice.total)}</p>
            </div>

            {invoice.notes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-slate-700">
                <span className="font-semibold text-amber-700">Notes: </span>
                {invoice.notes}
              </div>
            )}
          </CardBody>
        </Card>

        {/* NOPA summary */}
        {invoice.nopa && (
          <Card>
            <CardHeader
              title="Note on payment approval"
              subtitle={`${invoice.nopa.nopaNo} · grand total ${fmtINR(invoice.nopa.grandTotal)}`}
              action={
                <span className="flex items-center gap-2">
                  {canWrite && (editable || pending) && (
                    <Link href={`/finance/invoices/${invoice.id}/nopa`} className={btn("secondary", "sm")}>
                      Edit NOPA
                    </Link>
                  )}
                  <a
                    href={`/finance/invoices/${invoice.id}/nopa/print`}
                    target="_blank"
                    rel="noopener"
                    className={btn("ghost", "sm")}
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </a>
                </span>
              }
            />
            <CardBody>
              <p className="text-sm text-slate-600">
                Payment due {fmtDateOnly(invoice.nopa.dueDate) ?? "—"}. The NOPA carries the item lines,
                advance terms and payee bank details that the approver signs off on.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
