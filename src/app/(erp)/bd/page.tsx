import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import { fyLabel } from "@/lib/fiscal";
import CountUp from "@/components/CountUp";
import { Donut, BarList } from "@/components/Charts";
import { BrandHero, CanvasAtmosphere } from "@/components/chrome";
import { DataTable, type Column } from "@/components/DataTable";
import { buildQuery } from "@/lib/hr-filters";
import {
  Building2,
  FileText,
  ReceiptText,
  Target,
  TrendingUp,
  PieChart,
  ChevronRight,
  Inbox,
  IndianRupee,
} from "lucide-react";
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  ProgressBar,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BdDashboardPage() {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);
  const fy = fyLabel();

  const [
    clientCount,
    openEnquiries,
    quotesThisFy,
    posThisFy,
    poValueThisFy,
    weightedPipeline,
    stageGroups,
    outcomeGroups,
    targetAgg,
    recentEnquiries,
    topClients,
  ] = await Promise.all([
    prisma.bdClient.count(),
    prisma.bdEnquiry.count({ where: { finalStatus: "OPEN" } }),
    prisma.bdEnquiry.count({ where: { fiscalYear: fy, submissionDate: { not: null } } }),
    prisma.bdPurchaseOrder.count({ where: { fiscalYear: fy } }),
    prisma.bdPurchaseOrder.aggregate({ where: { fiscalYear: fy }, _sum: { poValue: true } }),
    prisma.bdEnquiry.aggregate({ where: { finalStatus: "OPEN" }, _sum: { forecastedRevenue: true } }),
    prisma.bdEnquiry.groupBy({ by: ["stage"], where: { finalStatus: "OPEN" }, _count: { _all: true } }),
    prisma.bdEnquiry.groupBy({ by: ["finalStatus"], where: { fiscalYear: fy }, _count: { _all: true } }),
    prisma.bdTarget.aggregate({
      where: { fiscalYear: fy },
      _sum: { estimatedValue: true, forecastedRevenue: true, orderReceived: true },
    }),
    prisma.bdEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.bdPurchaseOrder.groupBy({
      by: ["clientId"],
      where: { fiscalYear: fy },
      _sum: { poValue: true },
      orderBy: { _sum: { poValue: "desc" } },
      take: 5,
    }),
  ]);

  const stageCounts = new Map(stageGroups.map((g) => [g.stage, g._count._all]));
  const STAGES = ["ENQUIRY", "QUOTE_SUBMITTED", "FOLLOW_UP", "NEGOTIATION", "CLOSED"] as const;
  const STAGE_LABELS: Record<string, string> = {
    ENQUIRY: "Enquiry",
    QUOTE_SUBMITTED: "Quote submitted",
    FOLLOW_UP: "Follow-up",
    NEGOTIATION: "Negotiation",
    CLOSED: "Closed",
  };
  const stageData = STAGES.map((s) => ({
    status: s,
    label: STAGE_LABELS[s],
    value: stageCounts.get(s) ?? 0,
  }));

  const outcomeCounts = new Map(outcomeGroups.map((g) => [g.finalStatus, g._count._all]));
  const won = outcomeCounts.get("WON") ?? 0;
  const lost = outcomeCounts.get("LOST") ?? 0;
  const open = outcomeCounts.get("OPEN") ?? 0;
  const decided = won + lost;

  // Top clients by PO value need names — resolve the grouped ids in one query.
  const topClientRows =
    topClients.length > 0
      ? await prisma.bdClient.findMany({
          where: { id: { in: topClients.map((t) => t.clientId) } },
          select: { id: true, name: true },
        })
      : [];
  const clientName = new Map(topClientRows.map((c) => [c.id, c.name]));
  const topClientBars = topClients
    .filter((t) => (t._sum.poValue ?? 0) > 0)
    .map((t) => ({
      label: clientName.get(t.clientId) ?? "—",
      value: t._sum.poValue ?? 0,
      href: `/bd/clients/${t.clientId}`,
    }));

  const targetEstimated = targetAgg._sum.estimatedValue ?? 0;
  const targetReceived = targetAgg._sum.orderReceived ?? 0;
  const achievedPct = targetEstimated > 0 ? Math.round((targetReceived / targetEstimated) * 100) : null;

  type Enq = (typeof recentEnquiries)[number];
  const enquiryColumns: Column<Enq>[] = [
    {
      key: "client",
      header: "Client",
      titleInCard: true,
      cell: (e) => (
        <span className="relative z-10">
          <EntityLink href={`/bd/enquiries/${e.id}`} name={e.client.name} code={e.quoteNo ?? undefined} />
        </span>
      ),
    },
    {
      key: "project",
      header: "Project",
      priority: "md",
      cardLabel: "Project",
      cell: (e) => e.projectType ?? e.activities ?? "—",
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      cardLabel: "Value",
      cell: (e) => <span className="nums">{fmtINR(e.value)}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cardLabel: "Stage",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.stage} />
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      priority: "lg",
      cardLabel: "Date",
      cell: (e) => <span className="nums text-slate-500">{fmtDateOnly(e.enquiryDate) ?? "—"}</span>,
    },
  ];

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="GNE Business Development"
        title="Dashboard"
        subtitle="Pipeline, quotes and orders at a glance."
        className="px-6 pb-7 pt-9 sm:px-8"
      />

      <div className="relative isolate space-y-6 p-6 sm:p-8">
        <CanvasAtmosphere />

        {/* KPI bento — each tile drills into the tracker it summarizes. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Clients"
            value={<CountUp value={clientCount} />}
            tone="brand"
            icon={<Building2 className="h-[18px] w-[18px]" />}
            href="/bd/clients"
          />
          <StatCard
            label="Open enquiries"
            value={<CountUp value={openEnquiries} />}
            tone="blue"
            icon={<FileText className="h-[18px] w-[18px]" />}
            href={buildQuery("/bd/enquiries", { status: "OPEN" })}
          />
          <StatCard
            label={`Quotes · ${fy}`}
            value={<CountUp value={quotesThisFy} />}
            tone="amber"
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            href={buildQuery("/bd/enquiries", { fy })}
          />
          <StatCard
            label={`POs · ${fy}`}
            value={<CountUp value={posThisFy} />}
            tone="emerald"
            icon={<ReceiptText className="h-[18px] w-[18px]" />}
            href={buildQuery("/bd/pos", { fy })}
          />
          <StatCard
            label="Weighted pipeline"
            value={fmtINR(weightedPipeline._sum.forecastedRevenue ?? 0)}
            tone="slate"
            icon={<IndianRupee className="h-[18px] w-[18px]" />}
            href={buildQuery("/bd/enquiries", { status: "OPEN" })}
          />
        </div>

        {/* Pipeline composition + this-FY performance */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <PieChart className="h-[18px] w-[18px] text-brand" />
                  Open pipeline
                </span>
              }
              subtitle="Live enquiries by stage"
            />
            <CardBody>
              <Donut data={stageData} unitLabel="enquiries" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Target className="h-[18px] w-[18px] text-brand" />
                  {fy} outcomes
                </span>
              }
              subtitle="How this year's enquiries are landing"
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Open", value: open, cls: "text-sky-600", href: buildQuery("/bd/enquiries", { fy, status: "OPEN" }) },
                  { label: "Won", value: won, cls: "text-emerald-600", href: buildQuery("/bd/enquiries", { fy, status: "WON" }) },
                  { label: "Lost", value: lost, cls: "text-rose-600", href: buildQuery("/bd/enquiries", { fy, status: "LOST" }) },
                ].map((o) => (
                  <Link
                    key={o.label}
                    href={o.href}
                    className="press rounded-xl border border-slate-200 bg-white px-3 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className={`nums text-2xl font-bold ${o.cls}`}>{o.value}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{o.label}</div>
                  </Link>
                ))}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Win rate (of decided)</span>
                  <span className="nums font-semibold text-slate-700">
                    {decided > 0 ? `${Math.round((won / decided) * 100)}%` : "—"}
                  </span>
                </div>
                <ProgressBar value={decided > 0 ? Math.round((won / decided) * 100) : 0} tone="emerald" />
                {decided === 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-400">No enquiries decided yet this year.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <IndianRupee className="h-[18px] w-[18px] text-brand" />
                  Target vs received
                </span>
              }
              subtitle={`${fy} business target`}
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Target</div>
                  <div className="nums mt-1 text-lg font-bold text-slate-900">{fmtINR(targetEstimated)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Orders received</div>
                  <div className="nums mt-1 text-lg font-bold text-emerald-600">{fmtINR(targetReceived)}</div>
                </div>
              </div>
              {achievedPct !== null ? (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Achieved</span>
                    <span className="nums font-semibold text-slate-700">{achievedPct}%</span>
                  </div>
                  <ProgressBar value={Math.min(100, achievedPct)} tone="brand" />
                </div>
              ) : (
                <p className="text-[12px] text-slate-400">
                  No target lines for {fy} yet.{" "}
                  {canWrite && (
                    <Link href="/bd/targets/new" className="font-medium text-brand-700 hover:text-brand">
                      Add one →
                    </Link>
                  )}
                </p>
              )}
              <div className="flex items-center justify-between">
                <Link
                  href={buildQuery("/bd/targets", { fy })}
                  className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
                >
                  View targets
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <span className="nums text-[12px] text-slate-400">
                  PO value {fy}: {fmtINR(poValueThisFy._sum.poValue ?? 0)}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent enquiries + top clients */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <CardHeader
              title="Recent enquiries"
              action={
                <span className="flex items-center gap-3">
                  {canWrite && (
                    <Link href="/bd/enquiries/new" className={btn("primary", "sm")}>
                      + New enquiry
                    </Link>
                  )}
                  <Link
                    href="/bd/enquiries"
                    className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </span>
              }
            />
            <DataTable
              rows={recentEnquiries}
              columns={enquiryColumns}
              rowKey={(e) => e.id}
              href={(e) => `/bd/enquiries/${e.id}`}
              empty={
                <EmptyState
                  icon={<Inbox className="h-6 w-6" />}
                  title="No enquiries yet"
                  description="Record your first enquiry to start the pipeline."
                  action={
                    canWrite ? (
                      <Link href="/bd/enquiries/new" className={btn("primary", "sm")}>
                        + New enquiry
                      </Link>
                    ) : undefined
                  }
                />
              }
            />
          </Card>

          <Card>
            <CardHeader title="Top clients" subtitle={`By PO value · ${fy}`} />
            <CardBody>
              {topClientBars.length > 0 ? (
                <BarList items={topClientBars} formatValue={fmtINR} />
              ) : (
                <EmptyState
                  icon={<ReceiptText className="h-6 w-6" />}
                  title="No POs this year"
                  description="Top clients appear here once POs are recorded."
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
