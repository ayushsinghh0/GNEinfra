# HR "Connected" Redesign — Design Spec

**Date:** 2026-07-01
**Branch:** `hr-connected-redesign` (off `multi-role-erp`, the live branch)
**Scope:** Full UI/UX + functionality overhaul of the HR module (`/hr/*`), delivered in 3 phases, foundation-first.

## Why this exists

The HR module works but reads as a set of disconnected screens. A deep audit (all 8 areas) + research on best-in-class HRIS (BambooHR, Rippling, Workday, Personio, Linear, Stripe) confirmed three real problems, in the owner's words: "very bad, not organised, stupid horizontal scrolling, no consistent link from an employee to their attendance/assets/projects/everything."

**Corrected premise (verified):** the Prisma schema is **strong** — `Employee` already has first-class relations to `assets`, `attendance`, `payrolls`, and `projectAssignments`, and `ProjectAssignment` joins Employee↔Project both ways. So "can't get from an employee to their stuff" is **not a data-model problem — it is a UI/navigation-shell failure.** The fix is mostly missing `<Link>` wrappers, missing employee-scoped views, and missing shared primitives — not new data plumbing.

The three problems:
1. **Broken cross-linking** — project/asset/attendance references are dead text; `/hr/attendance|assets|payout` take only `year/month` (no `employeeId`), so there is nowhere to link *to*; no HR shell layout / breadcrumbs; dashboard KPIs & bars are inert.
2. **Horizontal scrolling** — attendance is a 31-col `min-w-max` table; assets is 15 cols at `min-w-[1400px]`; employees `min-w-[860px]`; the `Table` primitive has no responsive wrapper; and the shell `<main>` sets `overflow-x-hidden` (clips instead of scrolling).
3. **Organization / hierarchy / missing enterprise functionality** — flat 20-row detail dump, 7 confusing tabs, inconsistent booleans (`✓/—` vs `Yes/No`), native `confirm()/alert()`, 3 empty-state styles, 4 pill languages; payroll 100% manual with no attendance/LOP link and no bulk ops.

## Decisions locked (from brainstorming)

- **Rollout:** phased, biggest wins first (Phase 1 = structural transformation).
- **Employee profile:** full 360 hub — route-tabs (`/hr/employees/[id]/[tab]`) + sticky identity header + snapshot strip.
- **Functionality in scope (all four):** Attendance→Payroll LOP; bulk payroll; Cmd-K command palette; saved views + URL filters.
- **Visual:** evolve *within* Soft Wave — level up hierarchy/density/headers/status color; no rebrand, no new visual language.

## Global constraints

- **Soft-Wave guardrails:** light-mode only; brand atmosphere (gradients/glow/grain/dots/waves) only in chrome (heroes/rails/headers/empty states), **never behind data tables or form fields**; motion gated on `prefers-reduced-motion`, transparency on `prefers-reduced-transparency`, bleeding-edge CSS behind `@supports`; **bespoke SVG only — no chart/animation/table libraries**; `.nums` (tabular) on codes/money/dates/%/counts; 16px inputs; 44px tap targets; `:focus-visible` rings. Compose existing primitives; the redesign *adds* primitives to `ui.tsx`, it does not fork the system. Fonts: Plus Jakarta Sans (body), Sora (`font-display`, headings only), Geist Mono (codes/IDs).
- **RBAC unchanged & re-verified per route:** every HR page `requirePageRole(HR_VIEW)`; `canWrite = HR_WRITE.includes(role)` gates all mutations in the UI **and** every mutating API; **managers are read-only** (view sets include `MANAGER`, write sets never do); guards reject `mustChangePassword`. Every **new** route (`/api/hr/search`, employee-scoped filters, LOP/bulk endpoints) does the same. Money stays integer rupees; payslip totals recomputed server-side via `computePayrollTotals`.
- **Migrations are additive.** Phase 1 & most of Phase 2 need **no schema change** (relations already exist). The only candidate schema touch is Phase 2 LOP (see W2.1 — prefer computing LOP from existing `AttendanceRecord` + a per-slip `extraLines`/deduction field that already exists, to avoid a migration). Any unavoidable change is authored as a tracked additive migration; never reset/squash the live Neon DB.
- **URL is the source of truth for list state.** New convention across HR lists: `?q=&status=&category=&location=&month=&sort=&page=` plus scoped filters `?employeeId=&projectId=&holderId=`. RSC pages read `searchParams` and drive the Prisma `where`; filter controls push new URLs (so Back + share + deep-link all work).
- **Verification gates (no test runner):** `npm run lint` + `npm run build` (full type-check) both pass per workstream; runtime smoke (no 500) on the touched pages; adversarial self-review on data-risk workstreams (LOP math, bulk save, RBAC on new endpoints). Note Next.js 16 App Router conventions (async `cookies()/headers()`, route handlers) — consult `node_modules/next/dist/docs/` before writing routing code, per AGENTS.md.

