import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE, FINANCE_APPROVE } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { Donut } from "@/components/Charts";
import { BrandHero, CanvasAtmosphere } from "@/components/chrome";
import { DataTable, type Column } from "@/components/DataTable";
import {
  ReceiptText,
  PackageCheck,
  BadgeIndianRupee,
  Wallet,
  PieChart,
  ChevronRight,
  Inbox,
} from "lucide-react";
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage() {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);
  const canApprove = FINANCE_APPROVE.includes(viewer.role);

  const [statusGroups, raisedAgg, pendingAgg, outstandingAgg, paidAgg, recent, pendingQueue] =
    await Promise.all([
      prisma.invoice.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.invoice.aggregate({ where: { status: { not: "DRAFT" } }, _sum: { total: true }, _count: { _all: true } }),
      prisma.invoice.aggregate({ where: { status: "PENDING_APPROVAL" }, _sum: { total: true }, _count: { _all: true } }),
      prisma.invoice.aggregate({
        where: { status: "APPROVED", paymentStatus: "UNPAID" },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "APPROVED", paymentStatus: "PAID" },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.invoice.findMany({
        where: { status: "PENDING_APPROVAL" },
        orderBy: { submittedAt: "asc" },
        take: 5,
      }),
    ]);

  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  const statusData = (["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    value: statusCounts.get(s) ?? 0,
  }));

  type Row = (typeof recent)[number];
  const recentColumns: Column<Row>[] = [
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
      priority: "lg",
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
      key: "date",
      header: "Date",
      priority: "md",
      cardLabel: "Date",
      cell: (inv) => <span className="nums text-slate-500">{fmtDateOnly(inv.invoiceDate)}</span>,
    },
  ];

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="GNE Finance"
        title="Dashboard"
        subtitle="Invoices, approvals and payments at a glance."
        className="px-6 pb-7 pt-9 sm:px-8"
      />

      <div className="relative isolate space-y-6 p-6 sm:p-8">
        <CanvasAtmosphere />

        {/* KPI bento — the reconciliation equation, each tile a drill-through. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={`Raised (${raisedAgg._count._all})`}
            value={fmtINR(raisedAgg._sum.total ?? 0)}
            tone="brand"
            icon={<ReceiptText className="h-[18px] w-[18px]" />}
            href="/finance/invoices"
          />
          <StatCard
            label={`Pending approval (${pendingAgg._count._all})`}
            value={fmtINR(pendingAgg._sum.total ?? 0)}
            tone="amber"
            icon={<PackageCheck className="h-[18px] w-[18px]" />}
            href="/finance/approvals"
          />
          <StatCard
            label={`Awaiting payment (${outstandingAgg._count._all})`}
            value={fmtINR(outstandingAgg._sum.total ?? 0)}
            tone="blue"
            icon={<Wallet className="h-[18px] w-[18px]" />}
            href="/finance/payments?status=UNPAID"
          />
          <StatCard
            label={`Paid (${paidAgg._count._all})`}
            value={fmtINR(paidAgg._sum.total ?? 0)}
            tone="emerald"
            icon={<BadgeIndianRupee className="h-[18px] w-[18px]" />}
            href="/finance/payments?status=PAID"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Approval queue */}
          <Card className="overflow-hidden lg:col-span-2">
            <CardHeader
              title="Awaiting approval"
              subtitle={
                pendingQueue.length > 0
                  ? canApprove
                    ? "Open an invoice to approve or reject it"
                    : "Waiting on Manager / Admin / Superadmin"
                  : undefined
              }
              action={
                <Link
                  href="/finance/approvals"
                  className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              }
            />
            <DataTable
              rows={pendingQueue}
              columns={[
                recentColumns[0],
                recentColumns[1],
                {
                  key: "since",
                  header: "Waiting since",
                  cardLabel: "Waiting since",
                  cell: (inv) => (
                    <span className="nums text-slate-500">
                      {inv.submittedAt ? fmtDate(inv.submittedAt) : "—"}
                    </span>
                  ),
                },
              ]}
              rowKey={(inv) => inv.id}
              href={(inv) => `/finance/invoices/${inv.id}`}
              empty={
                <EmptyState
                  icon={<PackageCheck className="h-6 w-6" />}
                  title="Nothing waiting"
                  description="Submitted invoices land here for sign-off."
                />
              }
            />
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <PieChart className="h-[18px] w-[18px] text-brand" />
                  By status
                </span>
              }
              subtitle="All invoices"
            />
            <CardBody>
              <Donut data={statusData} unitLabel="invoices" />
            </CardBody>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent invoices"
            action={
              <span className="flex items-center gap-3">
                {canWrite && (
                  <Link href="/finance/invoices/new" className={btn("primary", "sm")}>
                    + Raise invoice
                  </Link>
                )}
                <Link
                  href="/finance/invoices"
                  className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </span>
            }
          />
          <DataTable
            rows={recent}
            columns={recentColumns}
            rowKey={(inv) => inv.id}
            href={(inv) => `/finance/invoices/${inv.id}`}
            empty={
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title="No invoices yet"
                description="Raise your first invoice to start the ledger."
                action={
                  canWrite ? (
                    <Link href="/finance/invoices/new" className={btn("primary", "sm")}>
                      + Raise invoice
                    </Link>
                  ) : undefined
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
