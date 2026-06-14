import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import {
  STAGE_LABELS,
  STAGE_TONE,
  activityPct,
  milestonePct,
  fmtCapacity,
  fmtCr,
} from "@/lib/projects";
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  StatCard,
  ProgressBar,
  EmptyState,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
  btn,
  cn,
} from "@/components/ui";
import {
  ArrowLeft,
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Layers,
  ListChecks,
  MapPin,
  Package,
  Target,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

/* ── Tab config ──────────────────────────────────────────────────────────── */
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "boq", label: "BOQ" },
  { key: "progress", label: "Progress" },
  { key: "materials", label: "Materials" },
  { key: "milestones", label: "Milestones" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const BOQ_GROUPS: { category: string; label: string }[] = [
  { category: "SUPPLY", label: "Supply" },
  { category: "SERVICE", label: "Service" },
  { category: "LINE_WORK", label: "Line Work" },
];

const MS_DOT: Record<string, string> = {
  DONE: "bg-emerald-500 ring-emerald-100",
  IN_PROGRESS: "bg-amber-500 ring-amber-100",
  PENDING: "bg-slate-300 ring-slate-100",
};

const MS_LABEL: Record<string, string> = {
  DONE: "Done",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
};

/* ── Small presentational helpers ───────────────────────────────────────── */
function StagePill({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STAGE_TONE[stage] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
      )}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700">{children}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value == null || value === "";
  return (
    <div className="flex gap-4 py-2 border-b border-slate-100 last:border-0">
      <dt className="w-40 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-slate-900 break-words">
        {empty ? <span className="font-normal text-slate-300">—</span> : value}
      </dd>
    </div>
  );
}

function CheckChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        ok
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : "bg-slate-50 text-slate-400 ring-slate-300/40"
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <CircleDashed className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const v = value.toLowerCase();
  const done = /done|complete|received|paid/.test(v);
  const wip = /wip|progress|partial|pending/.test(v);
  const tone = done
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
    : wip
      ? "bg-amber-50 text-amber-700 ring-amber-600/20"
      : "bg-slate-100 text-slate-600 ring-slate-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone
      )}
    >
      {value}
    </span>
  );
}