---

# Foundation — shared primitives (built first; everything depends on them)

Added to `src/components/ui.tsx` (or small sibling files) + one status module. Each is on-system and reused everywhere, so consistency is structural, not per-page.

## F1 — `DataTable` responsive shell (kills horizontal scroll, one place)
**Problem:** `Table` (`ui.tsx:427`) is a bare `<table class="w-full">` with no envelope; every grid hand-rolls scroll (`min-w-[1400px]`, `min-w-[860px]`, `overflow-x-auto`) inconsistently, and `<main>` clips the rest.
**Change:** a `DataTable` shell that owns the responsive strategy:
- **Column priority:** columns declare a tier; render all but toggle with `hidden md/lg/xl:table-cell`. Identity (EMP-ID + Name) + Status always visible; secondary columns drop progressively. No hard `min-width` that guarantees scroll.
- **Card-list fallback below `sm`:** same server-fetched data rendered as a `<ul>` of `Card`s (identity title + status chip + 2–3 key fields + full-width primary action). One data source, two presentational branches (no CSS "stacked-table" hack).
- **Horizontal scroll only when genuinely needed** (attendance matrix, wide ledgers): sticky identity column (`sticky left-0` opaque bg), optional right-pinned summary column (`sticky right-0`), and a pure-CSS scroll-shadow affordance; wrapped in `role="region" aria-label tabindex=0`.
- **Baked-in states:** `EmptyState` (zero rows) + new `ErrorState`; `RowLink` (whole-row `<Link>` with correct keyboard semantics); sortable `th` variant with `aria-sort` + caret. Reuses existing `thCls/tdCls/tdNumCls/trCls` cell vocabulary.
**Files:** `src/components/ui.tsx` (+ maybe `src/components/DataTable.tsx`). Also **remove `overflow-x-hidden`** from `src/app/(erp)/layout.tsx:15` (keep `min-w-0`).

## F2 — `StatusChip` + shared status→tone registry
**Problem:** status colors are inline ternaries duplicated across pages; `Badge.tsx` knows only vendor statuses; attendance/employee/payroll statuses fall through to grey; 4 pill languages (`Chip`/`Badge`/`Segmented`/`SectionNav`).
**Change:** `src/lib/hr-status.ts` — one registry mapping every enum → `{label, tone, dotClass}` with fixed semantics: positive/present/active=emerald, warning/pending/leave/sick/half-day=amber, negative/absent/rejected=rose, neutral/inactive/holiday/week-off=slate, info=sky/violet/teal. A `StatusChip` built on `Chip` consumes it. Covers `AttendanceStatus`, `Employee.status`, `PayrollRecord` state, `ProjectAssignment`/`Project` status, and Vendor status (so the whole ERP reads as one product). Align the 4 pill radii/heights to one scale, documented (Chip=meta, Badge/StatusChip=status, Segmented=control, SectionNav=in-page nav).
**Files:** `src/lib/hr-status.ts` (new), `src/components/ui.tsx`, refactor `src/components/Badge.tsx` to the shared registry.

## F3 — `EntityLink`
**Problem:** employee/project/asset references render as plain text/avatars everywhere.
**Change:** `EntityLink` = avatar/initials (or icon) + name + secondary mono code, wrapped in `next/link`, one component reused in every list/detail/related panel. Employee variant → `/hr/employees/[id]`; project → `/hr/projects/[id]`; asset → filtered register (or asset detail if added).
**Files:** `src/components/ui.tsx`.

## F4 — `Breadcrumbs` + `PageHeader` back slot
**Problem:** only a hard-coded single "Back" link; no breadcrumbs; Back loses context.
**Change:** `Breadcrumbs items={[{label, href}]}` primitive (truncate middle w/ overflow menu); a label map beside `src/lib/nav.tsx` so module/section names are single-sourced; add an optional breadcrumb/back slot to `PageHeader`. Explicit Back becomes additive; crumb trail is primary wayfinding. Context-aware Back via `?from=` where useful.
**Files:** `src/components/ui.tsx`, `src/lib/nav.tsx` (label map).

