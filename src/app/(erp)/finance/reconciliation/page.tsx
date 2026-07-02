import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW } from "@/lib/rbac";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import SavedViewPills from "@/components/hr/SavedViewPills";
import ListSearch from "@/components/bd/ListSearch";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

// Reconciliation states: the full raised → approved → paid ledger, with PAID /
// UNPAID as first-class filters on top of the workflow statuses.
const VIEWS = [
  { value: "", label: "All" },
  { value: "PENDING_APPROVAL", label: "In approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export default async function FinanceReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requirePageRole(FINANCE_VIEW);

  const { q, status } = await searchParams;

  const where: Prisma.InvoiceWhereInput = {};
  if (status === "PAID" || status === "UNPAID") {
    where.status = "APPROVED";
    where.paymentStatus = status;
  } else if (status === "PENDING_APPROVAL" || status === "APPROVED" || status === "REJECTED" || status === "DRAFT") {
    where.status = status;
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { invoiceNo: { contains: term, mode: "insensitive" } },
      { billTo: { contains: term, mode: "insensitive" } },
      { paymentRef: { contains: term, mode: "insensitive" } },
    ];
  }

  const [invoices, raisedAgg, approvedAgg, paidAgg] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: { invoiceDate: "desc" } }),
    prisma.invoice.aggregate({
      where: { status: { not: "DRAFT" } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({ where: { status: "APPROVED" }, _sum: { total: true }, _count: { _all: true } }),
    prisma.invoice.aggregate({
      where: { status: "APPROVED", paymentStatus: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const raised = raisedAgg._sum.total ?? 0;
  const approvedTotal = approvedAgg._sum.total ?? 0;
  const paid = paidAgg._sum.total ?? 0;
  const outstanding = approvedTotal - paid;

  type Row = (typeof invoices)[number];
  const columns: Column<Row>[] = [
    {
      key: "invoice",
      header: "Invoice",
      titleInCard: true,
      cell: (inv) => (
        <span className="relative z-10">
          <EntityLink
            href={`/finance/invoices/${inv.id}`}
            name={inv.billTo.split("\n")[0]}
            code={inv.invoiceNo}
          />
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      cardLabel: "Date",
      cell: (inv) => <span className="nums text-slate-500">{fmtDateOnly(inv.invoiceDate)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cardLabel: "Total",
      cell: (inv) => <span className="nums font-medium">{fmtINR(inv.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (inv) => (
        <span className="relative z-10">
          <StatusChip status={inv.status} />
        </span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      priority: "md",
      cardLabel: "Payment",
      cell: (inv) =>
        inv.status === "APPROVED" ? (
          <span className="relative z-10">
            <StatusChip status={inv.paymentStatus} />
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "approver",
      header: "Approved by",
      priority: "lg",
      cardLabel: "Approved by",
      cell: (inv) => <span className="text-slate-500">{inv.decidedByName ?? "—"}</span>,
    },
    {
      key: "paidOn",
      header: "Paid on",
      priority: "xl",
      cardLabel: "Paid on",
      cell: (inv) => (
        <span className="nums text-slate-500">
          {inv.paymentStatus === "PAID" ? (fmtDateOnly(inv.paymentDate) ?? "—") : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reconciliation"
        subtitle={`${invoices.length} invoice(s) in view`}
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Reconciliation" }]}
      />

      <div className="p-8 space-y-6">
        {/* The reconciliation equation: raised → approved → paid → outstanding. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={`Raised (${raisedAgg._count._all})`} value={fmtINR(raised)} tone="brand" size="sm" />
          <StatCard label={`Approved (${approvedAgg._count._all})`} value={fmtINR(approvedTotal)} tone="blue" size="sm" />
          <StatCard label={`Paid (${paidAgg._count._all})`} value={fmtINR(paid)} tone="emerald" size="sm" />
          <StatCard label="Outstanding" value={fmtINR(outstanding)} tone="amber" size="sm" />
        </div>

        <Card>
          <CardBody className="space-y-3 p-4">
            <SavedViewPills basePath="/finance/reconciliation" views={[...VIEWS]} />
            <Suspense fallback={<div className="h-10" />}>
              <ListSearch
                basePath="/finance/reconciliation"
                placeholder="Search invoice no, party or payment ref…"
                ariaLabel="Search reconciliation ledger"
              />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={invoices}
            columns={columns}
            rowKey={(inv) => inv.id}
            href={(inv) => `/finance/invoices/${inv.id}`}
            empty={
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title="Nothing to reconcile"
                description="Raised invoices and their approval / payment states appear here."
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
