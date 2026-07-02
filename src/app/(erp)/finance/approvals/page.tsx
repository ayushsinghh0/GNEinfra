import Link from "next/link";
import { PackageCheck, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW, FINANCE_APPROVE } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardHeader,
  EmptyState,
  EntityLink,
  StatusChip,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinanceApprovalsPage() {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canApprove = FINANCE_APPROVE.includes(viewer.role);

  const [pending, pendingAgg, recentDecided] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { submittedAt: "asc" }, // oldest waiting first
      include: { nopa: { select: { nopaNo: true, grandTotal: true, dueDate: true } } },
    }),
    prisma.invoice.aggregate({ where: { status: "PENDING_APPROVAL" }, _sum: { total: true } }),
    prisma.invoice.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { not: null } },
      orderBy: { decidedAt: "desc" },
      take: 8,
    }),
  ]);

  type Pending = (typeof pending)[number];
  const pendingColumns: Column<Pending>[] = [
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
      key: "nopa",
      header: "NOPA",
      priority: "md",
      cardLabel: "NOPA",
      cell: (inv) => <span className="nums text-slate-500">{inv.nopa?.nopaNo ?? "—"}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cardLabel: "Total",
      cell: (inv) => <span className="nums font-medium">{fmtINR(inv.total)}</span>,
    },
    {
      key: "due",
      header: "Payment due",
      priority: "lg",
      cardLabel: "Payment due",
      cell: (inv) => <span className="nums text-slate-500">{fmtDateOnly(inv.nopa?.dueDate ?? null) ?? "—"}</span>,
    },
    {
      key: "submitted",
      header: "Waiting since",
      cardLabel: "Waiting since",
      cell: (inv) => (
        <span className="nums text-slate-500">
          {inv.submittedAt ? fmtDate(inv.submittedAt) : "—"}
          {inv.submittedByName ? ` · ${inv.submittedByName}` : ""}
        </span>
      ),
    },
  ];

  type Decided = (typeof recentDecided)[number];
  const decidedColumns: Column<Decided>[] = [
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
      cell: (inv) => <span className="nums">{fmtINR(inv.total)}</span>,
    },
    {
      key: "status",
      header: "Decision",
      cardLabel: "Decision",
      cell: (inv) => (
        <span className="relative z-10">
          <StatusChip status={inv.status} />
        </span>
      ),
    },
    {
      key: "by",
      header: "By",
      priority: "md",
      cardLabel: "By",
      cell: (inv) => (
        <span className="text-slate-500">
          {inv.decidedByName ?? "—"}
          {inv.decidedAt ? ` · ${fmtDate(inv.decidedAt)}` : ""}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoice Approval"
        subtitle={
          canApprove
            ? "Open an invoice to approve or reject it"
            : "Approvals are decided by Manager / Admin / Superadmin"
        }
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Approvals" }]}
      />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Awaiting approval"
            value={pending.length}
            tone="amber"
            size="sm"
            icon={<PackageCheck className="h-[18px] w-[18px]" />}
          />
          <StatCard
            label="Value waiting"
            value={fmtINR(pendingAgg._sum.total ?? 0)}
            tone="slate"
            size="sm"
          />
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title="Awaiting sign-off"
            subtitle={pending.length > 0 ? "Oldest submissions first" : undefined}
          />
          <DataTable
            rows={pending}
            columns={pendingColumns}
            rowKey={(inv) => inv.id}
            href={(inv) => `/finance/invoices/${inv.id}`}
            empty={
              <EmptyState
                icon={<PackageCheck className="h-6 w-6" />}
                title="Nothing awaiting approval"
                description="When Finance submits an invoice with its NOPA, it lands here."
              />
            }
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <History className="h-[18px] w-[18px] text-brand" />
                Recently decided
              </span>
            }
          />
          <DataTable
            rows={recentDecided}
            columns={decidedColumns}
            rowKey={(inv) => inv.id}
            href={(inv) => `/finance/invoices/${inv.id}`}
            empty={
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title="No decisions yet"
              />
            }
          />
        </Card>

        {!canApprove && pending.length > 0 && (
          <p className="text-center text-[13px] text-slate-400">
            You can track these here — the approve/reject buttons appear for Manager, Admin and Superadmin
            on each invoice page.{" "}
            <Link href="/finance/invoices" className="font-medium text-brand-700 hover:text-brand">
              Back to invoices
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