## F5 — `KeyValue` / `DetailSection`
**Problem:** detail pages hand-roll label/value grids (flat 20-row dump on employee detail).
**Change:** `KeyValue` (responsive 1–2 col description list, muted label + `.nums`-aware value, optional copy affordance for codes) + `DetailSection` (reuses `CardHeader`). Detail read-views grouped like the edit form's sections.
**Files:** `src/components/ui.tsx`.

## F6 — Linkable `StatCard`
**Problem:** `StatCard` (`ui.tsx:294`) is a static div with a `.lift` hover that goes nowhere.
**Change:** optional `href` → renders as `next/link` (keeps 44px target + focus ring). Powers clickable dashboard KPIs → filtered lists.
**Files:** `src/components/ui.tsx`.

## F7 — URL-filter convention + `SavedViewPills`
**Change:** a small `hr-filters.ts` helper to parse/serialize the searchParams convention; `SavedViewPills` (built on `Segmented`) renders preset filter pills as named hrefs. Foundation laid in Phase 1 (employee-scoped filters); presets rolled out in Phase 2.
**Files:** `src/lib/hr-filters.ts` (new), `src/components/ui.tsx` or `src/components/hr/SavedViewPills.tsx`.

## F8 — Sticky-offset tokens
**Change:** define header/section sticky offsets as CSS variables in `globals.css` and compose all sticky `top-*` from them (fixes magic `top-14/16/7.5rem` drift across `PageHeader`, `SectionNav`, `TabbedSections`, sticky table heads).
**Files:** `src/app/globals.css`, consumers.

---

# Phase 1 — Structural transformation (biggest wins)

After Phase 1, horizontal scroll and broken linking are gone and the module looks like a different product.

## P1.1 — HR shell layout + IA
**Change:** new `src/app/(erp)/hr/layout.tsx` renders `Breadcrumbs` + HR context on every HR page. Sidebar HR nav **grouped** in `src/lib/nav.tsx`: *People* (Employees) · *Operations* (Attendance, Payout, Assets, Projects) · *Insights* (Dashboard, Analytics). Fix orphaned `/hr/analytics` (add nav item or fold into `/hr`). Make `Sidebar.tsx` active-state derive generically from nav config (drop the hard-coded literal list).
**Files:** `src/app/(erp)/hr/layout.tsx` (new), `src/lib/nav.tsx`, `src/components/Sidebar.tsx`.

## P1.2 — Employee-scoped views (link targets)
**Change:** add optional `employeeId` (and `holderId`/`projectId` where apt) to `src/app/(erp)/hr/attendance/page.tsx`, `assets/page.tsx`, `payout/page.tsx`, `projects/page.tsx`. When present: filter the query, show a "Filtered to *Name*" chip with a clear/back affordance. This is what the 360 hub links into.
**Files:** the four list pages + their API/query helpers.

## P1.3 — Employee-360 hub (centerpiece)
**Change:** convert `/hr/employees/[id]` from one `TabbedSections` page into a **route-tab hub**:
- `src/app/(erp)/hr/employees/[id]/layout.tsx`: sticky **ProfileHeader** (avatar/initials + status dot, name, EMP-ID mono, designation, location, status `StatusChip`, `⋯`/Edit + quick actions) + **SnapshotStrip** of linking chips (tenure from `dateOfJoining`, leave balance from `hr-leave`, `assets.count`, active `projectAssignments.count` — each links to its tab). Condensed sticky variant on scroll.
- Child routes: `page.tsx` (Overview — `KeyValue` sections grouped Identity/Contact/Compensation/Statutory), `attendance/`, `assets/`, `projects/`, `payroll/`. Each tab = scoped summary + "View full in [module] →" deep-link into the P1.2 filtered view. Attendance tab renders *this employee's* month as the P1.4 calendar heatmap.
- Merge the redundant "Attendance"/"Recent" tabs; every project/asset/payslip reference is an `EntityLink`; consistent `EmptyState` everywhere.
- Permission-gated tabs/fields (compensation/bank/PAN masked or hidden per viewer relationship); disallowed tabs omitted, not disabled; each tab route re-guards server-side.
**Files:** `src/app/(erp)/hr/employees/[id]/layout.tsx` (new) + child `page.tsx` per tab; new `ProfileHeader`/`SnapshotStrip` components; retire the single-page `TabbedSections` usage here.

