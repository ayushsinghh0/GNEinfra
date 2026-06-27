# HR Analytics v2 — Predictive, Premium Dashboard

**Date:** 2026-06-28
**Branch:** `multi-role-erp`
**Status:** Design — approved verbally, pending written-spec review
**Scope:** Rewrite `/hr/analytics` into a premium dashboard with deltas, a forecast hero chart, and trend projections. Two new shared building blocks. **No schema change.**

---

## 1. Goal

Turn the HR analytics page from a flat stat list into a genuinely useful, "top 0.1%" dashboard:
headline KPIs with period-over-period **deltas**, a **payroll forecast** hero chart, workforce &
attendance **trends with projections**, project utilization, leave burn, and workforce composition.
All metrics derive from existing models (`Employee`, `AttendanceRecord`, `PayrollRecord`,
`Project`, `ProjectAssignment`) — no migration. Read-only (HR + manager + admin + superadmin);
keeps the existing `requirePageRole(HR_VIEW)` + `force-dynamic` guard. Charts stay **bespoke SVG**
(no chart/ML library); "predictive" = simple least-squares trend extrapolation, labelled as such.

---

## 2. New shared building blocks

**`src/lib/hr-forecast.ts`** (pure; client+server safe; tsx-checkable):
- `linearForecast(values: number[], periods: number): number[]` — least-squares fit `y = a + b·x`
  over indices `0..n-1`, project `x = n .. n+periods-1`, each result `Math.max(0, Math.round(·))`
  (counts/money are non-negative). `values.length < 2` ⇒ repeat the last (or 0) value.
- `pctDelta(curr: number, prev: number): number | null` — `prev === 0 ? null : ((curr-prev)/prev)*100`.
- `movingAvg(values: number[], window: number): number[]` — trailing moving average (smoothing).

**`src/components/Charts.tsx`** gains two exports (alongside the existing `AreaChart`/`Donut`):
- `ForecastArea({ data })` where `data: { label: string; value: number; forecast?: boolean }[]` —
  one continuous series; the run of points with `forecast: true` renders **dashed + lighter** with a
  vertical "now" divider at the boundary. Solid for actuals. Same bespoke `<svg>` style as `AreaChart`.
- `DeltaBadge({ value, invert })` where `value: number | null`, `invert?: boolean` — a small pill:
  `▲ +x%` emerald / `▼ −x%` rose (sign-colored; `invert` flips the colors for metrics where down is
  good); `value === null` → a muted "—".

---

## 3. The dashboard (top → bottom)

All money via `fmtINR`; `.nums` on figures; atmosphere only in the `BrandHero`.

1. **Headline KPI bento** — 6 `StatCard`s, each with a `DeltaBadge`:
   - **Active headcount** — `count(status=ACTIVE)`; delta = net change this month (joiners − leavers).
   - **Monthly payroll cost** — `sum(payableAmount)` for the current month; delta = `pctDelta` vs prev month.
   - **Attendance rate (MTD)** — `(PRESENT + 0.5·HALF_DAY) / (PRESENT+ABSENT+LEAVE+SICK+HALF_DAY)` for
     the month, as %; delta vs prev month.
   - **On leave today** — `count(LEAVE+SICK on todayUTC)` (no delta).
   - **Avg tenure** — mean of `(now − dateOfJoining)` over active employees, in years (1 dp).
   - **Attrition (this month)** — `count(leavingDate in current month)`; delta vs prev month (invert: down is good).

2. **Hero: Payroll forecast** — monthly `sum(payableAmount)` for the last 6 months (actual) +
   `linearForecast(series, 3)` (next 3 months, dashed) → `<ForecastArea>`. Caption notes the dashed
   tail is a trend projection. The page's centerpiece.

3. **Workforce trends** (two charts side-by-side):
   - **Headcount** — active headcount at each of the last 6 month-ends (`count(dateOfJoining ≤ monthEnd
     AND (leavingDate null OR leavingDate > monthEnd))`) + a 1-month `linearForecast` projection → `ForecastArea`.
   - **Attendance rate** — the monthly attendance-rate % over the last 6 months → `AreaChart`.

4. **Project utilization** — overall **utilization rate** = `distinct active-assigned employees /
   active headcount` (%); **bench** count; a brand bar list of active-assignment headcount per active
   project (active assignment = `endDate` null OR `≥ todayUTC`, AND `employee.status = "ACTIVE"`).

5. **Leave & wellbeing** — org leave **burn**: total casual taken this year vs total casual quota
   (`Σ casualLeaveQuota` over active) as a progress bar + %; same for sick. Plus the existing
   month/year LEAVE/SICK summary `StatCard`s (half-open UTC windows).

6. **Composition** — the existing headcount-by-location / designation / category brand bar lists,
   plus a **tenure distribution** (buckets 0–1y / 1–3y / 3y+ from `dateOfJoining`).

---

## 4. Data & implementation notes

- Build a 6-month label series (`["Jan".."Jun"]` short months, UTC) once; reuse for payroll, headcount,
  attendance-rate. Month windows are half-open UTC `[mStart, mEnd)` (consistent with the rest of HR).
- The page stays a single server component (`force-dynamic`); queries run in `Promise.all` batches.
  It will grow — keep the metric math in small local helpers + `hr-forecast.ts`, not one giant block.
- Forecasts are **labelled "projected (trend)"** in the UI so no one mistakes extrapolation for a promise.
- Gate = `npm run build` + `npm run lint` + a `tsx` check on `hr-forecast.ts` (`linearForecast([10,20,30],2)` ≈ `[40,50]`; `pctDelta(150,100)===50`; `pctDelta(1,0)===null`). Live-verify on the running dev server (`/hr/analytics`, seeded data).

## 5. Out of scope
Real ML/statistical libraries; configurable date ranges (fixed 6 actual + 3 forecast); per-employee
prediction; diversity metrics (no data). Bespoke trend extrapolation only.
