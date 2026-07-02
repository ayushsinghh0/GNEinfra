# HR "Connected" Redesign — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** The consistency / polish / accessibility sweep that finishes the module — replace jarring native `confirm/alert` with the design-system dialogs, clean up the accumulated deferred minors, add dashboard streaming + a reference-month + responsive charts, and give the attendance grid real keyboard accessibility.

**Architecture:** Purely additive/refactoring polish on top of Phases 1–2. Reuse existing primitives (`ConfirmDialog`, `toast`/`Toaster`, `EmptyState`, `Skeleton`, `MonthPicker`, `StatusChip`). No new features, no new entities.

**Tech Stack:** Next.js 16 (App Router; `Suspense` streaming), React 19, TypeScript, Tailwind v4, Prisma 6, lucide-react. No new dependencies.

**Branch:** `hr-connected-redesign` (continues from Phase 2 @ `d09c2d3`).

## Global Constraints

- **No test runner.** Gate = `npx tsc --noEmit` + `npm run lint` + `npm run build`. **Do NOT run `npm run dev`** (a prior dev+build `.next` collision wedged the server; keep `.next` clean — `rm -rf .next` + rebuild if a build ever wedges). Live smoke deferred; verify by build + reasoning + `tsx` for any pure logic.
- **No schema migration** anywhere in Phase 3.
- **RBAC unchanged.** `requirePageRole(HR_VIEW)`; `canWrite = HR_WRITE.includes(role)` gates every mutate control in UI + API; managers read-only. Any dialog/toast wrapping a mutation stays behind the existing `canWrite`/HR_WRITE guard — do not widen access.
- **Soft-Wave:** light mode; atmosphere only in chrome; bespoke SVG (no chart libs); `.nums`; 44px targets; `:focus-visible` rings; motion gated on `prefers-reduced-motion` (`motion-safe:*` / `motion-reduce:*`).
- **Shared-file caution:** `Charts.tsx` and `ui.tsx` are used by SCM/vendor pages too — keep changes additive/backward-compatible and verify no `/scm` regression (the `AreaChart` `ariaLabel` change must keep the SCM caller working — it passes its own label).

---

## File Structure
Modified only (no new routes/entities): `src/components/hr/AssetRowActions.tsx`, `RemoveAssignmentButton.tsx`, `AttendanceGrid.tsx`, `AttendanceCalendar.tsx`, `MonthPicker.tsx`, `PayrollEditor.tsx`, `EmployeeForm.tsx`; `src/app/(erp)/hr/page.tsx`, `employees/page.tsx`; `src/components/Charts.tsx`, `ui.tsx`, `SavedViewPills.tsx`; `src/app/api/hr/assignments/route.ts`; delete `src/components/hr/TabbedSections.tsx`.

---

## Task 1: Native `confirm/alert` → `ConfirmDialog` + `toast` (+ icon a11y)

**Files:** `src/components/hr/AssetRowActions.tsx`, `src/components/hr/RemoveAssignmentButton.tsx`, `src/components/hr/AttendanceGrid.tsx`. (Reference `src/components/ConfirmDialog.tsx` + `src/components/Toast.tsx` for the APIs — `ConfirmDialog` props incl. `open/onClose/onConfirm/title/confirmLabel/danger?/busy?`; `toast(msg, "success"|"error"|"info")`.)

- [ ] **Step 1: AssetRowActions.** Replace `if (!confirm("Delete this asset record?..."))` with a `ConfirmDialog` (danger, `busy` during the request); replace both `alert("Could not update return status.")` / `alert("Could not delete...")` with `toast(msg, "error")`; add a success `toast` on delete/return. Add `aria-label` to the icon-only action buttons (they only have `title`). Keep the existing `canWrite` gating + `router.refresh()`.
- [ ] **Step 2: RemoveAssignmentButton.** Replace `confirm("Remove this project assignment?")` with a `ConfirmDialog` (danger), and the `alert(err…)` with `toast(err, "error")`; success `toast` on remove. Add `aria-label` to the icon-only (X) button. Keep `canWrite`.
- [ ] **Step 3: AttendanceGrid save feedback.** Replace `catch { alert("Could not save attendance.") }` with `toast("Could not save attendance.", "error")`; add a success `toast("Attendance saved","success")` after a successful save. (Do NOT touch the save payload/logic — Phase-1 verified it.)
- [ ] **Step 4: Verify + commit.** `tsc --noEmit` + `lint` + `build` green. `git commit -m "polish(hr): replace native confirm/alert with ConfirmDialog + toast; icon aria-labels"`

