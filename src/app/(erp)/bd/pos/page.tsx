import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
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
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BdPosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fy?: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);

  const { q, fy } = await searchParams;

  const where: Prisma.BdPurchaseOrderWhereInput = {};
  if (fy && fy.trim()) {
    where.fiscalYear = fy.trim();
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { client: { name: { contains: term, mode: "insensitive" } } },
      { poNumber: { contains: term, mode: "insensitive" } },
      { quoteNo: { contains: term, mode: "insensitive" } },
      { projectType: { contains: term, mode: "insensitive" } },
    ];
  }

  const [pos, fyRows, totalAgg] = await Promise.all([
    prisma.bdPurchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.bdPurchaseOrder.findMany({
      distinct: ["fiscalYear"],
      select: { fiscalYear: true },
      orderBy: { fiscalYear: "desc" },
    }),
    prisma.bdPurchaseOrder.aggregate({ where, _sum: { poValue: true } }),
  ]);

  const hasFilters = Boolean((q && q.trim()) || (fy && fy.trim()));
  const totalValue = totalAgg._sum.poValue ?? 0;

  type Row = (typeof pos)[number];
  const columns: Column<Row>[] = [
    {
      key: "client",
      header: "Client",
      titleInCard: true,
      cell: (p) => (
        <span className="relative z-10">
          <EntityLink href={`/bd/clients/${p.client.id}`} name={p.client.name} code={p.poNumber ?? undefined} />
        </span>
      ),
    },
    {
      key: "project",
      header: "Project",
      priority: "md",
      cardLabel: "Project",
      cell: (p) => p.projectType ?? p.activities ?? "—",
    },
    {
      key: "value",
      header: "PO value",
      align: "right",
      cardLabel: "PO value",
      cell: (p) => <span className="nums">{fmtINR(p.poValue)}</span>,
    },
    {
      key: "poDate",
      header: "PO date",
      priority: "lg",
      cardLabel: "PO date",
      cell: (p) => <span className="nums text-slate-500">{fmtDateOnly(p.poDate) ?? "—"}</span>,
    },
    {
      key: "period",
      header: "Period",
      priority: "xl",
      cardLabel: "Period",
      cell: (p) => p.projectPeriod ?? "—",
    },
    {
      key: "fy",
      header: "FY",
      priority: "lg",
      cardLabel: "FY",
      cell: (p) => <span className="nums text-slate-500">{p.fiscalYear}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="PO Tracker"
        subtitle={`${pos.length} result(s) · total ${fmtINR(totalValue)}`}
        breadcrumbs={[{ label: "BD", href: "/bd" }, { label: "PO Tracker" }]}
      >
        {canWrite && (
          <Link href="/bd/pos/new" className={btn("primary", "sm")}>
            + Record PO
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="space-y-3 p-4">
            <SavedViewPills
              basePath="/bd/pos"
              param="fy"
              views={[
                { value: "", label: "All years" },
                ...fyRows.map((r) => ({ value: r.fiscalYear, label: r.fiscalYear })),
              ]}
            />
            <Suspense fallback={<div className="h-10" />}>
              <ListSearch
                basePath="/bd/pos"
                placeholder="Search client, PO no, quote no or project…"
                ariaLabel="Search purchase orders"
              />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={pos}
            columns={columns}
            rowKey={(p) => p.id}
            href={canWrite ? (p) => `/bd/pos/${p.id}/edit` : undefined}
            empty={
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title={hasFilters ? "No POs found" : "No POs yet"}
                description={
                  hasFilters
                    ? "No purchase orders match your filters."
                    : "Record the first PO to start the tracker."
                }
                action={
                  hasFilters ? (
                    <Link href="/bd/pos" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  ) : canWrite ? (
                    <Link href="/bd/pos/new" className={btn("primary", "sm")}>
                      + Record PO
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
