# HR "Connected" Redesign — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the four Phase-2 enterprise capabilities on top of the Phase-1 foundation: attendance→payroll LOP, bulk payroll, saved views + URL filters, per-employee allocation guardrails, and a Cmd-K command palette.

**Architecture:** Additive. Reuse Phase-1 primitives (`DataTable`, `StatusChip`, `EntityLink`, `Segmented`, `hr-filters`, `computePayrollTotals`, `AttendanceCalendar`). LOP rides on the existing `PayrollRecord.extraLines` JSON (no schema change). Allocation guardrails are pure aggregation + validation. Saved views are a thin wrapper over `Segmented` driving `buildQuery`. The command palette is a purpose-made modal + one authed read-only search route.

**Tech Stack:** Next.js 16 (App Router, async `searchParams`/`params`), React 19, TypeScript, Tailwind v4, Prisma 6, lucide-react. No new dependencies. **No schema migration** (verified: all inputs exist).

**Branch:** `hr-connected-redesign` (continues from Phase 1 @ `aa8e93d`).

## Global Constraints

- **No test runner.** Gate = `npx tsc --noEmit` + `npm run lint` + `npm run build`, plus `npx tsx` round-trips for pure logic (the LOP/allocation math). Runtime smoke when a DB is reachable (docker `gne_e2e`/Neon, login `hr@gne.test`/`gnedemo123`); else deferred + noted. `rm -rf .next` if a moved/added route staleness fails the build.
- **Money is integer rupees; totals are server-authoritative** via `computePayrollTotals` (sums 9 earnings + 4 fixed deductions + `extraLines` by `kind`). Never trust client totals. Any rupee value = `Math.round(...)` to whole rupees.
- **RBAC unchanged.** Every route/handler: `requirePageRole(HR_VIEW)` (pages) or `getCurrentUser()` + `HR_VIEW.includes(role)` (API GET) / `HR_WRITE.includes(role)` (API mutations), and reject `mustChangePassword`. `HR_VIEW=[HR,MANAGER,ADMIN,SUPERADMIN]`, `HR_WRITE=[HR,ADMIN,SUPERADMIN]` — **managers are read-only** in UI (behind `canWrite`) AND in every mutating API. New endpoints (`/api/hr/payroll/batch`, `/api/hr/search`) do the same.
- **No schema migration.** LOP → `extraLines`; allocation → aggregate existing `allocationPct`; search → `contains` over existing columns. Do NOT touch `prisma/schema.prisma`.
- **Soft-Wave:** light mode; atmosphere only in chrome (the palette overlay may use glass, but its results list stays plain white); bespoke SVG; `.nums` on codes/money/dates/%/counts; 44px targets; `:focus-visible` rings; motion gated on `prefers-reduced-motion`.
- **Data-exposure guard (P2.5):** the search route returns a SHAPED subset (id/label/sublabel/href/type) — NEVER raw `Employee` rows (they carry salary/bank/PAN/UAN/ESIC). Leaking those to any HR_VIEW user (incl. MANAGER) is a regression.

## LOP policy (authoritative — from product owner)

