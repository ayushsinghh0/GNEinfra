# HR Analytics v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `/hr/analytics` into a premium dashboard with period-over-period deltas, a payroll-forecast hero chart, trend projections, project utilization, leave burn, and a tenure distribution.

**Architecture:** One pure helper (`hr-forecast.ts`, least-squares trend), two bespoke SVG additions to `Charts.tsx` (`ForecastArea` + `DeltaBadge`), then a single-file rewrite of the analytics server component. No schema change; all metrics derive from existing models.

**Tech Stack:** Next.js 16 (App Router, `force-dynamic`), Prisma 6, Tailwind v4 "Soft Wave", bespoke SVG charts. No new dependencies.

## Global Constraints

- **No new dependencies.** Charts are bespoke SVG (no chart/ML library). "Predictive" = least-squares linear-trend extrapolation, labelled "projected (trend)" in the UI.
- Page stays a server component: `export const dynamic = "force-dynamic"` + `await requirePageRole(HR_VIEW)` (read-only — HR + manager + admin + superadmin). No mutate controls.
- **Money = integer rupees**, formatted with `fmtINR` from `@/lib/format`.
- **UTC half-open month windows** `[mStart, mEnd)` everywhere (consistent with the rest of HR).
- Forecasts non-negative: `linearForecast` rounds + clamps at 0.
- Design system: compose `ui.tsx` (`StatCard`, `Card`, `CardHeader`, `CardBody`, `ProgressBar`) + `chrome.tsx` (`BrandHero`) + `Charts.tsx`; light mode; atmosphere only in `BrandHero`; `.nums` on figures; NO vendor-colored `Donut`/`StatusBars`.
- **No test runner.** Gate = `npm run build` + `npm run lint`, plus an `npx tsx` check on `hr-forecast.ts`. A dev server can live-verify `/hr/analytics`.
- **Spec:** `docs/superpowers/specs/2026-06-28-hr-analytics-v2-design.md`.

---

## Task 1: Forecast helper

**Files:** Create `src/lib/hr-forecast.ts`

**Interfaces — Produces:** `linearForecast(values: number[], periods: number): number[]`; `pctDelta(curr: number, prev: number): number | null`; `movingAvg(values: number[], window: number): number[]`.

- [ ] **Step 1: Write `src/lib/hr-forecast.ts`:**
```ts
// Bespoke trend helpers (no ML/stat library). Plain numbers in/out.

// Least-squares linear regression over indices 0..n-1, projected forward `periods`
// steps. Results rounded + clamped at 0 (counts/money can't be negative).
export function linearForecast(values: number[], periods: number): number[] {
  const p = Math.max(0, Math.floor(periods));
  const n = values.length;
  if (p === 0) return [];
  if (n === 0) return Array(p).fill(0);
  if (n === 1) return Array(p).fill(Math.max(0, Math.round(values[0])));
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += values[i]; sxx += i * i; sxy += i * values[i]; }
  const denom = n * sxx - sx * sx;
  const b = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  const out: number[] = [];
  for (let k = 1; k <= p; k++) out.push(Math.max(0, Math.round(a + b * (n - 1 + k))));
  return out;
}

// Percent change curr vs prev; null when prev is 0 (no baseline).
export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// Trailing moving average over a window.
export function movingAvg(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}
```

- [ ] **Step 2: Runtime check (tsx):**
```bash
npx tsx -e "import('./src/lib/hr-forecast.ts').then(m => { console.log(JSON.stringify(m.linearForecast([10,20,30],2))); console.log(m.pctDelta(150,100), m.pctDelta(1,0)); console.log(JSON.stringify(m.linearForecast([5],3))); })"
# Expect: [40,50]   50 null   [5,5,5]
```

- [ ] **Step 3: Verify + commit.**
```bash
npm run build && npm run lint
git add src/lib/hr-forecast.ts
git commit -m "feat(hr): linear-trend forecast helpers"
```

---

## Task 2: Chart components — ForecastArea + DeltaBadge

**Files:** Modify `src/components/Charts.tsx` (append two exports; the private `smoothPath` already in the file is reused)

**Interfaces — Produces:** `ForecastArea({ data }: { data: { label: string; value: number; forecast?: boolean }[] })`; `DeltaBadge({ value, invert }: { value: number | null; invert?: boolean })`.

