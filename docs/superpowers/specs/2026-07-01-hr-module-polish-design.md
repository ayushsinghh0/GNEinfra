# HR Module Polish — Design Spec

**Date:** 2026-07-01
**Branch:** `multi-role-erp`
**Scope:** Six workstreams across the HR module, built bug-first.

## Context & corrected premises

Exploration found two requested items **already shipped** — no work needed:
- The employee add/edit form already exposes Emergency No., Blood Group, Offer Letter date, Total CTC, Salary, LTA, Special Allowance, Conveyance (in `EmployeeForm.tsx`, the Zod `employeeSchema`, and edit-prefill). Only `status` is absent from the write path — used by W4.
- The payslip already supports custom line items end-to-end (`extraLines` "Custom items" editor → validated → folded into totals → printed).

## Global constraints

- **Soft-Wave guardrails:** light-mode only; atmosphere only in chrome; motion gated on `prefers-reduced-motion`; `.nums` on codes/money/dates/%/counts; compose existing primitives (`Segmented`, `StatCard`, `Card`, `Chip`, `ProgressBar`, `Charts.tsx`); no new chart/animation libraries; 44px tap targets; `:focus-visible` rings.
- **RBAC unchanged:** every page `requirePageRole(HR_VIEW)`; `canWrite = HR_WRITE.includes(role)` gates all mutations (managers read-only) — in UI AND every mutating API. New endpoints reject `MANAGER` and `mustChangePassword`.
- **Migrations:** only W4 needs the write path to accept `status` — done at the **application layer** (Zod + a new endpoint). **No Prisma schema change** (the `status` column + `EmployeeStatus` enum + `leavingDate` already exist).
- **Verification gates (no test runner):** `npm run lint` + `npm run build` (type-check) both pass per workstream; runtime smoke (no 500); adversarial review on the riskier ones.

---

## W1 — Attendance month bug (data corruption · URGENT)

**Root cause (verified):** `AttendanceGrid` seeds its `grid` state from `initialGrid` **only at mount** (`AttendanceGrid.tsx:53`); there is no resync effect, and `attendance/page.tsx:97` mounts the grid **without a month-based `key`**. Month change is a soft client nav, so React keeps the same instance and its stale state. Cells render from stale `grid` (`:281`), and **Save sends the stale marks with the new `year`/`month`** (`:124-139` → API `route.ts:18`), writing them onto the wrong month's dates.

