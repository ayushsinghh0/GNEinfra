# HR "Connected" Redesign — Phase 4: Production Excellence

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development, task-by-task.

**Goal:** Close every gap between "works" and "top-0.1% product": fix the visual damage evidenced in the owner's screenshots (dashboard KPI noise, broken-looking charts, duplicated data displays, payout hierarchy), make navigation feel instant, and sweep the whole module for daily-workflow papercuts before production.

**Context:** Phases 1–3 (32 tasks) delivered structure/functionality/polish, all reviewed clean. Live click-testing by the owner then exposed: (a) a frozen-state bug on payout pills — FIXED inline (`0893954`, remount key); (b) a set of real visual/UX defects captured in 13 screenshots; (c) "frontend feels slow" (dev-mode compile latency + zero navigation feedback). Phase 4 fixes all of it.

**Branch:** `hr-connected-redesign` (continues @ `0893954`).

## Global Constraints
- Gate = `npx tsc --noEmit` + `npm run lint`; **do NOT run `npm run build` or `npm run dev`** unless the owner's dev server is confirmed down (`.next` collision). Owner is live-testing — they are the smoke test; keep changes hot-reload-safe.
- No schema migration. RBAC unchanged (managers read-only; every mutation `HR_WRITE`-gated). Money integer rupees, server-recomputed.
- Soft-Wave: light mode; atmosphere only in chrome; bespoke SVG (no libs); `.nums`; 44px targets; motion `prefers-reduced-motion`-gated.
- `Charts.tsx` is shared with SCM — keep its API backward-compatible (SCM callers must not regress).

## Evidence (owner screenshots, 2026-07-02)
1. **Trends charts occupy ~55% of their card** with a huge empty left gutter; value labels clipped at the chart top ("100", "7" cut off); flat-zero series print a "0" label on every point (clutter); the payroll projection (dashed) swings absurdly upward after a data cliff — least-squares on a partial month produces nonsense.
2. **KPI band:** `Attendance rate 0% ▼-100%`, `Attrition 0 ▼-100%`, `Payroll ₹1,09,410 ▼-71%` — red panic deltas that just mean "July barely started / not fully processed". Present today 0 / On leave today 0 with no explanation (no attendance marked yet).
3. **Workforce composition renders the same data twice** (sparse gradient bar chart left + bar list right); bars are tiny islands in a sea of whitespace at n≤6 categories.
4. **Projects data appears twice** (Trends→Projects tab AND the Project-utilization card, again as near-identical bar lists).
5. **Payout:** pills were frozen (fixed); stat strip contradicts pills (`Pending 0` vs pill `Pending 2`) because stats reflect the FILTERED subset; pills float context-less; rows lack the module's Avatar/EntityLink identity language; the footer bar shows "All changes saved · Auto-split all" permanently (should appear only when there's something to act on).
6. **Perf feel:** no `loading.tsx` anywhere under `/hr` → clicking a nav item gives zero feedback until the whole RSC payload lands; PayrollEditor recomputes every row's totals on every keystroke.

---

## Task 1: Charts overhaul (`src/components/Charts.tsx` + `src/components/hr/TrendBoard.tsx`)
- **Fill the card:** the chart SVGs must stretch to their container's full width (`w-full h-auto` on the svg with `preserveAspectRatio` handling, and the wrapping layout must not center a fixed-width block in a wide card). Kill the dead left gutter seen in every Trends screenshot.
- **Stop clipping value labels:** add top headroom to the viewBox / plot scale so max-point labels render fully.
- **Label strategy:** label only first / max / last points (and today/anchor); on an ALL-ZERO series render a quiet in-chart empty state ("No data in this range") instead of a row of "0"s.
- **Projection sanity:** suppress the dashed forecast when the actuals are degenerate (fewer than 3 non-zero points, or the last actual is a partial-period cliff); a forecast that swings to the moon after a dip reads as broken.
- **MonthlyBars density:** bars should cluster with a sane max bar width + gap (centered group), not spread n=2 bars across 100% width.
- SCM callers must keep working (API additive only). Gate: tsc+lint.