- [ ] **Step 1: Append to `src/components/Charts.tsx`** (after the existing `AreaChart`, so `smoothPath` is in scope):
```tsx
/* ── Trend + forecast area (actuals solid, forecast dashed) ─────────────── */
export function ForecastArea({
  data,
}: {
  data: { label: string; value: number; forecast?: boolean }[];
}) {
  const W = 560, H = 220;
  const pad = { l: 12, r: 12, t: 20, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const baseY = pad.t + innerH;
  const pts = data.map((d, i) => ({
    x: pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + innerH - (d.value / max) * innerH,
    label: d.label, value: d.value, forecast: !!d.forecast,
  }));
  const fi = pts.findIndex((p) => p.forecast);
  const actual = fi === -1 ? pts : pts.slice(0, fi);
  const forecast = fi === -1 ? [] : pts.slice(fi - 1); // start at last actual to connect
  const actualLine = smoothPath(actual);
  const actualArea = actual.length
    ? `${actualLine} L${actual[actual.length - 1].x},${baseY} L${actual[0].x},${baseY} Z`
    : "";
  const forecastLine = smoothPath(forecast);
  const grids = [0, 0.25, 0.5, 0.75].map((f) => pad.t + innerH * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="Trend with forecast">
      <defs>
        <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fcLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      {grids.map((y, i) => (
        <line key={i} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#eef2f6" strokeWidth="1" />
      ))}
      <line x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />
      {actualArea && <path className="animate-fade-up" d={actualArea} fill="url(#fcFill)" />}
      {actualLine && (
        <path d={actualLine} fill="none" stroke="url(#fcLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {forecastLine && (
        <path d={forecastLine} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {fi > 0 && (
        <line x1={pts[fi - 1].x} y1={pad.t} x2={pts[fi - 1].x} y2={baseY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={p.forecast ? "#94a3b8" : "#0d9488"} strokeWidth="2" />
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill={p.forecast ? "#94a3b8" : "#64748b"}>
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Delta badge (period-over-period change) ────────────────────────────── */
export function DeltaBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
        —
      </span>
    );
  }
  const rounded = Math.round(value);
  const up = value >= 0;
  const good = invert ? !up : up;
  const cls =
    rounded === 0 ? "bg-slate-100 text-slate-500" : good ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
  const arrow = rounded === 0 ? "" : up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {arrow} {up ? "+" : ""}{rounded}%
    </span>
  );
}
```

- [ ] **Step 2: Verify + commit.**
```bash
npm run build && npm run lint
git add src/components/Charts.tsx
git commit -m "feat(charts): ForecastArea + DeltaBadge (bespoke SVG)"
```

---

## Task 3: Analytics page rewrite

**Files:** Modify (full rewrite) `src/app/(erp)/hr/analytics/page.tsx`

**Interfaces — Consumes:** `linearForecast`/`pctDelta` (`@/lib/hr-forecast`), `ForecastArea`/`DeltaBadge`/`AreaChart` (`@/components/Charts`), `fmtINR` (`@/lib/format`), `requirePageRole`/`HR_VIEW`, `BrandHero`, `StatCard`/`Card`/`CardHeader`/`CardBody`/`ProgressBar`.