**Fix (minimal, correct):** In `attendance/page.tsx`, render
```tsx
<AttendanceGrid key={`${y}-${m}`} employees={employees} initial={initial} year={y} month={m} daysInMonth={daysInMonth} canWrite={canWrite} />
```
The `key` forces a fresh remount per month → `useState(initialGrid)` re-runs with the correct month's data; display and Save are both correct because only one month's state exists per mount. The day-only cell key (`emp:day`) is then safe (no cross-month collision possible within a single mount). Switching months discards unsaved edits — the safe, expected behavior (vs. today's silent wrong-month write).

**Files:** Modify `src/app/(erp)/hr/attendance/page.tsx` (one line).

---

## W2 — Attendance UX (pills, no-scroll)

**Problem:** the grid lists every active employee × every day; the existing per-employee pills (`AttendanceGrid.tsx:230-245`) **scroll** you down to a row — so you still scroll a lot.

**Change:** turn those scroll-to pills into **filter pills**. A `Segmented`-style row of employee pills (plus an "All" pill) sets a `selectedEmp` state; the grid's existing `filtered` memo (`:141-145`) also filters on `selectedEmp` so clicking a pill shows **only that employee's row** — no scroll. When one employee is selected, show a compact per-employee summary strip (their P / A / L / Sick / Half / Holiday / Week-off tallies for the month, reusing the `tally()` helper) above the grid. Keep the search box (it narrows which pills show). The brush legend, drag-paint, save bar are unchanged.

**Files:** Modify `src/components/hr/AttendanceGrid.tsx` — add `selectedEmp` state, fold it into `filtered`, replace the jump-pills block with filter pills + a selected-employee summary; drop the now-unused `jumpTo`/`rowRefs`/`flashId` scroll machinery.

---

## W3 — Employee detail: scroll-spy → real tabs

**Problem:** `[id]/page.tsx` renders `SectionNav` (a scroll-spy: `scrollIntoView` on click) over **seven stacked `<Card>` sections** — clicking a pill scrolls the page down.

**Change:** a new client component `TabbedSections` replaces `SectionNav` **on the employee detail page only** (other consumers of `SectionNav`, if any, keep it). It receives `tabs: { id, label, panel: ReactNode }[]` where each `panel` is the server-rendered section (server components passed as props to a client component — supported in App Router; all data is already fetched once in the page's `Promise.all`). It renders a pill tablist (reusing the existing pill styling, `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, arrow-key support) and shows **only the active panel**. Switching is instant client-side show/hide; no scroll, no refetch.

The page wraps each of its 7 sections as a `panel`. The `scroll-mt-24` wrappers and `id="sec-*"` anchors are removed (no longer scrolled to).

**Files:** Create `src/components/hr/TabbedSections.tsx`; modify `src/app/(erp)/hr/employees/[id]/page.tsx` to use it.

---

## W4 — Mark-as-leaving + confirmations (+ two reusable primitives)

**Decisions:** dedicated action + date picker + confirm (reversible via Reactivate); confirm dialog **before** + success toast **after**.

### New reusable primitives
- **`ConfirmDialog`** (`src/components/ui/ConfirmDialog.tsx`, client): a focus-trapped modal (title, message, optional `children` for extra fields e.g. a date, Cancel + Confirm buttons, `variant` for danger). Backdrop, `Esc` to close, `prefers-reduced-motion` aware. Portal via `createPortal`.
- **Toast** (`src/components/ui/toast.tsx`, client): a module-level store via `useSyncExternalStore` + a `<Toaster/>` mounted once in the `(erp)` layout (layouts persist across child navigations, so toasts survive the post-add redirect) + a `toast(message, tone?)` function. Auto-dismiss ~3.5s, dismissible, stacked bottom-right, reduced-motion aware. No dependencies.

### Leaving endpoint
- **`POST /api/hr/employees/[id]/status`** — body `{ action: "leave" | "reactivate", leavingDate?: "YYYY-MM-DD" }`. `requirePageRole(HR_WRITE)` (rejects MANAGER). `leave` → `status=INACTIVE`, `leavingDate=<date|today>`; `reactivate` → `status=ACTIVE`, `leavingDate=null`. Validated by a small Zod schema in `hr-validation.ts`. Rate limiting not required (authenticated, same class as existing HR mutations).

### UI wiring
- **Employee detail header:** when `canWrite`, add a "Mark as leaving" (`danger`) button (ACTIVE) / "Reactivate" button (INACTIVE) next to Edit → opens `ConfirmDialog`; the leave dialog contains a date `<input type="date">` defaulting to today → on confirm, `fetch` the endpoint, `router.refresh()`, then `toast("Marked as leaving")`. A small client component `EmployeeStatusAction`.
- **Employee list:** a row-level quick action (same component, compact) — optional convenience; reuses `EmployeeStatusAction`.
- **Add employee:** `EmployeeForm.tsx` — wrap submit in a `ConfirmDialog` ("Add this employee?") before POST; on success, `toast("Employee added")` then redirect. (Edit submit can keep its current flow or also confirm — confirm only on **create** to match the ask.)

**Files:** Create `ConfirmDialog.tsx`, `toast.tsx`, `EmployeeStatusAction.tsx`, `src/app/api/hr/employees/[id]/status/route.ts`; modify `(erp)/layout.tsx` (mount `<Toaster/>`), `EmployeeForm.tsx` (confirm + toast on create), `employees/[id]/page.tsx` (status action button), `employees/page.tsx` (row action), `hr-validation.ts` (status schema).

---

## W5 — Payroll: remove automatic prefill + editor polish

**Remove auto-fill (only the automatic prefill):** in `hr/payout/page.tsx` (the "no saved record" branch, ~`:117-141`), stop pulling earnings from the employee master — return all earning/deduction money fields at **0** for unsaved rows. Keep `ctc` on the row so the optional **Auto-split** gross input can still default from it, and keep the **Auto-split** and **Copy last month** buttons (explicit, opt-in). Net: opening a month shows zeros until the user types or clicks a fill button.

**Editor UI polish (`PayrollEditor.tsx` + list):**
- Unify the list "table": one shared CSS-grid column template for the header row and the data rows (currently `[1fr_auto_auto_auto_auto]` header vs `sm:[1fr_auto_auto_auto]` rows — they drift). Align CTC / Net / status / actions columns.
- In the slide-over: group the 13 bare number inputs into **Earnings** and **Deductions** cards each with a live **subtotal**, and show the **Net** banner prominently; keep the quick-fill (Auto-split / Copy) in a clearly-labelled, secondary "Quick fill" affordance (not the default-looking top block). Tidy spacing, `.nums`, consistent money inputs.
- Print slip (`(print)/hr/payout/[id]/print/page.tsx`) is already polished — leave functional, only minor balance tweaks if the two earnings/deductions columns are uneven.

**Files:** Modify `src/app/(erp)/hr/payout/page.tsx` (prefill→0), `src/components/hr/PayrollEditor.tsx` (list + slide-over polish). Exact layout finalized against the file at implementation time; no schema/API/compute changes.

---

## W6 — HR dashboard redesign (pill-driven charts)

`/hr/analytics` is just a redirect to `/hr`; all work is in `hr/page.tsx` (+ `TrendBoard`, `Charts.tsx`).

**Core change — pill-driven composition board:** replace the four flat `BarList` cards (By location / designation / category / tenure, `page.tsx:206-211`) with one **`CompositionBoard`** client component: a `Segmented` pill row [Location · Designation · Category · Tenure] selects a dimension and renders a real chart — **`MonthlyBars`** (existing vertical-bar SVG primitive) for the selected dimension, alongside a compact ranked list with counts. One polished card instead of four flat ones; "pill-wise graph" as requested.

**Heavy UI polish:** tighten the dashboard rhythm — section eyebrows/headings, consistent card padding and grid gaps, the KPI bento, and ensure the `TrendBoard` and the new `CompositionBoard` read as the two "hero" analytics blocks. Keep `BrandHero`, the 6 KPI `StatCard`s (+`DeltaBadge`), `TrendBoard`, utilization + leave-burn, and the quick-links row; restyle for cohesion. Extract the duplicated `BarList` markup (in `page.tsx` and `TrendBoard.tsx`) into a shared helper if it remains used.

**Files:** Create `src/components/hr/CompositionBoard.tsx`; modify `src/app/(erp)/hr/page.tsx` (compose the board + polish). Optionally a tiny shared `BarList` extraction. No new data queries required (the four `*Bars` arrays already exist).

---

## Sequencing & verification

Build order: **W1 → W3 → W4 → W2 → W5 → W6** (bug first; then the self-contained tabs; then the leaving/confirm primitives that several pages reuse; then attendance UX; then payroll; then dashboard). Each workstream: implement → `npm run lint` + `npm run build` → runtime smoke → commit (on user OK) → brief check-in. Riskier ones (W1 save path, W4 endpoint/RBAC, W6) get an adversarial review.

## Non-goals (YAGNI)

No Prisma schema/migration; no new employee form fields (already present); no payslip line-item rebuild (already present); no Gantt/calendar libs; no attendance approval workflow; no payroll recompute changes; no dashboard ML.
