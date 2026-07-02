import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { SERVICE_TYPE_LABELS } from "@/lib/bd-validation";
import { fmtINR } from "@/lib/format";
import SavedViewPills from "@/components/hr/SavedViewPills";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  StatCard,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BdTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);

  const { fy } = await searchParams;

  const where: Prisma.BdTargetWhereInput = {};
  if (fy && fy.trim()) {
    where.fiscalYear = fy.trim();
  }

  const [targets, fyRows, agg] = await Promise.all([
    prisma.bdTarget.findMany({
      where,
      orderBy: [{ fiscalYear: "desc" }, { quarter: "asc" }, { createdAt: "asc" }],
    }),
    prisma.bdTarget.findMany({
      distinct: ["fiscalYear"],
      select: { fiscalYear: true },
      orderBy: { fiscalYear: "desc" },
    }),
    prisma.bdTarget.aggregate({
      where,
      _sum: { estimatedValue: true, forecastedRevenue: true, orderReceived: true },
    }),
  ]);

  const estimated = agg._sum.estimatedValue ?? 0;
  const forecast = agg._sum.forecastedRevenue ?? 0;
  const received = agg._sum.orderReceived ?? 0;

  type Row = (typeof targets)[number];
  const columns: Column<Row>[] = [
    {
      key: "line",
      header: "Target line",
      titleInCard: true,
      cell: (t) => (
        <span className="font-medium text-slate-900">
          {t.project ?? t.states ?? t.keyAccountPerson ?? t.fiscalYear}
        </span>
      ),
    },
    {
      key: "fy",
      header: "FY / Qtr",
      cardLabel: "FY / Qtr",
      cell: (t) => (
        <span className="nums text-slate-600">
          {t.fiscalYear}
          {t.quarter ? ` · ${t.quarter}` : ""}
        </span>
      ),
    },
    {
      key: "kap",
      header: "Key account",
      priority: "lg",
      cardLabel: "Key account",
      cell: (t) => t.keyAccountPerson ?? "—",
    },
    {
      key: "service",
      header: "Service",
      priority: "xl",
      cardLabel: "Service",
      cell: (t) => (t.serviceType ? SERVICE_TYPE_LABELS[t.serviceType] : "—"),
    },
    {
      key: "size",
      header: "Size / Locations",
      priority: "lg",
      cardLabel: "Size / Locations",
      cell: (t) => {
        const size = t.projectSize ?? "";
        const locs = t.locations !== null ? `${t.locations} loc` : "";
        return size || locs ? `${size}${size && locs ? " · " : ""}${locs}` : "—";
      },
    },
    {
      key: "estimated",
      header: "Estimated",
      align: "right",
      cardLabel: "Estimated",
      cell: (t) => <span className="nums">{fmtINR(t.estimatedValue)}</span>,
    },
    {
      key: "prob",
      header: "Prob.",
      align: "right",
      priority: "xl",
      cardLabel: "Probability",
      cell: (t) => <span className="nums">{t.probabilityPct !== null ? `${t.probabilityPct}%` : "—"}</span>,
    },
    {
      key: "forecast",
      header: "Forecast",
      align: "right",
      priority: "md",
      cardLabel: "Forecast",
      cell: (t) => <span className="nums">{fmtINR(t.forecastedRevenue)}</span>,
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      cardLabel: "Received",
      cell: (t) => <span className="nums text-emerald-600">{fmtINR(t.orderReceived)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Targets"
        subtitle={`${targets.length} line(s)${fy ? ` · ${fy.trim()}` : ""}`}
        breadcrumbs={[{ label: "BD", href: "/bd" }, { label: "Targets" }]}
      >
        {canWrite && (
          <Link href="/bd/targets/new" className={btn("primary", "sm")}>
            + Add target
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Estimated value" value={fmtINR(estimated)} tone="brand" size="sm" />
          <StatCard label="Forecasted revenue" value={fmtINR(forecast)} tone="amber" size="sm" />
          <StatCard label="Orders received" value={fmtINR(received)} tone="emerald" size="sm" />
        </div>

        <Card>
          <CardBody className="p-4">
            <SavedViewPills
              basePath="/bd/targets"
              param="fy"
              views={[
                { value: "", label: "All years" },
                ...fyRows.map((r) => ({ value: r.fiscalYear, label: r.fiscalYear })),
              ]}
            />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={targets}
            columns={columns}
            rowKey={(t) => t.id}
            href={canWrite ? (t) => `/bd/targets/${t.id}/edit` : undefined}
            empty={
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title={fy ? "No targets for this year" : "No targets yet"}
                description="Set the business target lines for the year — quarter, states, value and probability."
                action={
                  canWrite ? (
                    <Link href="/bd/targets/new" className={btn("primary", "sm")}>
                      + Add target
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