- [ ] **Step 1: Replace the entire contents of `src/app/(erp)/hr/analytics/page.tsx` with:**
```tsx
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody, ProgressBar } from "@/components/ui";
import { AreaChart, ForecastArea, DeltaBadge } from "@/components/Charts";
import { linearForecast, pctDelta } from "@/lib/hr-forecast";

export const dynamic = "force-dynamic";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Bar = { label: string; count: number };
function BarList({ rows, empty }: { rows: Bar[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{row.label}</span>
            <span className="nums ml-2 font-medium text-slate-700">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HrAnalyticsPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const Y = today.getUTCFullYear();
  const Mo = today.getUTCMonth() + 1;

  // last 6 months (oldest first) + UTC windows
  const periods: { year: number; month: number; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = Mo - i, y = Y;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push({ year: y, month: m, label: SHORT_MONTHS[m - 1], start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  const fLabels: string[] = [];
  for (let i = 1; i <= 3; i++) { let m = Mo + i, y = Y; while (m > 12) { m -= 12; y += 1; } fLabels.push(SHORT_MONTHS[m - 1]); }
  const cur = periods[5], prev = periods[4];

  const [activeCount, byLocation, byDesignation, byEmpCategory, laptopsAllocated, activeEmployees] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employeeAsset.count({ where: { hasLaptop: true, returnedAt: null } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true, casualLeaveQuota: true, sickLeaveQuota: true } }),
  ]);

  // payroll series (6) → forecast 3
  const payrollSeries = await Promise.all(periods.map((p) =>
    prisma.payrollRecord.aggregate({ where: { periodYear: p.year, periodMonth: p.month }, _sum: { payableAmount: true } }).then((r) => r._sum.payableAmount ?? 0)));
  const payrollForecast = linearForecast(payrollSeries, 3);
  const payrollChart = [
    ...periods.map((p, i) => ({ label: p.label, value: payrollSeries[i], forecast: false })),
    ...payrollForecast.map((v, i) => ({ label: fLabels[i], value: v, forecast: true })),
  ];
  const costDelta = pctDelta(payrollSeries[5], payrollSeries[4]);

  // headcount at each month-end (6) → forecast 1
  const headcountSeries = await Promise.all(periods.map((p) =>
    prisma.employee.count({ where: { dateOfJoining: { lt: p.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: p.end } }] } })));
  const headcountChart = [
    ...periods.map((p, i) => ({ label: p.label, value: headcountSeries[i], forecast: false })),
    { label: fLabels[0], value: linearForecast(headcountSeries, 1)[0], forecast: true },
  ];

  // attendance rate per month (6)
  const attRateSeries = await Promise.all(periods.map(async (p) => {
    const g = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: { gte: p.start, lt: p.end } }, _count: { _all: true } });
    const c = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
    const worked = c("PRESENT") + c("ABSENT") + c("LEAVE") + c("SICK") + c("HALF_DAY");
    return worked ? Math.round(((c("PRESENT") + 0.5 * c("HALF_DAY")) / worked) * 100) : 0;
  }));
  const attRateChart = periods.map((p, i) => ({ label: p.label, value: attRateSeries[i] }));
  const attRateDelta = pctDelta(attRateSeries[5], attRateSeries[4]);

  // today's leave + joiners/leavers + attrition delta
  const [onLeaveToday, joinersCur, leaversCur, leaversPrev] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: { in: ["LEAVE", "SICK"] }, date: todayUTC } }),
    prisma.employee.count({ where: { dateOfJoining: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: prev.start, lt: prev.end } } }),
  ]);
  const netHeadcountChange = joinersCur - leaversCur;
  const attritionDelta = pctDelta(leaversCur, leaversPrev);

  // tenure (years) over active
  const now = todayUTC.getTime();
  const tenures = activeEmployees.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // leave burn (org) + summary
  const totalCasualQuota = activeEmployees.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = activeEmployees.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));
  const [casualYear, sickYear, leaveMonth, sickMonth] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: cur.start, lt: cur.end } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: cur.start, lt: cur.end } } }),
  ]);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;

  // project utilization
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] } } } } },
    orderBy: { name: "asc" },
  });
  const assigned = await prisma.projectAssignment.findMany({ where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] }, select: { employeeId: true }, distinct: ["employeeId"] });
  const benchCount = Math.max(0, activeCount - assigned.length);
  const utilization = activeCount ? Math.round((assigned.length / activeCount) * 100) : 0;

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));
  const projectBars = projects.map((p) => ({ label: p.name, count: p._count.assignments }));

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Analytics" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="space-y-8 p-6 sm:p-8">

        {/* KPI bento with deltas */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label="Active headcount"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{activeCount}</span><DeltaBadge value={netHeadcountChange === 0 ? 0 : (netHeadcountChange > 0 ? 100 : -100)} /></span>} />
          <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label="Payroll this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{fmtINR(payrollSeries[5])}</span><DeltaBadge value={costDelta} /></span>} />
          <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label="Attendance rate (MTD)"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{attRateSeries[5]}%</span><DeltaBadge value={attRateDelta} /></span>} />
          <StatCard tone="amber" icon={<Clock className="h-4 w-4" />} label="On leave today" value={onLeaveToday} />
          <StatCard tone="slate" icon={<Clock className="h-4 w-4" />} label="Avg tenure" value={`${avgTenure.toFixed(1)} yrs`} />
          <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label="Attrition this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span><DeltaBadge value={attritionDelta} invert /></span>} />
        </div>

        {/* Hero: payroll forecast */}
        <Card>
          <CardHeader title="Payroll cost — actual & forecast" subtitle="Last 6 months (solid) · next 3 months projected (dashed, trend)" />
          <CardBody><ForecastArea data={payrollChart} /></CardBody>
        </Card>

        {/* Workforce trends */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Headcount trend" subtitle="Active staff at each month-end · next month projected" />
            <CardBody><ForecastArea data={headcountChart} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Attendance rate" subtitle="Monthly present-equivalent %, last 6 months" />
            <CardBody><AreaChart data={attRateChart} /></CardBody>
          </Card>
        </div>

        {/* Project utilization */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard tone="brand" icon={<FolderKanban className="h-4 w-4" />} label="Utilization" value={`${utilization}%`} spark={utilization} />
            <StatCard tone="amber" label="On the bench" value={benchCount} />
            <StatCard tone="slate" label="Active projects" value={projects.length} />
          </div>
          <Card>
            <CardHeader title="Project allocation" subtitle="Active assignments per project (today)" />
            <CardBody><BarList rows={projectBars} empty="No active projects." /></CardBody>
          </Card>
        </div>

        {/* Leave & wellbeing */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Leave burn (this year)" subtitle="Days taken vs total annual quota" />
            <CardBody className="space-y-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Casual leave</span>
                  <span className="nums text-slate-700">{casualYear} / {totalCasualQuota} <span className="text-slate-400">({casualBurn}%)</span></span>
                </div>
                <ProgressBar value={casualBurn} tone="amber" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Sick leave</span>
                  <span className="nums text-slate-700">{sickYear} / {totalSickQuota} <span className="text-slate-400">({sickBurn}%)</span></span>
                </div>
                <ProgressBar value={sickBurn} tone="brand" />
              </div>
            </CardBody>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <StatCard tone="amber" label="Leaves this month" value={leaveMonth} />
            <StatCard tone="brand" label="Sick this month" value={sickMonth} />
            <StatCard tone="amber" label="Leaves this year" value={casualYear} />
            <StatCard tone="brand" label="Sick this year" value={sickYear} />
          </div>
        </div>

        {/* Composition */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader title="By location" subtitle="Active" /><CardBody><BarList rows={locationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By designation" subtitle="Active" /><CardBody><BarList rows={designationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By category" subtitle="Active" /><CardBody><BarList rows={categoryBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By tenure" subtitle="Active" /><CardBody><BarList rows={tenureBars} empty="No data yet." /></CardBody></Card>
        </div>

        <p className="text-center text-[11px] text-slate-400">Dashed/“projected” values are trend extrapolations, not guarantees · {laptopsAllocated} laptops allocated</p>
      </div>
    </>
  );
}
```

