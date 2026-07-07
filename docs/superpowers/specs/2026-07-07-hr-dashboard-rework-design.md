# HR Dashboard rework + Employee Family Details — design

**Date:** 2026-07-07
**Status:** Approved (dashboard); family details = Phase 2 with stated assumptions
**Author:** brainstorming session (source: two handwritten notes + follow-up messages)

## Context

The HR dashboard (`/hr`) is currently a dense 12-col bento: a 2×2 KPI cluster
(Headcount / Assets-in-use / Attendance-rate / Attrition), Leave-burn rings, a
pill-driven Trends board, a Project-utilization card, a Workforce-composition
donut, and a "Today" pulse card with quick links. The reference-month
`MonthPicker` lives inside the `BrandHero`.

The user wants the dashboard **stripped to the essentials** and refocused on
three things — headcount + department attendance, workforce composition, and
project details — plus two bug/quality fixes. Separately, the employee detail
page should gain a **Family details** section.

Source notes (verbatim intent):
1. In **Headcount** add more information — **department-wise attendance**.
2. Add more details to **Workforce composition**, and **add project details** to
   the dashboard. For each project show **how many employees are working on it**
   and **how many employees are unused** (on bench).
3. **Remove all other information.**
4. The **"July 2026" month dropdown is clipped** — it doesn't show the full UI.
5. In **employee details**, add a **Family details** section.

Resolved in brainstorming:
- "Department" → group by the existing **`empCategory`** field (no `department`
  column exists; no schema migration for this grouping).
- Department attendance → show **this-month attendance rate %** per category.
- Project details → **active projects list**.
- Composition "more details" → **summary header + a Band dimension**.
- Removal scope → remove all analytics **but keep the Today pulse card**.
- Quick-links grid → removed (part of "remove all other information"; easily
  restored later).

## Goals

- A focused HR dashboard: 4 cards only, no horizontal scroll, honest empty states.
- Department-wise (empCategory) attendance visible on the headcount card.
- Richer workforce composition (summary + Band dim).
- A project-details card that answers "who's working where, and who's idle".
- Fix the clipped month-picker popover.
- Fix the stale header subtitle.
- Add a Family details section to the employee hub.

## Non-goals / removed from the dashboard

Deleted from `/hr`: the Attrition / Assets-in-use / Attendance-rate KPI tiles,
Leave-burn rings, the Trends board, the standalone Project-utilization card, and
the quick-links grid. `DashboardTrends`, `DashboardLeaveBurn`, and
`DashboardUtilization` become unused by the dashboard. (`CompositionBoard`,
`SegmentDonut`, `BarList`, `RingGauge` etc. remain; the composition board is
enhanced in place.) We do **not** delete the underlying components/routes for
`/hr/analytics` if they are referenced elsewhere — verify usages before removing;
if orphaned, remove `DashboardTrends`/`DashboardLeaveBurn`/`DashboardUtilization`.

## Dashboard design

### Layout (12-col bento, lg+; single column on mobile, same order)

- **Row 1:** Headcount & attendance by department (col-span-8) · Today pulse (col-span-4)
- **Row 2:** Workforce composition (col-span-7) · Project details (col-span-5)

Column spans are adjustable during implementation for balance; the four cards
and their content are the contract.

### Card 1 — Headcount & Attendance by Department

- Header line: **total active headcount** (big number, links to
  `/hr/employees?status=ACTIVE`).
- One row per **empCategory** (active employees), ranked by headcount:
  - category label (deep-links to `/hr/employees?category=<cat>`)
  - headcount
  - **this-month attendance rate %** (present-equivalent), reusing the
    `monthlyAttendanceStats` present/half-day formula, scoped to that category.
- **Honesty (do not regress):** when a category has **no attendance rows** for
  the reference month, show "—" + a quiet "Not marked yet" hint, never a red 0%.
  Uses the same `total>0` guard already established in the KPI band.
- Anchored to the dashboard's **reference month** (the relocated MonthPicker).
- Employees with a null `empCategory` group under "—" (row shown, not linked,
  same convention as CompositionBoard).

### Card 2 — Today (kept pulse)

- Present today / on-leave today, **real-time "today"** regardless of the month
  picker (unchanged honesty logic + hrefs). Quick-links grid removed.

### Card 3 — Workforce composition (enhanced)

- New **summary header** above the toggle: **total active · avg tenure (yrs) ·
  new joiners this month** (`dateOfJoining` within the current calendar month).
- Donut toggle gains a **Band** dimension → Location / Designation / Category /
  **Band** / Tenure. Band rows deep-link to `/hr/employees?...`? There is no
  `band` filter param today — Band rows are **non-linked** (same as tenure),
  unless a `band` filter is added (out of scope; keep non-linked).

### Card 4 — Project details (new, replaces utilization)