## Task 2: Dashboard KPI honesty (`src/app/(erp)/hr/page.tsx`)
- **Delta discipline:** show a delta ONLY when both periods have meaningful data. Baseline 0 or current period materially incomplete → no ▼-100%/-71% badge; show a neutral "—" or contextual note instead. Payroll mid-month: label the value "so far" (or compare MTD-to-same-day-prior-month) rather than red-flagging a partial month against a full one.
- **Zero-data states:** Present today / On-leave today / Attendance-rate 0% when NO attendance rows exist for the period → show a quiet "No attendance marked yet" hint (link to /hr/attendance) instead of alarming zeros.
- Tone discipline: rose/red reserved for genuinely bad, not for "no data".

## Task 3: Kill duplicated data displays (`CompositionBoard.tsx`, `TrendBoard.tsx`, `hr/page.tsx`)
- **Workforce composition:** ONE representation. Keep the labeled horizontal `BarList` (with counts + %) and drop the sparse gradient column chart (or vice versa — pick the stronger; the bar list scales to any n). Use the reclaimed space for the dimension pills + a summary line.
- **Projects duplication:** remove the `Projects` tab from TrendBoard (it isn't a time series; the Project-utilization card already shows it) OR fold utilization into the tab — one home only.
- Rebalance the dashboard grid so cards sit at coherent heights (Leave-burn card currently mostly empty beside Project utilization).

## Task 4: Payout page hierarchy (`src/app/(erp)/hr/payout/page.tsx`, `PayrollEditor.tsx`, `PayoutViewPills.tsx`)
- **Stats always full-month:** pass server-computed full-roster aggregates (processed/pending counts, total payable) as props so the stat strip NEVER contradicts the pills; when a view filter is active show a "Showing Pending · 2 of 6" context chip next to the pills.
- **Pills placement:** move the view pills into the toolbar row with a quiet label ("View"), aligned with search — not floating alone above the stats.
- **Row identity:** employee cell uses Avatar + name + mono empId (the module's EntityLink language); keep the row's open-editor behavior; add a small "profile" affordance linking to `/hr/employees/[id]` (z-10 over the row action).
- **Footer logic:** sticky footer appears ONLY when there are unsaved changes ("N unsaved · Save all · Discard"); relocate "Auto-split all" to the table toolbar (kept behind its ConfirmDialog, `canWrite` only).
- CTC "—" cells get a tooltip/title ("No CTC on employee record").

## Task 5: Perceived performance (`src/app/(erp)/hr/**/loading.tsx`, `PayrollEditor.tsx`)
- Add `loading.tsx` skeletons for every `/hr` route segment (list-shaped skeletons reusing `Skeleton`) so every nav click paints feedback instantly — the single biggest "feels slow" fix.
- Memoize PayrollEditor per-row totals (compute per row via `useMemo`/precomputed map keyed on the row's numeric fields) so typing in one slip doesn't recompute the whole roster.
- Confirm sidebar/hub `Link`s aren't `prefetch={false}`; note (for the owner) that dev-mode Turbopack compile latency disappears in `next build`+`start`.

## Task 6: Module-wide papercut sweep (from `phase4-audit.md`)
- Execute the P0s and P1s from `D:/GNE/ERP/.superpowers/sdd/phase4-audit.md` (background audit of employees/hub/forms/attendance/assets/projects/cross-cutting). Scope-box: skip P2s unless trivial. Verify no other client component is mount-seeded under changing searchParams without a `key` (the payout-pills bug class).

## Task 7: Final QA gate
- `rm -rf .next`-safe full `npm run build` (coordinate: only when the owner's dev server is down) + lint; grep: no native dialogs, no dead imports; ledger updated; hand the owner a click-through checklist of what changed per page.

## Self-review
Evidence items 1–6 map to Tasks 1–5; the unseen-page risk is covered by Task 6's audit sweep; Task 7 gates. No schema/RBAC surface anywhere.