> Note on the "Active headcount" delta: there's no true prior-month headcount snapshot to `pctDelta` against, so the badge encodes the **direction** of this month's net change (joiners − leavers) — `0`/`+`/`−`. The numeric net change is conveyed; an exact % would be misleading without a baseline. Keep as-is.

- [ ] **Step 2: Verify + commit.**
```bash
npm run build && npm run lint
git add "src/app/(erp)/hr/analytics/page.tsx"
git commit -m "feat(hr): analytics v2 — KPI deltas, payroll/headcount forecasts, utilization, leave burn, tenure"
```

---

## Self-Review (completed during planning)

**Spec coverage** — §2 forecast helper → T1; §2 ForecastArea/DeltaBadge → T2; §3 dashboard (KPI bento+deltas, payroll forecast hero, headcount+attendance trends, project utilization+bench, leave burn, composition+tenure) → T3; §4 UTC half-open windows + `fmtINR` + bespoke charts + "projected" labelling → T3; gate (tsx + build + lint) → each task.

**Placeholder scan** — no "TBD/TODO"; T1/T2/T3 all carry complete code. The only prose note (headcount-delta direction) documents a deliberate metric choice, not a gap.

**Type consistency** — `linearForecast`/`pctDelta` (T1) consumed by name in T3; `ForecastArea` data shape `{label,value,forecast?}` and `DeltaBadge` `{value: number|null, invert?}` (T2) are produced exactly as T3 consumes them; `BarList` is a single local helper (de-duplicates the 5 bar lists the old page repeated). All money via `fmtINR`; all month windows half-open UTC.
