import Link from "next/link";
import { Prisma } from "@prisma/client";
import { BadgeIndianRupee, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE } from "@/lib/rbac";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import SavedViewPills from "@/components/hr/SavedViewPills";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  StatCard,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_PAYMENT = new Set(["UNPAID", "PAID"]);

export default async function FinancePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);

  const { status } = await searchParams;

  // Payment tracking only applies to invoices that cleared approval.
  const where: Prisma.InvoiceWhereInput = { status: "APPROVED" };
  if (status && VALID_PAYMENT.has(status)) {
    where.paymentStatus = status as Prisma.InvoiceWhereInput["paymentStatus"];
  }

  const [invoices, outstandingAgg, paidAgg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: [{ paymentStatus: "desc" }, { decidedAt: "asc" }], // UNPAID first, oldest approval first
      include: { nopa: { select: { dueDate: true } } },
    }),
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
  ]);

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
      key: "total",
      header: "Total",
      align: "right",
      cardLabel: "Total",
      cell: (inv) => <span className="nums font-medium">{fmtINR(inv.total)}</span>,
    },
    {
      key: "due",
      header: "Due",
      priority: "md",
      cardLabel: "Due",
      cell: (inv) => <span className="nums text-slate-500">{fmtDateOnly(inv.nopa?.dueDate ?? null) ?? "—"}</span>,
    },
    {
      key: "payment",
      header: "Payment",
      cardLabel: "Payment",
      cell: (inv) => (
        <span className="relative z-10">
          <StatusChip status={inv.paymentStatus} />
        </span>
      ),
    },
    {
      key: "paidOn",
      header: "Paid on",
      priority: "lg",
      cardLabel: "Paid on",
      cell: (inv) =>
        inv.paymentStatus === "PAID" ? (
          <span className="nums text-slate-500">
            {fmtDateOnly(inv.paymentDate) ?? "—"}
            {inv.paymentRef ? ` · ${inv.paymentRef}` : ""}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payment"
        subtitle={
          canWrite
            ? "Open an approved invoice to mark its payment done"
            : "Payment marking is done by the Finance role"
        }
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Payment" }]}
      />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label={`Outstanding (${outstandingAgg._count._all})`}
            value={fmtINR(outstandingAgg._sum.total ?? 0)}
            tone="amber"
            size="sm"
            icon={<Wallet className="h-[18px] w-[18px]" />}
            href="/finance/payments?status=UNPAID"
          />
          <StatCard
            label={`Paid (${paidAgg._count._all})`}
            value={fmtINR(paidAgg._sum.total ?? 0)}
            tone="emerald"
            size="sm"
            icon={<BadgeIndianRupee className="h-[18px] w-[18px]" />}
            href="/finance/payments?status=PAID"
          />
        </div>

        <Card>
          <CardBody className="p-4">
            <SavedViewPills
              basePath="/finance/payments"
              views={[
                { value: "", label: "All approved" },
                { value: "UNPAID", label: "Unpaid" },
                { value: "PAID", label: "Paid" },
              ]}
            />
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
                icon={<BadgeIndianRupee className="h-6 w-6" />}
                title="No approved invoices here"
                description="Invoices appear for payment once they clear approval."
                action={
                  <Link href="/finance/invoices" className={btn("secondary", "sm")}>
                    View all invoices
                  </Link>
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