## P1.4 — Attendance calendar heatmap
**Change:** replace the wide matrix as the default. Per-employee month → **7-col calendar heatmap** (leading weekday offset from existing `dow` calc, one `aspect-square` cell/day, `STATUS` colors + code glyph + `aria-label`, today ring, weekend muting, HALF_DAY as a bespoke SVG diagonal split). ~6 rows tall, **zero horizontal scroll**. Drag-to-paint pointer handlers port over unchanged. Org view → **small-multiples** (mini heatmap per employee in a responsive grid) or grouped/paginated; keep the flat matrix as an optional "table view" toggle (with F1 sticky identity + right-pinned totals + scroll-shadow). Fixes: "Unmarked" counts only elapsed working days (exclude weekends/holidays/future); Absent StatCard tone → rose; **tally all 7 statuses**; employee names → `EntityLink`; read-only viewers get a non-interactive legend, not a disabled toolbar; add day-header **column-fill** (mark all as HOLIDAY/WEEK_OFF); reuse `EmptyState` for no-match.
**Files:** `src/components/hr/AttendanceGrid.tsx` (major), a new `AttendanceCalendar` component, `src/app/(erp)/hr/attendance/page.tsx`.

## P1.5 — Responsive lists (Employees, Assets, Projects) via `DataTable`
**Change:** all three adopt `DataTable` → no horizontal scroll, whole-row `RowLink`, `StatusChip`, `EntityLink`, sortable headers.
- **Employees** (`employees/page.tsx`): drop `min-w-[860px]`/`overflow-x-auto`; column-priority + card fallback; whole-row link; keep Export XLSX; add sort + pagination.
- **Assets** (`assets/page.tsx`): drop `min-w-[1400px]`; collapse 5 boolean cols → one "Items issued" chip cell; **remove duplicated Position/Mail/Location** (one click away once Employee cell is an `EntityLink`); add Allocated/Returned `StatusChip` + filter; KPI `StatCard` strip; move add-form into a `SlideOver` triggered from `PageHeader`.
- **Projects** (`projects/page.tsx`, `[id]/page.tsx`): team roster → `DataTable` (Employee | Role | Allocation | Dates | actions) with card fallback; whole-card click on `ProjectCard`; consistent `EmptyState` inside detail cards.
**Files:** the three list pages + `assets/page.tsx` form flow + `ProjectCard.tsx` + `projects/[id]/page.tsx` + `AssetForm.tsx`.

## P1.6 — Clickable dashboard
**Change:** `/hr/page.tsx` — KPI `StatCard`s get `href` deep-links (Active headcount → `/hr/employees?status=ACTIVE`; Present/On-leave today → `/hr/attendance?...`; Payroll → `/hr/payout?...`; Attrition → leavers list). Composition/location/designation/project bars become links (extract one `BarList`/`BarRow` primitive with optional `href`, consumed in `page.tsx` + `CompositionBoard` + `TrendBoard` — de-dupes 3 implementations). Promote module nav above the fold; better `EmptyState`s.
**Files:** `src/app/(erp)/hr/page.tsx`, `src/components/hr/CompositionBoard.tsx`, `src/components/hr/TrendBoard.tsx`, `src/components/Charts.tsx` (extract `BarList`).

---

# Phase 2 — Enterprise functionality

## P2.1 — Attendance → Payroll LOP
**Change:** payslip auto-derives loss-of-pay from real `AttendanceRecord` for the period (ABSENT + unpaid-LEAVE + HALF_DAY fraction vs. working days), surfaced as a computed LOP deduction line + a visible "payable days X of Y" readout, so the operator trusts the net. **Prefer no schema change:** compute from existing attendance rows; represent the LOP line via the existing `extraLines`/deduction path folded into `computePayrollTotals` server-side (integer rupees). Manual override allowed. If a persisted field is genuinely required, add it as one additive migration.
**Files:** `src/lib/hr-validation.ts`/`computePayrollTotals`, `src/components/hr/PayrollEditor.tsx`, `src/app/api/hr/payroll/route.ts`, a new attendance→LOP helper in `src/lib/hr-leave.ts`.

## P2.2 — Bulk payroll
**Change:** track dirty rows (already have `r.dirty`) → sticky "Save all (N)" bar; "Auto-split all from CTC"; make Processed/Pending `StatCard`s clickable filters + a status `Segmented` (All/Pending/Unsaved/Saved); keep status visible on mobile (compact dot); success toast on save; guard destructive "Copy last month"/"Auto-split" with a confirm when values are non-zero.
**Files:** `src/components/hr/PayrollEditor.tsx`, `src/app/(erp)/hr/payout/page.tsx`, batch endpoint in `src/app/api/hr/payroll/route.ts` (RBAC-guarded, `MANAGER`-excluded).