function fmtNum(n?: number | null) {
  return n == null ? "—" : n.toLocaleString("en-IN");
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isAdminAuthed())) return null;

  const { id } = await params;
  const { tab } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, companyName: true } },
      blocks: true,
      boqItems: { orderBy: { createdAt: "asc" } },
      activities: { include: { entries: true }, orderBy: { id: "asc" } },
      milestones: { orderBy: { sortOrder: "asc" } },
      materials: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();

  const activeTab: TabKey = TABS.some((t) => t.key === tab)
    ? (tab as TabKey)
    : "overview";

  const overallPct = milestonePct(project.milestones);
  const doneMilestones = project.milestones.filter(
    (m) => m.status === "DONE"
  ).length;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur-md">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 truncate">
            Project
          </h1>
          <span className="font-mono text-sm text-slate-400 truncate">
            {project.gneId}
          </span>
        </div>
        <Link href="/admin/projects" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
      </header>

      <div className="p-8 space-y-6">
        {/* Title block */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-sm text-slate-400">
              {project.gneId}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {project.plantName || "Untitled Plant"}
            </h2>
            <StagePill stage={project.stage} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Fact icon={<Building2 className="h-4 w-4" />} label="Client">
              {project.clientName || "—"}
            </Fact>
            <Fact icon={<Activity className="h-4 w-4" />} label="Capacity">
              {fmtCapacity(project.capacityAcMw, project.capacityDcMw)}
            </Fact>
            <Fact icon={<TrendingUp className="h-4 w-4" />} label="PO Value">
              {fmtCr(project.poValueCr)}
            </Fact>
            <Fact icon={<Layers className="h-4 w-4" />} label="Sub-partner">
              {project.vendor ? (
                <Link
                  href={`/admin/vendors/${project.vendor.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {project.subPartner || project.vendor.companyName}
                </Link>
              ) : (
                project.subPartner || "—"
              )}
            </Fact>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Overall progress"
            value={`${overallPct}%`}
            tone="emerald"
            icon={<Target className="h-[18px] w-[18px]" />}
          />
          <StatCard
            label="BOQ items"
            value={project.boqItems.length}
            tone="blue"
            icon={<ListChecks className="h-[18px] w-[18px]" />}
          />
          <StatCard
            label="Activities"
            value={project.activities.length}
            tone="amber"
            icon={<Activity className="h-[18px] w-[18px]" />}
          />
          <StatCard
            label="Materials"
            value={project.materials.length}
            tone="brand"
            icon={<Package className="h-[18px] w-[18px]" />}
          />
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 border-b border-slate-200/80">
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <Link
                key={t.key}
                href={`?tab=${t.key}`}
                className={cn(
                  "relative -mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand text-brand-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Tab: Overview ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-[18px] w-[18px] text-brand" />
                    Project Info
                  </span>
                }
              />
              <CardBody>
                <dl>
                  <Row label="GNE ID" value={<span className="font-mono">{project.gneId}</span>} />
                  <Row label="Client" value={project.clientName} />
                  <Row label="Tender ID" value={project.tenderId} />
                  <Row label="State" value={project.state} />
                  <Row label="Cluster" value={project.cluster} />
                  <Row label="EPC Scope" value={project.epcScope} />
                  <Row label="PO Number" value={project.poNumber} />
                  <Row label="PO Value" value={fmtCr(project.poValueCr)} />
                  <Row label="Start Date" value={fmtDate(project.startDate)} />
                  <Row label="Live Date" value={fmtDate(project.liveDate)} />
                  <Row label="Complete Date" value={fmtDate(project.completeDate)} />
                  <Row label="Handover Date" value={fmtDate(project.handoverDate)} />
                </dl>
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-[18px] w-[18px] text-brand" />
                      Addresses
                    </span>
                  }
                />
                <CardBody>
                  <dl>
                    <Row label="Plant Address" value={project.plantAddress} />
                    <Row label="Client Address" value={project.clientAddress} />
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <Target className="h-[18px] w-[18px] text-brand" />
                      Milestone Summary
                    </span>
                  }
                  subtitle={`${doneMilestones} of ${project.milestones.length} complete`}
                />
                <CardBody>
                  {project.milestones.length === 0 ? (
                    <p className="text-sm text-slate-400">No milestones defined.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <ProgressBar value={overallPct} tone="emerald" className="flex-1" />
                        <span className="text-sm font-semibold tabular-nums text-slate-700">
                          {overallPct}%
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {project.milestones.slice(0, 5).map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-2.5 text-sm"
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full ring-4",
                                MS_DOT[m.status] ?? MS_DOT.PENDING
                              )}
                            />
                            <span className="truncate text-slate-700">{m.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-slate-400">
                              {MS_LABEL[m.status] ?? m.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* ── Tab: BOQ ──────────────────────────────────────────────────── */}
        {activeTab === "boq" && (
          <div className="space-y-6">
            {project.boqItems.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<ListChecks className="h-6 w-6" />}
                  title="No BOQ items"
                  description="This project has no bill-of-quantities line items yet."
                />
              </Card>
            ) : (
              BOQ_GROUPS.map(({ category, label }) => {
                const items = project.boqItems.filter(
                  (b) => b.category === category
                );
                if (items.length === 0) return null;
                return (
                  <Card key={category} className="overflow-hidden">
                    <CardHeader
                      title={
                        <span className="inline-flex items-center gap-2">
                          <Chip>{label}</Chip>
                          <span className="text-slate-400">
                            {items.length} item(s)
                          </span>
                        </span>
                      }
                    />
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[8%]" />
                        <col className="w-[34%]" />
                        <col className="w-[16%]" />
                        <col className="w-[20%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead>
                        <tr className={theadRowCls}>
                          <th className={thCls}>S.No</th>
                          <th className={thCls}>Description</th>
                          <th className={thCls}>Rating</th>
                          <th className={thCls}>Spec</th>
                          <th className={thCls}>UOM</th>
                          <th className={cn(thCls, "text-right")}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((b) => (
                          <tr key={b.id} className={trCls}>
                            <td className={cn(tdCls, "text-slate-400 tabular-nums")}>
                              {b.serialNo || "—"}
                            </td>
                            <td className={cn(tdCls, "font-medium text-slate-900")}>
                              <div className="truncate" title={b.description}>
                                {b.description}
                              </div>
                              {b.section && (
                                <div className="truncate text-xs text-slate-400">
                                  {b.section}
                                </div>
                              )}
                            </td>
                            <td className={tdCls}>
                              <div className="truncate" title={b.rating ?? ""}>
                                {b.rating || "—"}
                              </div>
                            </td>
                            <td className={tdCls}>
                              <div className="truncate" title={b.specification ?? ""}>
                                {b.specification || "—"}
                              </div>
                            </td>
                            <td className={tdCls}>{b.uom || "—"}</td>
                            <td className={cn(tdCls, "text-right tabular-nums")}>
                              {fmtNum(b.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Progress ─────────────────────────────────────────────── */}
        {activeTab === "progress" && (
          <div className="space-y-4">
            {project.activities.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Activity className="h-6 w-6" />}
                  title="No activities"
                  description="No execution activities have been recorded for this project."
                />
              </Card>
            ) : (
              project.activities.map((a) => {
                const done = a.entries.reduce((s, e) => s + e.qtyDone, 0);
                const pct = activityPct(done, a.totalQty);
                const lastDpr = a.entries.reduce<Date | null>((latest, e) => {
                  return !latest || e.date > latest ? e.date : latest;
                }, null);
                return (
                  <Card key={a.id}>
                    <CardBody className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {a.activity}
                          </div>
                          {a.subActivity && (
                            <div className="text-sm text-slate-500">
                              {a.subActivity}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span className="tabular-nums font-medium text-slate-700">
                            {fmtNum(done)}
                            {a.totalQty != null && ` / ${fmtNum(a.totalQty)}`}
                          </span>
                          {a.uom && <Chip>{a.uom}</Chip>}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar
                          value={pct}
                          tone={pct >= 100 ? "emerald" : "brand"}
                          className="flex-1"
                        />
                        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {lastDpr
                          ? `Last DPR ${fmtDate(lastDpr)}`
                          : "No DPR entries yet"}
                      </div>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Materials ────────────────────────────────────────────── */}
        {activeTab === "materials" && (
          <Card className="overflow-hidden">
            {project.materials.length === 0 ? (
              <EmptyState
                icon={<Package className="h-6 w-6" />}
                title="No materials"
                description="No procurement / material items have been added yet."
              />
            ) : (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>Description</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Partner</th>
                    <th className={thCls}>UOM</th>
                    <th className={cn(thCls, "text-right")}>Approved</th>
                    <th className={cn(thCls, "text-right")}>Received</th>
                    <th className={thCls}>MRC</th>
                    <th className={thCls}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {project.materials.map((m) => (
                    <tr key={m.id} className={trCls}>
                      <td className={cn(tdCls, "font-medium text-slate-900")}>
                        <div className="truncate" title={m.description}>
                          {m.description}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <div className="truncate">{m.type || "—"}</div>
                      </td>
                      <td className={tdCls}>
                        <div className="truncate">{m.partner || "—"}</div>
                      </td>
                      <td className={tdCls}>{m.uom || "—"}</td>
                      <td className={cn(tdCls, "text-right tabular-nums")}>
                        {fmtNum(m.approvedQty)}
                      </td>
                      <td className={cn(tdCls, "text-right tabular-nums")}>
                        {fmtNum(m.receivedQty)}
                      </td>
                      <td className={tdCls}>
                        <StatusPill value={m.mrcStatus} />
                      </td>
                      <td className={tdCls}>
                        <div className="flex flex-wrap gap-1">
                          <CheckChip ok={m.drawingApproved} label="DWG" />
                          <CheckChip ok={m.poReleased} label="PO" />
                          <CheckChip ok={m.qualitySignoff} label="QA" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {/* ── Tab: Milestones ───────────────────────────────────────────── */}
        {activeTab === "milestones" && (
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Target className="h-[18px] w-[18px] text-brand" />
                  Milestones
                </span>
              }
              subtitle={`${doneMilestones} of ${project.milestones.length} complete`}
            />
            <CardBody>
              {project.milestones.length === 0 ? (
                <EmptyState
                  icon={<Target className="h-6 w-6" />}
                  title="No milestones"
                  description="No milestones have been defined for this project."
                />
              ) : (
                <ol className="relative ml-1.5 space-y-6 border-l border-slate-200 pl-6">
                  {project.milestones.map((m) => (
                    <li key={m.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4",
                          MS_DOT[m.status] ?? MS_DOT.PENDING
                        )}
                      />
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-medium text-slate-900">
                          {m.name}
                        </span>
                        {m.category && <Chip>{m.category}</Chip>}
                        <span className="text-xs text-slate-400">
                          {MS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                        <span>
                          <span className="text-slate-400">Planned: </span>
                          {fmtDate(m.plannedDate) || "—"}
                        </span>
                        <span>
                          <span className="text-slate-400">Actual: </span>
                          {fmtDate(m.actualDate) || "—"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