- **Behavior:** auto-deduct BUT editable. The editor pre-fills an editable `extraLines` deduction line labeled exactly `"Loss of Pay"` with the computed amount; the operator can adjust or remove it; the server recomputes TOTALS from the lines (does not force-overwrite the operator's LOP value). Managers can't edit (read-only).
- **LOP days:** `lopDays = absentDays + 0.5*halfDays + unpaidLeaveDays`, where `unpaidLeaveDays` = this month's LEAVE beyond the casual quota (YTD) + this month's SICK beyond the sick quota (YTD). "Over quota" is computed YTD: `unpaidCasualThisMonth = max(0,(ytdLeaveThroughMonth - casualQuota)) - max(0,(ytdLeaveBeforeMonth - casualQuota))`, same for sick.
- **Rate:** per-day = `monthlyGross / daysInMonth` (calendar days). `lopAmount = round((gross / daysInMonth) * lopDays)`, where `gross = totalEarnings` (the earnings sum BEFORE the LOP deduction).
- **Working/paid days:** `workingDays = daysInMonth`; `paidDays = daysInMonth - lopDays`. This changes the numbers the printed slip shows today (which counted only absent + ½·half-day and treated all leave as paid) — that change is INTENDED.

---

## File Structure

**New files**
- `src/lib/hr-lop.ts` — `attendanceLop(...)` (LOP day/amount derivation) + a pure `computeLop` core.
- `src/app/api/hr/payroll/batch/route.ts` — bulk save endpoint.
- `src/components/hr/SavedViewPills.tsx` — preset filter pills over `Segmented` + `buildQuery`.
- `src/components/hr/AssignmentForm.tsx` — shared assignment form (dedupes the two).
- `src/app/api/hr/search/route.ts` — global entity search (shaped payload).
- `src/components/CommandPalette.tsx` — Cmd-K modal.

**Modified files**
- `src/lib/hr-leave.ts` (or new `hr-lop.ts`), `src/app/(print)/hr/payout/[id]/print/page.tsx` (use shared LOP helper), `src/app/(erp)/hr/payout/page.tsx` (per-employee month summary + suggested LOP), `src/components/hr/PayrollEditor.tsx` (payable-days + LOP line + bulk ops), `src/lib/hr-projects.ts` (allocation helpers; replace `totalAllocation` stat), `src/app/api/hr/assignments/route.ts` (server allocation guard), `src/app/(erp)/hr/employees/[id]/(hub)/projects/page.tsx` + `src/app/(erp)/hr/projects/[id]/page.tsx` (allocation UI + shared form), `src/components/hr/AssignProjectForm.tsx` + `AssignEmployeeForm.tsx` (re-export shared form), `src/components/hr/EmployeeSearch.tsx` (preserve category/location via `buildQuery`), `src/components/hr/AssetStatusFilter.tsx` + `ProjectFilters.tsx` (standardize on `buildQuery`), the HR list pages (mount pills), `src/app/(erp)/layout.tsx` (mount palette).

---

# P2.1 — Attendance → Payroll LOP

## Task 1: `attendanceLop` helper + refactor the printed slip

**Files:** Create `src/lib/hr-lop.ts`; modify `src/app/(print)/hr/payout/[id]/print/page.tsx`.

**Interfaces:**
- Produces: `computeLop(counts, quotas, ytdBefore, daysInMonth) => { workingDays, lopDays, paidDays, absentDays, halfDays, unpaidLeaveDays }` (PURE) and `attendanceLop(employeeId, year, month/*1-based*/, casualQuota, sickQuota) => Promise<{ workingDays, lopDays, paidDays, absentDays, halfDays, unpaidLeaveDays, leaveDays, sickDays }>` (DB-backed, mirrors `hr-leave` UTC half-open windowing).

- [ ] **Step 1: Pure core.** In `hr-lop.ts`, write `computeLop`: given this-month status counts (`{ABSENT,HALF_DAY,LEAVE,SICK,...}`), `{casualQuota,sickQuota}`, YTD-before-month `{leave,sick}` counts, and `daysInMonth`, compute `unpaidLeaveDays` via the over-quota YTD formula (see LOP policy), `lopDays = ABSENT + 0.5*HALF_DAY + unpaidLeaveDays`, `workingDays = daysInMonth`, `paidDays = daysInMonth - lopDays`. Round nothing here (days can be .5).
- [ ] **Step 2: DB helper.** `attendanceLop(...)`: two `prisma.attendanceRecord.groupBy({by:['status'],_count})` — one over `[Date.UTC(year,month-1,1), Date.UTC(year,month,1))` (this month), one over `[Date.UTC(year,0,1), Date.UTC(year,month-1,1))` (YTD before month, only need LEAVE+SICK). `daysInMonth = new Date(Date.UTC(year,month,0)).getUTCDate()`. Feed `computeLop`. Return the shape.
- [ ] **Step 3: tsx sanity.** Throwaway `tsx` asserting `computeLop`: e.g. absent=2, half=2 → lopDays=3; leave=5 with casualQuota=12 and ytdBefore=10 → unpaidCasual = max(0,15-12)-max(0,10-12)=3-0=3; etc. Delete the scratch file.
- [ ] **Step 4: Refactor the print slip.** In the print page, replace the inlined `lopDays/paidDays` (currently `ABSENT + 0.5*HALF_DAY`, base `daysInMonth`) with `attendanceLop(emp.id, periodYear, periodMonth, emp.casualLeaveQuota, emp.sickLeaveQuota)`. The printed "LOP Days"/"Paid Days" now include over-quota leave — an INTENDED change. Keep the slip layout.
- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit` + `npm run lint` + `npm run build`. `git commit -m "feat(hr): attendanceLop helper (over-quota leave) + slip uses shared LOP source"`

## Task 2: LOP in the payout editor (payable days + editable LOP line)

**Files:** Modify `src/app/(erp)/hr/payout/page.tsx`, `src/components/hr/PayrollEditor.tsx`.

**Interfaces:** Consumes `attendanceLop` (Task 1). Produces: `PayrollRow` gains `lop?: { workingDays, lopDays, paidDays, suggestedAmount }` (attendance-derived, per employee/month).

- [ ] **Step 1: Server — per-employee month LOP.** In `payout/page.tsx`, for the current `year/month`, compute each active employee's `attendanceLop(...)` (batch: one `groupBy` over the month for all employees keyed by employeeId + one YTD `groupBy`, or call the helper per employee — prefer a single grouped query for scale, then `computeLop` per employee). Compute `suggestedAmount = round((totalEarningsForThatRow / daysInMonth) * lopDays)` — but `totalEarnings` depends on the row's earnings; compute the suggestion from the row's current gross (for a blank row use `ctc/12`). Pass `lop: { workingDays, lopDays, paidDays, suggestedAmount }` into each `PayrollRow`.
- [ ] **Step 2: Editor — payable days caption.** In `PayrollEditor.tsx`, near the Net-payable block in the slide-over, render a small `.nums` caption: `Payable days {paidDays} of {workingDays}` + `LOP {lopDays}d` when `lopDays > 0`.
- [ ] **Step 3: Editor — editable LOP line (auto-deduct, editable).** When a row has `lop.lopDays > 0` and no existing `extraLines` deduction labeled `"Loss of Pay"`, offer an "Apply LOP (−₹X)" affordance that inserts an editable `extraLines` deduction `{ label: "Loss of Pay", amount: suggestedAmount, kind: "deduction" }` (marks the row dirty). If a `"Loss of Pay"` line already exists, show it in the normal ExtraLines editor (operator can edit/remove). Do NOT force-overwrite an operator-edited value. Recompute the displayed totals via `computePayrollTotals` (already client-mirrored). Gate the affordance behind `canWrite`.
- [ ] **Step 4: Verify + commit.** tsc + lint + build (+ smoke: a slip with attendance shows payable-days and an editable LOP line reducing net; manager sees no Apply button). `git commit -m "feat(hr): payout shows payable days + editable attendance-derived LOP line"`

---

# P2.2 — Bulk payroll

## Task 3: Batch save endpoint

**Files:** Create `src/app/api/hr/payroll/batch/route.ts`. Reference `src/app/api/hr/payroll/route.ts`.

**Interfaces:** Produces `POST /api/hr/payroll/batch` — body `{ rows: PayrollPayload[] }` (each = the existing `payrollSchema`); guarded by `HR_WRITE` + `!mustChangePassword`; validates every row + every `extraLines` entry; in a `prisma.$transaction`, upserts each on `employeeId_periodYear_periodMonth` with **server-recomputed** totals via `computePayrollTotals`; returns `{ ok:true, results: { employeeId, id }[] }` so the client can map `savedId` per row.

- [ ] **Step 1: Handler.** Guard (copy the single-row route's RBAC). Parse `z.object({ rows: z.array(payrollSchema).min(1).max(500) })`. For each row recompute totals server-side (ignore any client totals). `$transaction` of upserts. Return the id map.
- [ ] **Step 2: Verify + commit.** tsc + lint + build. `git commit -m "feat(hr): batch payroll save endpoint (HR_WRITE, tx, server-recomputed totals)"`

## Task 4: Bulk UI in the payout editor

**Files:** Modify `src/components/hr/PayrollEditor.tsx`, `src/app/(erp)/hr/payout/page.tsx` (if a header action is added).

- [ ] **Step 1: Save-all.** A sticky "Save all (N)" action (N = dirty rows) that POSTs the dirty rows to `/api/hr/payroll/batch`, sets per-row `saving`, and on success maps returned ids to `savedId` + clears `dirty` (mirroring `save()`); success toast; error surfaces per-row. Gate behind `canWrite`.
- [ ] **Step 2: Auto-split-all.** A "Auto-split all from CTC" action that, for each row, applies `onMany(idx, splitFromGross(row.ctc ? round(row.ctc/12) : currentGross, row.lta, row.specialAllowance))` (marks rows dirty; pair with Save-all). Guard with a confirm when rows already have non-zero earnings. `canWrite` only.
- [ ] **Step 3: Pending filter + mobile status.** Make the "Pending" stat clickable → filters the list to rows where `!savedId` (compose with the existing search). Add a `Segmented` (All / Pending / Saved) if clean. Move/duplicate the `StatusBadge` (Draft/Unsaved/Saved) into the always-visible left column so status shows on mobile (currently `hidden sm:flex`).
- [ ] **Step 4: Verify + commit.** tsc + lint + build (+ smoke: edit several rows → Save all persists them; Auto-split-all fills from CTC; Pending filter narrows; status visible on a narrow viewport; manager sees none of these controls). `git commit -m "feat(hr): bulk payroll — save-all, auto-split-all, pending filter, mobile status"`

---

# P2.3 — Saved views + URL filters

## Task 5: `SavedViewPills` + standardize client filters on `buildQuery`

**Files:** Create `src/components/hr/SavedViewPills.tsx`; modify `src/components/hr/EmployeeSearch.tsx`, `AssetStatusFilter.tsx`, `ProjectFilters.tsx`.

**Interfaces:** Produces `<SavedViewPills basePath param? views preserve? />` — a client wrapper over `Segmented`; reads current params via `useSearchParams`; active = `current[param] ?? ""`; `onChange(v) => router.push(buildQuery(basePath, { ...preserved, [param]: v || undefined }))`. Consumes `buildQuery`/`parseListParams` from `@/lib/hr-filters`.

- [ ] **Step 1: `SavedViewPills`.** Props `{ basePath: string; param?: string /*default "status"*/; views: {value:string;label:string}[] /*value ""=All*/; preserve?: string[] /*param names to carry through, default q/category/location/employeeId/sort/dir*/ }`. Build on `Segmented`; realize navigation by `router.push(buildQuery(...))` in `onChange`. Always drop `page` (buildQuery drops page===1). Client component.
- [ ] **Step 2: Fix `EmployeeSearch`.** Read `category`/`location` (and `employeeId` if present) from `useSearchParams`; replace the hand-rolled `URLSearchParams` in `apply()` with `router.push(buildQuery("/hr/employees", { q: nextQ, status: nextStatus||undefined, category, location }))`. Stops dropping category/location on search/status change (the Phase-1 known bug).
- [ ] **Step 3: Standardize the other two.** Refactor `AssetStatusFilter` and `ProjectFilters` `push()` to use `buildQuery(basePath, patch)` (keep ProjectFilters' debounce-cancel discipline; keep AssetStatusFilter's employeeId preservation — buildQuery handles it via the patch). One serializer everywhere.
- [ ] **Step 4: Verify + commit.** tsc + lint + build (+ smoke: `/hr/employees?location=Pune` then type in search → location survives). `git commit -m "feat(hr): SavedViewPills + standardize client filters on buildQuery (fix EmployeeSearch param drop)"`

## Task 6: Mount saved-view pills on the lists

**Files:** Modify `src/app/(erp)/hr/employees/page.tsx`, `assets/page.tsx`, `payout/page.tsx`. (Projects already has `ProjectFilters`.)

- [ ] **Step 1: Employees.** Render `<SavedViewPills basePath="/hr/employees" views={[{value:"",label:"All"},{value:"ACTIVE",label:"Active"},{value:"INACTIVE",label:"Inactive"}]} />` near `EmployeeSearch`. (On-leave/Exited are NOT built — no backing status without a migration; documented.)
- [ ] **Step 2: Assets.** Keep `AssetStatusFilter` (it already IS the All/Allocated/Returned saved-view UX, now on `buildQuery` from Task 5) — no change needed beyond Task 5, OR swap to `SavedViewPills` for visual consistency (either is acceptable; if swapping, preserve `employeeId`).
- [ ] **Step 3: Payroll All/Pending/Saved.** Add a `view` searchParam (`"pending"|"saved"`) to `payout/page.tsx`: after building `rows`, filter by `recordId===null` (pending) / `recordId!==null` (saved) when `view` is set. Because payout URLs use `year/month` (outside the `hr-filters` convention, which `buildQuery` does NOT serialize), give `SavedViewPills` on this page a payout-local href builder that preserves `year/month/employeeId` (pass the pills a `hrefFor(v)` or a small local `<Segmented>` that pushes `/hr/payout?year=&month=&employeeId=&view=`). Do NOT try to force `buildQuery` here.
- [ ] **Step 4: Verify + commit.** tsc + lint + build (+ smoke: each list's pills filter and compose with existing scope/search; payout Pending shows only blank slips). `git commit -m "feat(hr): saved-view pills on employees/assets/payout lists"`

---

# P2.4 — Per-employee allocation guardrails

## Task 7: Shared `AssignmentForm` + allocation helpers + server guard

**Files:** Create `src/components/hr/AssignmentForm.tsx`; modify `src/components/hr/AssignProjectForm.tsx` + `AssignEmployeeForm.tsx` (re-export the shared form), `src/lib/hr-projects.ts`, `src/app/api/hr/assignments/route.ts`.

**Interfaces:** Produces `AssignmentForm` (discriminated union prop `{ mode:"byProject", employeeId, projects, committedPct?, remainingPct? } | { mode:"byEmployee", projectId, employees }`); `activeAllocation(assignments) => number` and `remainingCapacity(committed) => number` helpers; a server aggregate guard in the assignments POST.

- [ ] **Step 1: Shared form.** Extract the ~95%-identical `AssignProjectForm`/`AssignEmployeeForm` into `AssignmentForm` parameterized by `mode` (fixed employeeId + selectable projects vs. fixed projectId + selectable employees; option-label + button + error-copy + empty-state derived from mode). POST body to `/api/hr/assignments` is unchanged. When `committedPct`/`remainingPct` are provided (byProject mode), show a "committed X% · remaining Y%" hint and a soft client warning when the entered `allocationPct` would push the sum over 100. Re-export the two old components as thin wrappers (so existing imports keep working) OR update the two call sites to use `AssignmentForm` directly.
- [ ] **Step 2: Helpers.** In `hr-projects.ts`, add `activeAllocation(rows)` = sum of `allocationPct ?? 0` over rows where `endDate == null || endDate >= todayUTC`. Replace the meaningless project-detail `totalAllocation` stat: change its only consumer (`projects/[id]/page.tsx:157`) to show **"Over-allocated"** = count of assignees whose cross-project committed% > 100 (or drop the stat) — keep `assignmentStats` compiling.
- [ ] **Step 3: Server guard.** In the assignments POST, after `assignmentSchema.safeParse` and before `create`, run `prisma.projectAssignment.aggregate({ where: { employeeId: d.employeeId, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] }, _sum: { allocationPct: true } })`. If `d.allocationPct` is a number and `(sum ?? 0) + d.allocationPct > 100`, return `409 { error: "Over-allocated: employee already committed at N%..." }`. Null incoming allocation never blocks. Keep the existing `HR_WRITE` + `mustChangePassword` guard.
- [ ] **Step 4: Verify + commit.** tsc + lint + build (+ tsx for `activeAllocation`; smoke: assigning past 100% is rejected server-side with a clear message). `git commit -m "feat(hr): shared AssignmentForm + server allocation guard (<=100%) + replace meaningless total-allocation stat"`

## Task 8: Allocation UI on the employee & project pages

**Files:** Modify `src/app/(erp)/hr/employees/[id]/(hub)/projects/page.tsx`, `src/app/(erp)/hr/projects/[id]/page.tsx`.

- [ ] **Step 1: Employee Projects tab.** Compute `committed = activeAllocation(emp.projectAssignments)` (data already loaded via `getEmployee`). Render a **total-allocation `ProgressBar`** (`value = min(100, committed)`, `tone = committed > 100 ? "amber" : "brand"`) with a `committed% · remaining {100-committed}%` label; when over 100, an amber "over-allocated" note. Pass `committedPct`/`remainingPct` into the `AssignmentForm` so the assign form shows remaining capacity.
- [ ] **Step 2: Project detail.** For the by-employee assign form, compute a per-employee committed map (one `groupBy(['employeeId'])` `_sum allocationPct` over active rows for the assignable employees) and pass it so the form can show the selected employee's remaining capacity (or accept the simpler MVP: server-side guard is authoritative and the client hint is best-effort). Replace/confirm the `totalAllocation` stat change from Task 7.
- [ ] **Step 3: Verify + commit.** tsc + lint + build (+ smoke: employee Projects tab shows an accurate allocation bar that flips amber over 100%; assign form shows remaining). `git commit -m "feat(hr): per-employee allocation bar + remaining-capacity hint on assign forms"`

---

# P2.5 — Cmd-K command palette

## Task 9: `/api/hr/search` route (shaped payload)

**Files:** Create `src/app/api/hr/search/route.ts`. Reference `src/app/api/hr/employees/route.ts` (RBAC).

**Interfaces:** Produces `GET /api/hr/search?q=` → `200 { employees:{id,empId,name,designation}[], assets:{id,employeeId,label}[], projects:{id,code,name}[] }` | `401/403 {error}`.

- [ ] **Step 1: Handler.** Guard: `getCurrentUser()`; reject `!user || user.mustChangePassword || !HR_VIEW.includes(user.role)` with `401/403`. Read `q` (trim); if `< 2` chars return empty sets. Three parallel `findMany` with `take:5`, `{contains:q, mode:"insensitive"}`: Employee OR name/empId (select ONLY id/empId/name/designation — **never** salary/bank/PAN/etc.), EmployeeAsset OR lpSerialNo/makeModel/oemName (select id/employeeId + a computed label), Project OR name/code (select id/code/name). Return the SHAPED payload only.
- [ ] **Step 2: Verify + commit.** tsc + lint + build (+ smoke: `/api/hr/search?q=<name>` returns shaped hits; confirm NO salary/bank fields in the response; a logged-out request 401s). `git commit -m "feat(hr): /api/hr/search entity search (HR_VIEW, shaped payload, no sensitive fields)"`

## Task 10: `CommandPalette` (Cmd-K) + mount in the shell

**Files:** Create `src/components/CommandPalette.tsx`; modify `src/app/(erp)/layout.tsx`.

- [ ] **Step 1: Palette component.** `"use client"`. A single global `window` `keydown` listener toggling on `(e.metaKey||e.ctrlKey) && (e.key==="k"||e.key==="K")` (`preventDefault`); `Escape` closes; `ArrowUp/Down` move the active index; `Enter` navigates. Render via `createPortal` to `document.body` with an SSR guard (mirror `Toast.tsx`). Centered dialog: `role="dialog" aria-modal aria-label`, backdrop `bg-slate-900/40 backdrop-blur-sm` (onClick close, `aria-hidden`), body-scroll lock (save/restore `overflow`), `motion-reduce:transition-none` on animated parts, focus the input on open + restore focus on close. Debounced (~200ms, `AbortController`) `fetch("/api/hr/search?q=")`; sectioned results (Employees/Assets/Projects) as a `role="listbox"`/`option` combobox with `aria-activedescendant`. Result → link: Employee `/hr/employees/${id}`, Project `/hr/projects/${id}`, Asset `/hr/employees/${employeeId}/assets`. A static **verb-action** list gated by role: "New employee" (`/hr/employees/new`) + "Generate payslip" (`/hr/payout?employeeId=<highlighted>` or `/hr/payout`) require `HR_WRITE` — hide when `role` is MANAGER; navigations are HR_VIEW. On-system styling (rounded-xl, `shadow-[var(--shadow-pop)]`, `Input` look, `font-mono`/`.nums` for codes, lucide section icons, 44px targets, focus rings).
- [ ] **Step 2: Mount.** In `src/app/(erp)/layout.tsx` (server component), render `<CommandPalette role={user.role} />` as a sibling of `<Toaster/>` (persists across navigations). Pass `role` from the existing `user` prop (client role is for hiding mutate verbs only — the search route is the authority).
- [ ] **Step 3: Verify + commit.** tsc + lint + build (+ smoke: Cmd/Ctrl-K opens the palette anywhere in `/hr/*`; typing a name shows grouped results; Enter navigates; Escape closes; a MANAGER sees no "New employee"/"Generate payslip" verbs; reduced-motion shows it instantly). `git commit -m "feat(hr): Cmd-K command palette (entity search + role-gated verbs)"`

---

## Phase 2 completion gate
- [ ] `npm run lint` clean; `npm run build` passes.
- [ ] Smoke on seeded data: LOP line auto-fills + is editable and reduces net; batch Save-all persists dirty rows; saved-view pills filter + compose; assigning over 100% is server-rejected; Cmd-K searches + navigates; a MANAGER can see everything read-only but reach no mutation (bulk save, auto-split, assign, LOP apply, verb actions all hidden/blocked).
- [ ] Adversarial re-check: `/api/hr/payroll/batch` + `/api/hr/search` reject MANAGER-write / unauth / mustChangePassword; search payload carries NO salary/bank/PAN; LOP + totals are server-recomputed (client can't fudge the sum); allocation guard is server-authoritative.

## Self-review (spec coverage)
- P2.1 LOP → Tasks 1–2 ✓ (policy: auto-deduct-editable, over-quota leave, gross÷days-in-month). P2.2 bulk → Tasks 3–4 ✓. P2.3 saved views + filter fixes → Tasks 5–6 ✓ (On-leave/Exited employee presets NOT built — no backing status without a migration; documented). P2.4 allocation → Tasks 7–8 ✓. P2.5 Cmd-K → Tasks 9–10 ✓.
- No schema migration anywhere. Every new route re-guards RBAC + excludes MANAGER from writes. Interfaces (`attendanceLop`/`computeLop`, batch payload, `SavedViewPills`, `AssignmentForm`, `/api/hr/search` shaped payload) named consistently across producing/consuming tasks.
