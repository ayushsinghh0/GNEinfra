import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import { fyLabel } from "@/lib/fiscal";
import { buildQuery } from "@/lib/hr-filters";
import { KpiTile, DashBox, BoxLink, BoxEmpty } from "@/components/DashboardBits";
import { PageHeader, ProgressBar, StatusChip, btn, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

// Compact single-screen BD dashboard — same system as /hr (KPI tile row +
// three slim boxes with capped, internally-scrolling bodies).
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
      take: 12,
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
  const stageRows = STAGES.map((s) => ({ label: STAGE_LABELS[s], value: stageCounts.get(s) ?? 0 }));
  const stageMax = Math.max(1, ...stageRows.map((r) => r.value));

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
      id: t.clientId,
      label: clientName.get(t.clientId) ?? "—",
      value: t._sum.poValue ?? 0,
    }));
  const topClientMax = Math.max(1, ...topClientBars.map((b) => b.value));

  const targetEstimated = targetAgg._sum.estimatedValue ?? 0;
  const targetReceived = targetAgg._sum.orderReceived ?? 0;
  const achievedPct = targetEstimated > 0 ? Math.round((targetReceived / targetEstimated) * 100) : null;

  const outcomeChips = [
    { label: "Open", value: open, cls: "bg-sky-50/60 text-sky-700", href: buildQuery("/bd/enquiries", { fy, status: "OPEN" }) },
    { label: "Won", value: won, cls: "bg-emerald-50/60 text-emerald-700", href: buildQuery("/bd/enquiries", { fy, status: "WON" }) },
    { label: "Lost", value: lost, cls: "bg-rose-50/60 text-rose-700", href: buildQuery("/bd/enquiries", { fy, status: "LOST" }) },
  ];

  return (
    <>
      <PageHeader title="BD Dashboard" subtitle={`Pipeline, quotes and orders · ${fy}.`} />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <KpiTile label="Clients" value={clientCount} dot="bg-brand-500" href="/bd/clients" />
          <KpiTile label="Open enquiries" value={openEnquiries} dot="bg-sky-500" href={buildQuery("/bd/enquiries", { status: "OPEN" })} />
          <KpiTile label={`Quotes · ${fy}`} value={quotesThisFy} dot="bg-amber-500" href={buildQuery("/bd/enquiries", { fy })} />
          <KpiTile label={`POs · ${fy}`} value={posThisFy} dot="bg-emerald-500" href={buildQuery("/bd/pos", { fy })} />
          <KpiTile label={`PO value · ${fy}`} value={fmtINR(poValueThisFy._sum.poValue ?? 0)} dot="bg-emerald-500" href={buildQuery("/bd/pos", { fy })} />
          <KpiTile label="Weighted pipeline" value={fmtINR(weightedPipeline._sum.forecastedRevenue ?? 0)} dot="bg-slate-400" href={buildQuery("/bd/enquiries", { status: "OPEN" })} />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* ── Pipeline: this-FY outcomes + live enquiries by stage ─────────── */}
          <DashBox
            title="Pipeline"
            meta={`${openEnquiries} open`}
            action={<BoxLink href="/bd/enquiries">Enquiries</BoxLink>}
          >
            <div className="flex flex-wrap gap-1.5">
              {outcomeChips.map((o) => (
                <Link
                  key={o.label}
                  href={o.href}
                  className={cn(
                    "min-w-0 flex-1 basis-24 rounded-lg px-2.5 py-1.5 motion-safe:transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                    o.cls
                  )}
                >
                  <div className="nums text-base font-semibold leading-none text-slate-900">{o.value}</div>
                  <div className="mt-0.5 truncate text-[11px] font-medium">{o.label} · {fy}</div>
                </Link>
              ))}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Win rate (of decided):{" "}
              <span className="nums font-semibold text-slate-700">
                {decided > 0 ? `${Math.round((won / decided) * 100)}%` : "—"}
              </span>
              {decided === 0 && <span className="text-slate-400"> · nothing decided yet this year</span>}
            </p>

            <ul className="mt-2 border-t border-slate-100 pt-1.5">
              {stageRows.map((r) => {
                const zero = r.value === 0;
                return (
                  <li key={r.label} className="flex items-center gap-2.5 py-[5px]">
                    <span className={cn("w-[42%] truncate text-xs", zero ? "text-slate-400" : "text-slate-600")}>
                      {r.label}
                    </span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                      {!zero && (
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                          style={{ width: `${Math.min(100, (r.value / stageMax) * 100)}%` }}
                        />
                      )}
                    </span>
                    <span className={cn("nums w-7 shrink-0 text-right text-xs font-semibold", zero ? "text-slate-400" : "text-slate-700")}>
                      {r.value}
                    </span>
                  </li>
                );
              })}
            </ul>
          </DashBox>

          {/* ── Target vs received + top clients ─────────────────────────────── */}
          <DashBox title="Target vs received" meta={fy} action={<BoxLink href={buildQuery("/bd/targets", { fy })}>Targets</BoxLink>}>
            {targetEstimated === 0 && targetReceived === 0 ? (
              <p className="py-3 text-sm text-slate-500">
                No target lines for {fy} yet.
                {canWrite && (
                  <>
                    {" "}
                    <Link href="/bd/targets/new" className="font-medium text-brand-700 hover:text-brand">
                      Add one →
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <div className="min-w-0 flex-1 basis-28 rounded-lg bg-brand-50/60 px-2.5 py-1.5 text-brand-700">
                    <div className="nums truncate text-base font-semibold leading-none text-slate-900">{fmtINR(targetEstimated)}</div>
                    <div className="mt-0.5 truncate text-[11px] font-medium">Target</div>
                  </div>
                  <div className="min-w-0 flex-1 basis-28 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-emerald-700">
                    <div className="nums truncate text-base font-semibold leading-none text-slate-900">{fmtINR(targetReceived)}</div>
                    <div className="mt-0.5 truncate text-[11px] font-medium">Orders received</div>
                  </div>
                </div>
                {achievedPct !== null && (
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Achieved</span>
                      <span className="nums font-semibold text-slate-700">{achievedPct}%</span>
                    </div>
                    <ProgressBar value={Math.min(100, achievedPct)} tone="brand" />
                  </div>
                )}
              </>
            )}

            <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Top clients · PO value {fy}
              </p>
              {topClientBars.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">No POs recorded this year yet.</p>
              ) : (
                <ul>
                  {topClientBars.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/bd/clients/${b.id}`}
                        className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-[5px] motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                      >
                        <span className="w-[42%] truncate text-xs text-slate-600">{b.label}</span>
                        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                            style={{ width: `${Math.min(100, (b.value / topClientMax) * 100)}%` }}
                          />
                        </span>
                        <span className="nums shrink-0 text-right text-xs font-semibold text-slate-700">{fmtINR(b.value)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DashBox>

          {/* ── Recent enquiries ─────────────────────────────────────────────── */}
          <DashBox
            title="Recent enquiries"
            meta={`${recentEnquiries.length} latest`}
            action={<BoxLink href="/bd/enquiries">All enquiries</BoxLink>}
          >
            {recentEnquiries.length === 0 ? (
              <BoxEmpty title="No enquiries yet" hint="Record your first enquiry to start the pipeline." />
            ) : (
              <ul>
                {recentEnquiries.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/bd/enquiries/${e.id}`}
                      className="group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[13px] font-medium text-slate-800 group-hover:text-brand-700">
                            {e.client.name}
                          </span>
                          {e.quoteNo && <span className="nums shrink-0 font-mono text-[10px] text-slate-400">{e.quoteNo}</span>}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {e.projectType ?? e.activities ?? "—"}
                          <span className="nums"> · {fmtDateOnly(e.enquiryDate) ?? "—"}</span>
                        </div>
                      </div>
                      <span className="nums hidden shrink-0 text-xs font-semibold text-slate-700 sm:inline">
                        {fmtINR(e.value)}
                      </span>
                      <StatusChip status={e.stage} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <div className="border-t border-slate-100 pt-1.5">
                <Link href="/bd/enquiries/new" className={btn("secondary", "sm")}>
                  + New enquiry
                </Link>
              </div>
            )}
          </DashBox>
        </div>
      </div>
    </>
  );
}
