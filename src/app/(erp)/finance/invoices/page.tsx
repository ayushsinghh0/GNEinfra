import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE } from "@/lib/rbac";
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
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]);

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);

  const { q, status } = await searchParams;

  const where: Prisma.InvoiceWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.InvoiceWhereInput["status"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { invoiceNo: { contains: term, mode: "insensitive" } },
      { billTo: { contains: term, mode: "insensitive" } },
      { orderNo: { contains: term, mode: "insensitive" } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const hasFilters = Boolean((q && q.trim()) || (status && VALID_STATUS.has(status)));

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
      key: "order",
      header: "Order no",
      priority: "xl",
      cardLabel: "Order no",
      cell: (inv) => <span className="nums text-slate-500">{inv.orderNo ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoice Raise"
        subtitle={`${invoices.length} result(s)`}
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Invoices" }]}
      >
        {canWrite && (
          <Link href="/finance/invoices/new" className={btn("primary", "sm")}>
            + Raise invoice
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="space-y-3 p-4">
            <SavedViewPills
              basePath="/finance/invoices"
              views={[
                { value: "", label: "All" },
                { value: "DRAFT", label: "Draft" },
                { value: "PENDING_APPROVAL", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
            <Suspense fallback={<div className="h-10" />}>
              <ListSearch
                basePath="/finance/invoices"
                placeholder="Search invoice no, party or order no…"
                ariaLabel="Search invoices"
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
                icon={<ReceiptText className="h-6 w-6" />}
                title={hasFilters ? "No invoices found" : "No invoices yet"}
                description={
                  hasFilters
                    ? "No invoices match your filters."
                    : "Raise your first invoice — it stays a draft until you send it for approval."
                }
                action={
                  hasFilters ? (
                    <Link href="/finance/invoices" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  ) : canWrite ? (
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
