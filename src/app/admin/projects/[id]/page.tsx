import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import RecordForm from "@/components/RecordForm";
import ExcelImport from "@/components/ExcelImport";
import { ALL_BOQ_SECTIONS } from "@/lib/boq-sections";
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
  Table,
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
  ClipboardCheck,
  CloudRain,
  Layers,
  ListChecks,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";

export const dynamic = "force-dynamic";

/* ── Tab config ──────────────────────────────────────────────────────────── */
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "boq", label: "BOQ" },
  { key: "progress", label: "Progress" },
  { key: "materials", label: "Materials" },
  { key: "milestones", label: "Milestones" },
  { key: "rain", label: "Rain" },
  { key: "approvals", label: "Approvals" },
  { key: "safety", label: "Safety" },
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

const RAIN_TONE: Record<string, string> = {
  LIGHT: "bg-sky-50 text-sky-700",
  MODERATE: "bg-amber-50 text-amber-700",
  HEAVY: "bg-rose-50 text-rose-700",
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
      weatherLogs: { orderBy: { date: "desc" } },
      approvals: { orderBy: { createdAt: "asc" } },
      safetyItems: { orderBy: { createdAt: "asc" } },
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
        <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200/80">
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Bill of Quantities
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/projects/${project.id}/boq/export`} className={btn("secondary", "sm")}>
                  <FileDown className="h-4 w-4" />
                  Download Excel
                </a>
                <a href={`/api/projects/${project.id}/boq/template`} className={btn("ghost", "sm")}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Template
                </a>
                <ExcelImport endpoint={`/api/projects/${project.id}/boq/import`} />
                <RecordForm
                title="Add BOQ item"
                triggerLabel="Add BOQ item"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/boq`}
                fields={[
                  {
                    name: "category",
                    label: "Category",
                    type: "select",
                    options: [
                      { value: "SUPPLY", label: "Supply" },
                      { value: "SERVICE", label: "Service" },
                      { value: "LINE_WORK", label: "Line Work" },
                    ],
                  },
                  {
                    name: "section",
                    label: "Section",
                    type: "datalist",
                    placeholder: "e.g. Modules",
                    hint: "pick or type",
                    options: ALL_BOQ_SECTIONS.map((s) => ({ value: s, label: s })),
                  },
                  {
                    name: "description",
                    label: "Description",
                    required: true,
                    span: 2,
                  },
                  { name: "rating", label: "Rating" },
                  { name: "specification", label: "Specification", span: 2 },
                  { name: "uom", label: "UOM" },
                  { name: "quantity", label: "Quantity", type: "number" },
                ]}
                />
              </div>
            </div>
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Execution Progress
              </h3>
              <RecordForm
                title="Add activity"
                triggerLabel="Add activity"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/activities`}
                fields={[
                  { name: "activity", label: "Activity", required: true, span: 2 },
                  { name: "subActivity", label: "Sub-activity", span: 2 },
                  { name: "uom", label: "UOM" },
                  { name: "totalQty", label: "Total qty", type: "number" },
                  { name: "startDate", label: "Start date", type: "date" },
                  { name: "endDate", label: "End date", type: "date" },
                ]}
              />
            </div>
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
                          <RecordForm
                            title="Log progress"
                            triggerLabel="Log progress"
                            triggerVariant="secondary"
                            triggerSize="sm"
                            endpoint={`/api/projects/${project.id}/dpr`}
                            hidden={{ activityId: a.id }}
                            fields={[
                              { name: "date", label: "Date", type: "date", required: true },
                              {
                                name: "qtyDone",
                                label: "Qty done",
                                type: "number",
                                required: true,
                              },
                              { name: "note", label: "Note", type: "textarea" },
                            ]}
                          />
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
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Materials &amp; Procurement
              </h3>
              <RecordForm
                title="Add material"
                triggerLabel="Add material"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/materials`}
                fields={[
                  { name: "description", label: "Description", required: true, span: 2 },
                  { name: "type", label: "Type" },
                  { name: "partner", label: "Partner" },
                  { name: "uom", label: "UOM" },
                  { name: "approvedQty", label: "Approved qty", type: "number" },
                  { name: "receivedQty", label: "Received qty", type: "number" },
                  { name: "receivedDate", label: "Received date", type: "date" },
                  { name: "mrcStatus", label: "MRC status" },
                  { name: "drawingApproved", label: "Drawing approved", type: "checkbox" },
                  { name: "poReleased", label: "PO released", type: "checkbox" },
                  { name: "qualitySignoff", label: "Quality signoff", type: "checkbox" },
                  { name: "remarks", label: "Remarks", type: "textarea" },
                ]}
              />
            </div>
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
          </div>
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
              action={
                <RecordForm
                  title="Add milestone"
                  triggerLabel="Add milestone"
                  triggerIcon={<Plus className="h-4 w-4" />}
                  endpoint={`/api/projects/${project.id}/milestones`}
                  fields={[
                    { name: "name", label: "Name", required: true, span: 2 },
                    { name: "category", label: "Category" },
                    { name: "plannedDate", label: "Planned date", type: "date" },
                  ]}
                />
              }
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
                        <span className="ml-auto">
                          <RecordForm
                            title="Update milestone"
                            triggerLabel="Update"
                            triggerVariant="ghost"
                            triggerSize="sm"
                            method="PATCH"
                            endpoint={`/api/projects/${project.id}/milestones`}
                            hidden={{ milestoneId: m.id }}
                            fields={[
                              {
                                name: "status",
                                label: "Status",
                                type: "select",
                                defaultValue: m.status,
                                options: [
                                  { value: "PENDING", label: "Pending" },
                                  { value: "IN_PROGRESS", label: "In Progress" },
                                  { value: "DONE", label: "Done" },
                                ],
                              },
                              { name: "actualDate", label: "Actual date", type: "date" },
                            ]}
                          />
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

        {/* ── Tab: Rain ─────────────────────────────────────────────────── */}
        {activeTab === "rain" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Rain &amp; Weather Logs
              </h3>
              <RecordForm
                title="Log rain"
                triggerLabel="Log rain"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/weather`}
                fields={[
                  { name: "date", label: "Date", type: "date", required: true },
                  {
                    name: "intensity",
                    label: "Intensity",
                    type: "select",
                    options: [
                      { value: "LIGHT", label: "Light" },
                      { value: "MODERATE", label: "Moderate" },
                      { value: "HEAVY", label: "Heavy" },
                    ],
                  },
                  { name: "fromTime", label: "From", type: "time" },
                  { name: "toTime", label: "To", type: "time" },
                  { name: "totalHours", label: "Total hours", type: "number" },
                  { name: "daysImpacted", label: "Days impacted", type: "number" },
                  { name: "note", label: "Note", type: "textarea" },
                ]}
              />
            </div>
            <Card className="overflow-hidden">
              {project.weatherLogs.length === 0 ? (
                <EmptyState
                  icon={<CloudRain className="h-6 w-6" />}
                  title="No rain logs"
                  description="No weather / rain days have been recorded yet."
                />
              ) : (
                <Table>
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Intensity</th>
                      <th className={thCls}>From</th>
                      <th className={thCls}>To</th>
                      <th className={cn(thCls, "text-right")}>Hours</th>
                      <th className={cn(thCls, "text-right")}>Days impacted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.weatherLogs.map((w) => (
                      <tr key={w.id} className={trCls}>
                        <td className={cn(tdCls, "font-medium text-slate-900")}>
                          {fmtDate(w.date)}
                        </td>
                        <td className={tdCls}>
                          <Chip className={RAIN_TONE[w.intensity]}>
                            {w.intensity}
                          </Chip>
                        </td>
                        <td className={tdCls}>{w.fromTime || "—"}</td>
                        <td className={tdCls}>{w.toTime || "—"}</td>
                        <td className={cn(tdCls, "text-right tabular-nums")}>
                          {fmtNum(w.totalHours)}
                        </td>
                        <td className={cn(tdCls, "text-right tabular-nums")}>
                          {fmtNum(w.daysImpacted)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* ── Tab: Approvals ────────────────────────────────────────────── */}
        {activeTab === "approvals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Approved Material Deliveries
              </h3>
              <RecordForm
                title="Add approval"
                triggerLabel="Add approval"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/approvals`}
                fields={[
                  { name: "item", label: "Item", required: true, span: 2 },
                  { name: "parcel", label: "Parcel" },
                  { name: "block", label: "Block" },
                  { name: "equipment", label: "Equipment" },
                  { name: "capacityUom", label: "Capacity UOM" },
                  { name: "uom", label: "UOM" },
                  { name: "requiredQty", label: "Required qty", type: "number" },
                  { name: "receivedQty", label: "Received qty", type: "number" },
                  { name: "receivedAt", label: "Received date", type: "date" },
                  { name: "note", label: "Note", type: "textarea" },
                ]}
              />
            </div>
            <Card className="overflow-hidden">
              {project.approvals.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck className="h-6 w-6" />}
                  title="No approvals"
                  description="No approved-material deliveries have been logged yet."
                />
              ) : (
                <Table>
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>Item</th>
                      <th className={thCls}>Parcel / Block</th>
                      <th className={thCls}>Equipment</th>
                      <th className={cn(thCls, "text-right")}>Required</th>
                      <th className={cn(thCls, "text-right")}>Received</th>
                      <th className={cn(thCls, "text-right")}>Balance</th>
                      <th className={thCls}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.approvals.map((ap) => {
                      const balance =
                        ap.requiredQty != null
                          ? ap.requiredQty - (ap.receivedQty ?? 0)
                          : null;
                      return (
                        <tr key={ap.id} className={trCls}>
                          <td className={cn(tdCls, "font-medium text-slate-900")}>
                            {ap.item}
                          </td>
                          <td className={tdCls}>
                            {[ap.parcel, ap.block].filter(Boolean).join(" / ") ||
                              "—"}
                          </td>
                          <td className={tdCls}>{ap.equipment || "—"}</td>
                          <td className={cn(tdCls, "text-right tabular-nums")}>
                            {fmtNum(ap.requiredQty)}
                          </td>
                          <td className={cn(tdCls, "text-right tabular-nums")}>
                            {fmtNum(ap.receivedQty)}
                          </td>
                          <td className={cn(tdCls, "text-right tabular-nums")}>
                            {fmtNum(balance)}
                          </td>
                          <td className={tdCls}>{fmtDate(ap.receivedAt) || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* ── Tab: Safety ───────────────────────────────────────────────── */}
        {activeTab === "safety" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Safety / PPE Checklist
              </h3>
              <RecordForm
                title="Add PPE item"
                triggerLabel="Add PPE item"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${project.id}/safety`}
                fields={[
                  { name: "description", label: "Description", required: true, span: 2 },
                  { name: "unit", label: "Unit" },
                  { name: "qty", label: "Qty" },
                  { name: "available", label: "Available", type: "checkbox" },
                  { name: "remarks", label: "Remarks", type: "textarea" },
                ]}
              />
            </div>
            <Card className="overflow-hidden">
              {project.safetyItems.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="h-6 w-6" />}
                  title="No PPE items"
                  description="No safety / PPE checklist items have been added yet."
                />
              ) : (
                <Table>
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Unit</th>
                      <th className={thCls}>Qty</th>
                      <th className={thCls}>Available</th>
                      <th className={thCls}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.safetyItems.map((s) => (
                      <tr key={s.id} className={trCls}>
                        <td className={cn(tdCls, "font-medium text-slate-900")}>
                          {s.description}
                        </td>
                        <td className={tdCls}>{s.unit || "—"}</td>
                        <td className={tdCls}>{s.qty || "—"}</td>
                        <td className={tdCls}>
                          <CheckChip ok={s.available} label={s.available ? "Yes" : "No"} />
                        </td>
                        <td className={tdCls}>
                          <div className="truncate" title={s.remarks ?? ""}>
                            {s.remarks || "—"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