## P2.3 — Saved views + URL filters (module-wide)
**Change:** apply the F7 convention across every HR list; add preset `SavedViewPills` (Employees: All/Active/On-leave/Exited; Assets: All/Allocated/Returned/Unassigned; Payroll: All/Pending/Saved). Promote `EmployeeSearch` to write into the URL (debounced auto-apply, consistent with the status filter). Back/share/deep-link all become lossless.
**Files:** `src/lib/hr-filters.ts`, the HR list pages, `src/components/hr/EmployeeSearch.tsx`, `src/components/hr/ProjectFilters.tsx`.

## P2.4 — Per-employee allocation guardrails
**Change:** aggregate a person's allocation across concurrent projects; on the assign form show committed % + remaining capacity and validate sum ≤ 100 (or warn); on the employee Projects tab show a total-allocation bar; replace the meaningless project-level "Total allocation" sum with a useful stat. Extract one shared `AssignmentForm` (de-dupe `AssignProjectForm`/`AssignEmployeeForm`); filter out already-assigned targets.
**Files:** `src/components/hr/AssignProjectForm.tsx` + `AssignEmployeeForm.tsx` → shared form; `src/lib/hr-projects.ts`; `src/app/api/hr/assignments/route.ts`; employee Projects tab.

## P2.5 — Cmd-K command palette
**Change:** global `Ctrl/Cmd-K` modal in the `(erp)` shell (built on `SlideOver`/overlay + `btn()`/`Card`), searching Employees/Assets/Projects + verb actions ("New employee", "Generate payslip"); results grouped by type with mono ID + type badge; selecting navigates to the canonical deep link. Backed by `src/app/api/hr/search/route.ts` (unions indexed name/code/id columns, `LIMIT`, **RBAC-scoped** to `HR_VIEW`). Motion gated on `prefers-reduced-motion`; light-mode glass chrome.
**Files:** `src/components/CommandPalette.tsx` (new), `src/app/(erp)/layout.tsx` (mount), `src/app/api/hr/search/route.ts` (new).

---

# Phase 3 — Consistency, polish & accessibility

## P3.1 — Kill native dialogs
Replace every `window.confirm()/alert()` with `ConfirmDialog` + `toast` (in `AssetRowActions.tsx`, `RemoveAssignmentButton.tsx`, and any others); add `aria-label`s to icon-only buttons; success/error toasts on all mutations.

## P3.2 — Empty/boolean/consistency sweep
One `EmptyState` treatment everywhere (retire ad-hoc `<p>` states + `AssignEmployeeForm` dashed box); one boolean render helper (retire `✓/—` vs `Yes/No`); one money-input primitive (`inputmode="numeric"`, ₹ affordance, right-aligned `.nums`, consistent width); consistent commit UX (edit gets the same confirm/dirty-guard as create; explicit post-save destination instead of `router.back()`).

## P3.3 — Dashboard depth
Suspense + `Skeleton` streaming for the heavy multi-query dashboard (KPIs paint before 12-month aggregations); reference-month picker (reuse `MonthPicker`); responsive charts (thin/rotate x-axis labels at narrow widths, default 6-month on small screens); render real `0` distinct from no-data; fix vendor-copy default `ariaLabel` + parameterize `Donut` noun/palette; stabilize TrendBoard header when "Projects" is selected.

## P3.4 — Grid accessibility
Limit `select-none` to day cells; roving-tabindex arrow-key navigation across the attendance matrix; `scope="col"/"row"` on headers; arrow-key month scrubbing + "This month" reset in `MonthPicker`.

---

## Out of scope (noted, not now)
- `Employee.userId` relation (auth↔HR link) + employee self-service — future; data-model gap, not launch-blocking.
- Documents tab on the 360 hub — future (no document model for HR yet).
- Recruitment / Manpower Planning "Soon" modules — unchanged.
- Vendor/SCM pages — only touched insofar as `StatusChip`/`Badge` refactor (F2) keeps them working.

## Risks & mitigations
- **Live-site risk:** all work on `hr-connected-redesign`; `build`+`lint` gate every workstream; phased so each phase is independently shippable/reviewable.
- **LOP correctness:** integer-rupee math, server-recomputed, adversarially reviewed; manual override retained.
- **Route-tab refactor of the live employee page:** keep old URL (`/hr/employees/[id]`) working (Overview tab is the index route); verify all inbound links (dashboard, lists, payout) still resolve.
- **No schema churn:** Phase 1 needs none; Phase 2 LOP designed to avoid a migration.

## Verification
Per workstream: `npm run lint` + `npm run build` pass; smoke the touched routes (no 500) on a seeded local DB (`db:seed:demo`); adversarial review on P2.1/P2.2/P2.5 (data + RBAC). `rm -rf .next` if a stale route type-cache fails the build.