- **Summary strip:** active projects count · **employees working on projects**
  (distinct active employees with a live assignment) · **employees unused / on
  bench** (active employees with no live assignment).
- **Active projects list** (status ACTIVE), each row deep-linking to
  `/hr/projects/<id>`: name, `code` (mono), client, `StatusChip`, **staffed
  headcount** (distinct active employees on a live assignment), start–end
  timeline. Cap the list (e.g. 6) with a "+N more → Projects" link; no sideways
  scroll.
- Reuses the assignment-liveness predicate already in `DashboardUtilization`
  (`employee.status ACTIVE` AND (`endDate` null OR `endDate >= today`)).

### Data approach

- Per-category attendance rate: fetch categories from a `groupBy(empCategory)`
  for headcount, then compute the month rate per category. Preferred: a single
  `attendanceRecord.groupBy({ by: ["status"], where: { date in month,
  employee: { empCategory } } })` per category (categories are few, <~10), each
  cheap; OR one `findMany` of the month's rows selecting `status` +
  `employee.empCategory` aggregated in JS. Choose per-category groupBy for
  clarity. This card is Suspense-streamed like the others.
- Composition/project cards stay **current snapshots** (not month-anchored),
  matching existing behavior.

### Bug/quality fixes

1. **Month-picker clipping** — the popover is `absolute` inside `BrandHero`,
   which is `relative overflow-hidden`, so the dropdown is clipped at the hero's
   bottom edge. **Fix:** move the "Viewing [month] [This month]" control out of
   the hero and into the page body (a slim strip above the bento). The popover
   then opens over normal, non-clipping content. (Alternative considered:
   portal the popover — rejected as heavier; relocation also suits the leaner
   layout.)
2. **Stale subtitle** — `BrandHero subtitle="Workforce, payroll and attendance —
   with trend projections."` no longer true (payroll + trends gone). Replace
   with e.g. "Workforce, attendance and projects — at a glance."

## Family details (Phase 2)

> **Assumption flag:** the reference image did not reach the assistant (the image
> received was the dashboard-header screenshot). This section is built to a
> standard, comprehensive Indian-HR family model and is easy to adjust once the
> reference is available.

### Model — repeatable family members

New Prisma model `EmployeeFamilyMember` (additive migration; `onDelete: Cascade`
from Employee so members clear with the employee — family data has no
independent history to protect, unlike payroll/attendance):

```
model EmployeeFamilyMember {
  id           String   @id @default(cuid())
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  name         String
  relation     String            // Father / Mother / Spouse / Son / Daughter / Guardian / Other
  dob          DateTime?         @db.Date
  gender       String?
  occupation   String?
  contact      String?
  isDependent  Boolean  @default(false)
  isNominee    Boolean  @default(false)
  nomineePct   Int?              // PF/ESIC nominee share, when isNominee
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  @@index([employeeId])
}
```

Employee gains `familyMembers EmployeeFamilyMember[]`.

### Zod / validation

Add a `familyMemberSchema` to `src/lib/hr-validation.ts` (name required;
relation from an allow-list; `nomineePct` 0–100 only meaningful when
`isNominee`). Server validates on save; the client edit form mirrors it.

### UI

- **Read view:** a new **"Family"** section on the employee hub. Options:
  (a) a tab in the `(hub)` route group, or (b) a `DetailSection` on the Overview
  tab. Given the hub already has Overview/Attendance/Assets/Projects/Compensation
  tabs, add family under **Overview** as a `DetailSection` table (name · relation
  · DOB · dependent/nominee chips) to avoid tab sprawl — revisit if the reference
  implies a full tab.
- **Edit:** an editable repeatable list on `/hr/employees/[id]/edit` (and the new
  form), add/remove rows, following `EmployeeForm` patterns + `useUnsavedGuard`.
- **Excel export:** out of scope for Phase 2 unless the reference requires it.

### API

Family members are saved through the existing employee create/update endpoints
(nested write in the same transaction) — no new route, so no new RBAC surface;
HR_WRITE guards already apply. Managers remain read-only.

## Verification

- `npx tsc --noEmit` + `npm run lint` after each phase; full `npm run build`
  before claiming done (no dev server running).
- Dashboard: confirm the four cards render, the month dropdown opens fully
  (unclipped), empty categories show "Not marked yet" not red 0%, and the
  project strip's working+bench sums to active headcount.
- Family details: create/edit an employee with family rows; confirm they persist
  and render read-only for managers.
- REMOUNT-KEY RULE: any new client component seeded from server props under
  mutable `searchParams` (e.g. the relocated picker context) must be keyed.

## Sequencing

1. **Phase 1 — Dashboard** (approved, high-confidence): implement cards, fixes,
   remove analytics; verify.
2. **Phase 2 — Family details** (stated assumptions): schema migration, Zod,
   edit form, read view; verify.