Note: leave the shared `src/components/DeleteButton.tsx` (cross-department; not in HR scope, and appears unused by HR pages).

## Task 2: Consistency cleanup + deferred-minor roll-up

**Files:** delete `src/components/hr/TabbedSections.tsx`; modify `src/components/ui.tsx` (StatCard), `src/components/hr/PayrollEditor.tsx`, `src/app/api/hr/assignments/route.ts`, `src/components/hr/SavedViewPills.tsx`, `src/app/(erp)/hr/employees/page.tsx`, `src/components/hr/EmployeeForm.tsx`.

- [ ] **Step 1: Delete dead code.** Confirm `TabbedSections.tsx` has no importers (`grep -rl TabbedSections src` → only itself), then delete it.
- [ ] **Step 2: StatCard `href` scope-creep.** In `ui.tsx`, the `href` branch got `"w-full text-left"` in Phase 2 (only `onClick` needs it). Restrict `"w-full text-left"` to the `onClick`/button branch so the `href`/`<Link>` branch is byte-identical to its Phase-1 form (`"block"` only).
- [ ] **Step 3: PayrollEditor defense-in-depth.** Gate the auto-split `ConfirmDialog` with `open={canWrite && confirmSplitAll}` (it's already inert for MANAGER, but make the guard structural).
- [ ] **Step 4: Allocation aggregate in try.** In `assignments/route.ts`, move the `prisma.projectAssignment.aggregate(...)` allocation check INSIDE the existing `try {}` around create, so a transient DB error on the aggregate returns the friendly `500 {error}` path (not a raw unhandled throw). Keep the 409 over-allocation + P2002 + RBAC logic identical.
- [ ] **Step 5: SavedViewPills type.** Tighten `preserve?: string[]` → `preserve?: (keyof ParsedListParams)[]` and `param?: keyof ParsedListParams` (import the type from `@/lib/hr-filters`) so a non-`buildQuery`-whitelisted key is a compile error, not a silent drop.
- [ ] **Step 6: Employees mobile Status.** Add `cardLabel: "Status"` to the Status column config in `employees/page.tsx` so the status chip shows on mobile cards (the DataTable card-fallback drops cardLabel-less columns).
- [ ] **Step 7: Money input affordance.** In `EmployeeForm.tsx` (and `PayrollEditor.tsx` money fields if they're plain text), add `inputMode="numeric"` to the integer-rupee inputs (better mobile keyboard; no logic change).
- [ ] **Step 8: Verify + commit.** `tsc` + `lint` (`rm -rf .next` if a stale route cache complains about the deleted component) + `build` green. `git commit -m "polish(hr): cleanup — drop dead TabbedSections, StatCard href, allocation try, SavedViewPills types, mobile Status, numeric inputs"`

## Task 3: Dashboard streaming + chart polish

**Files:** `src/app/(erp)/hr/page.tsx`, `src/components/Charts.tsx`.

- [ ] **Step 1: Stream the heavy aggregations.** `hr/page.tsx` awaits a large batch of Prisma queries (incl. 12× monthly groupBy) before rendering anything and has NO `Suspense`. Wrap the heavy sections (the TrendBoard/analytics band + composition band) in `<Suspense>` with `Skeleton` fallbacks, extracting each into an async server sub-component so the KPI band paints before the 12-month aggregation finishes. Keep the queries/results identical (only the render structure changes).
- [ ] **Step 2: Fix the vendor-copy ariaLabel.** In `Charts.tsx`, change `AreaChart`'s default `ariaLabel` from `"New vendor registrations over the last 6 months"` to a neutral default (e.g. `"Trend chart"`) — HR callers already pass their own label; the SCM caller must keep working (it also passes its own, or now gets the neutral default). Verify no `/scm` regression.
- [ ] **Step 3: Responsive x-axis labels + real 0.** In the SVG charts (`AreaChart`/`ForecastArea`/`MonthlyBars`), thin the x-axis labels at narrow widths (e.g. render every other month under a width threshold) so 12–13 labels don't collide on phones; render an explicit `0` for genuine zero data points (distinct from a missing/unlabelled point). Bespoke SVG only.
- [ ] **Step 4: Verify + commit.** `tsc` + `lint` + `build` green; confirm the dashboard route still builds and SCM charts compile. `git commit -m "polish(hr): dashboard Suspense/Skeleton streaming + neutral chart ariaLabel + responsive labels/real-zero"`

## Task 4: Dashboard reference-month picker

**Files:** `src/app/(erp)/hr/page.tsx` (+ reuse `src/components/hr/MonthPicker.tsx`).

- [ ] **Step 1: Reference-month searchParam.** Add optional `year`/`month` `searchParams` to `hr/page.tsx` (default = current UTC month). Thread the selected reference month through the "as-of" computations so the KPIs + TrendBoard anchor to it (the 12-month trend window ends at the reference month; "today"-based metrics like present/on-leave stay today, or become "as of the reference month" where that's meaningful — pick per metric and keep it coherent). Render a `MonthPicker` (basePath `/hr`) in the dashboard hero/header. `requirePageRole(HR_VIEW)` unchanged; read-only.
- [ ] **Step 2: Verify + commit.** `tsc` + `lint` + `build` green. `git commit -m "feat(hr): dashboard reference-month picker (re-anchors KPIs + trends)"`

(If Step 1 proves too invasive to keep every metric coherent, scope it down to re-anchoring ONLY the trend window + payroll/attrition KPIs and leave "today" metrics as today — report the decision.)

## Task 5: Attendance grid keyboard accessibility

**Files:** `src/components/hr/AttendanceCalendar.tsx`, `src/components/hr/AttendanceGrid.tsx`, `src/components/hr/MonthPicker.tsx`.

- [ ] **Step 1: Roving-tabindex + keyboard paint on the calendar.** In `AttendanceCalendar` (the default view), make the day cells keyboard-operable: a roving `tabIndex` (one cell tabbable at a time, arrow keys move focus across the grid), and `Enter`/`Space` applies the current brush (same as a pointer click) when interactive — closing the pre-existing "pointer-only paint" gap. Keep drag-to-paint working. Gate paint on `canWrite`.
- [ ] **Step 2: Matrix header semantics.** In the `AttendanceGrid` table (the opt-in "Table" view), add `scope="col"` to day headers and `scope="row"` to the employee identity cell so screen readers announce the day/employee for each cell.
- [ ] **Step 3: MonthPicker niceties.** Add a "This month" quick-reset and Left/Right arrow-key month scrubbing (when focus isn't in a text input) to `MonthPicker`, prefetching prev/next via `<Link prefetch>`.
- [ ] **Step 4: Verify + commit.** `tsc` + `lint` + `build` green; reason about the roving-tabindex focus model. `git commit -m "a11y(hr): keyboard navigation + paint on attendance calendar; scope headers; MonthPicker arrow-keys"`

---

## Phase 3 completion gate
- [ ] `npm run lint` clean; `npm run build` passes. No native `window.confirm`/`window.alert` remain in HR components (`grep`); no dead `TabbedSections`.
- [ ] No `/scm` regression from the shared `Charts.tsx`/`ui.tsx` edits (build + a spot-check that SCM callers pass their own props).
- [ ] After Phase 3: dispatch a final whole-branch review (most-capable model) over the full `hr-connected-redesign` range, then use `superpowers:finishing-a-development-branch`.

## Self-review (spec coverage)
- P3.1 native dialogs → Task 1 ✓. P3.2 empty/boolean/money + roll-up minors → Task 2 ✓. P3.3 dashboard streaming + ariaLabel + responsive charts + reference-month → Tasks 3–4 ✓. P3.4 grid a11y + MonthPicker → Task 5 ✓.
- No schema migration; RBAC unchanged; shared-file edits kept backward-compatible.
