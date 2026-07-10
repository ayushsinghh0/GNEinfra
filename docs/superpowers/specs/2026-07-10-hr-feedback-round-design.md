# HR feedback round — manpower dashboard, bank details, attendance compaction, asset register — Design

**Date:** 2026-07-10
**Status:** Approved (brainstormed with Ayush; client feedback round on the HR module)

## Context

Client review of the deployed HR module produced four areas of feedback:

1. **Dashboard**: today's manpower count by category (On-roll / Contract / Outsourced …),
   department-wise manpower, project-wise manpower, a list of employees not deployed to any
   project — all as small boxes readable on a single screen.
2. **Employee**: bank details missing from the add-employee form AND the profile page;
   I-Card No field unwanted; Leave Details unwanted on the profile; exported Excel
   "payroll value" doesn't match CTC.
3. **Attendance**: table view retained; the header must shrink so more rows fit on one
   screen; the export must split Employee Name and EMP ID into separate columns.
4. **Assets**: asset details must be "complete, accurate, and up to date" (no screenshot).

Decisions made in brainstorming: department = **new preset-dropdown field** (not
`empCategory`, which the dashboard currently mislabels as "department") · payroll↔CTC =
**reconcile + clarify the export**, no forced auto-derivation · dashboard = **rework `/hr`
itself** (and retire the "Manpower Planning — SOON" nav stub) · assets = **generalize the
register** beyond the laptop-centric model.

Note: bank/statutory fields were deliberately moved OFF the employee form to
`/hr/payroll/[id]` on 2026-07-08. The client wants them back on the form/profile; this
partially reverses that decision **for bank + statutory only** — pay structure
(CTC/salary/deductions) stays payroll-page-only, preserving the "editing an employee never
wipes pay" invariant.

## 1. Manpower dashboard (`/hr` rework)

- Replace the `BrandHero` mint hero with the standard compact `PageHeader`; drop the
  `MonthPicker` (the dashboard becomes a **today** snapshot; attendance keeps month nav).
- **Row 1 — KPI strip** of small linkable `StatCard`s (2-up mobile → 6-up desktop):
  Total manpower (active, → `/hr/employees`) · Present today · On leave today (both keep
  the honest "Not marked yet" empty state) · one small box per employee category with
  today's active headcount (category boxes render dynamically from distinct values).
- **Row 2 — three compact cards** (lg:grid-cols-3):
  - **By department** — `BarList` of `department` → active headcount; null → "Unassigned";
    rows deep-link to `/hr/employees?department=…` (new list filter).
  - **By project** — ACTIVE projects with currently-staffed count (assignments overlapping
    today), linking to `/hr/projects/[id]`; header shows on-projects total.
  - **Not deployed** — ACTIVE employees with **no** assignment where `startDate ≤ today`
    AND (`endDate` null OR `≥ today`) on an ACTIVE project. `EntityLink` rows, count in
    the card header, list scrolls inside the box.
- Removed: composition donut + Location/Designation/Category/Band/Tenure pills, avg
  tenure, month-anchored attendance-rate bars (git history is the archive). Per-cell
  Suspense streaming stays. `HR_MANPOWER` "SOON" stub removed from `src/lib/nav.tsx`.

## 2. Department field (additive migration #1)

- `Employee.department String?` (nullable — legacy rows stay valid).
- `DEPARTMENTS` preset in `hr-validation.ts`: Business Development · Supply Chain ·
  Projects · Engineering & Design · Finance & Accounts · HR & Admin · Operations &
  Maintenance. Form renders dropdown **+ "Other…"** free text (same pattern as
  designation); the stored value stays a free string.
- Surfaces: `EmployeeForm` (Identity & Role), profile Overview *Identity & Role* row,
  employees list column (priority lg) + a Department filter (via `hr-filters.ts`
  `parseListParams`/`buildQuery`, mirrored into the employees export route's WHERE),
  employees Excel column, dashboard department box.
- `EMP_CATEGORIES` gains **"Outsourced"**.

## 3. Employee form + profile

- **Bank & statutory section returns to `EmployeeForm`** (create + edit): Bank A/C No,
  Bank Name, IFSC, PAN, UAN, ESIC — the six existing `Employee` columns re-enter
  `employeeSchema` and both employee API routes. They remain editable on
  `/hr/payroll/[id]` (same columns; last write wins — acceptable).
- **Pay stays payroll-only**: totalCtc / salary / LTA / special allowance / conveyance /
  deductions are NOT on the employee form.
- **Profile Overview** gains a read-only **Bank & statutory** `DetailSection` (KeyValue
  rows). Same HR_VIEW exposure these fields already have on the payroll page.
- **I-Card No removed** from form, profile, `employeeSchema`, and the employees Excel
  column. The `iCardNo` DB column stays (no destructive migration). The asset "ID Card"
  issued-item checkbox is unrelated and stays.
- **Leave removed from the profile**: `casualLeaveQuota`/`sickLeaveQuota` leave the form
  and `employeeSchema` (create keeps the DB defaults of 12; PATCH stops touching them);
  the leave-balance snapshot chips leave the hub header (`(hub)/layout.tsx`); the
  leave-balance card leaves the hub Attendance tab. `leaveBalances()` in `hr-leave.ts`
  goes dead → delete it (`attendanceYearSummary` stays; verify no other callers).

## 4. Payroll ↔ CTC reconciliation

- **Employees Excel** (`hr-excel.ts`): rename "Payroll" → "Payroll Type"; add computed
  **Monthly Gross** (salary+LTA+special+conveyance) and **Annualised Gross (×12)**
  columns adjacent to Total CTC; add Department; drop I-Card.
- **`/hr/payroll/[id]` editor** (`PayrollForm`): live, non-blocking amber hint when
  Total CTC is set and `12 × monthly gross ≠ totalCtc`, showing the ₹ delta.
- **`/hr/payroll` list**: small amber "breakup ≠ CTC" chip on mismatched rows (only when
  both CTC and a nonzero gross exist).

## 5. Attendance

- **Header compaction** (`AttendanceGrid`): the four `StatCard`s collapse into one slim
  inline tally row ("N employees · N present · N absent · N unmarked" — person-framed
  variant kept for single-employee scope) placed inside the toolbar card; brush palette +
  Calendar/Table `Segmented` + search + employee filter pills merge into that one card;
  the instruction sentence moves behind an ⓘ tooltip (`title` + `aria-label`). Target:
  ~300px returned to the grid. `PageHeader` (Export XLSX / month nav) unchanged.
  **Unchanged contracts:** drag-to-paint interaction, day-header fill, remount key
  `${y}-${m}-${employeeId}`, `POST /api/hr/attendance {year,month,entries,clears}`.
- **Export** (`buildAttendanceWorkbook`): first column splits into **EMP ID** and
  **Employee Name**; day columns and P/L/A tallies unchanged.

## 6. Asset register generalization (additive migration #2)

- `EmployeeAsset` gains: `assetType String?` · `assetTag String?` · `condition String?` ·
  `purchaseValue Int?` (integer ₹) · `purchaseDate DateTime?` · `remarks String?`.
  The existing `makeModel` stays the descriptor — no duplicate "name" column.
  Migration **backfills** `assetType` from legacy booleans
  (`hasLaptop` → "Laptop", else `idCard` → "ID Card") — additive DDL + deterministic
  UPDATE, no column dropped.
- Presets in `hr-validation.ts`: `ASSET_TYPES` = Laptop / Desktop / Monitor / Phone /
  SIM / ID Card / Vehicle / Tool / Furniture / Other; `ASSET_CONDITIONS` = New / Good /
  Fair / Damaged.
- **`AssetForm`**: Type select (replaces the "LP Category" input; `lpCategory` column
  stays for legacy display fallback) + Make / Model + Tag No + Serial + OEM +
  Condition select + Purchase value + Purchase date + **Allocated on** (editable date —
  today it's frozen at `now()`) + Returned on + Remarks. Bag/mouse/charger checkboxes
  remain as "Accessories issued" (laptop kits). `assetSchema` extended to match.
- **Assets table**: Employee · Asset (type + make/model, `titleInCard`) · Tag / Serial ·
  Condition · Status · Allocated · Value (priority xl) · Actions — every column that can
  hide sets `cardLabel` (DataTable mobile rule).
- Employee hub Assets tab + Overview asset snippets render `assetType` + `makeModel`
  first, falling back to legacy boolean-derived labels.

## Cross-cutting

- **Migrations:** two, both additive (`employee_department`, `asset_register_fields`);
  authored offline via `prisma migrate diff` if no local DB is reachable.
- **RBAC:** unchanged pattern — HR_VIEW reads, HR_WRITE mutates, managers read-only,
  `mustChangePassword` rejected. No new unauthenticated endpoints (no rate-limit work).
- **Money** stays integer rupees. **No chart/animation libraries**; new dashboard boxes
  compose existing primitives (`StatCard`, `BarList`, `EntityLink`, `Card`, Suspense).
- **Remount-key rule:** no new searchParams-seeded client state introduced; existing
  attendance grid key preserved.
- `prisma/seed-demo.ts`: give demo employees departments and demo assets types so the
  dashboard/register demo well.

## Out of scope

- Leave *tracking* redesign (quota columns stay in the DB, UI only removed).
- Payroll auto-derivation from CTC (hint/chip only, per decision).
- Monthly payroll runs (still removed since 2026-07-07).
- BD / Finance / SCM feedback (none in this round).

## Verification

`npm run build` (type-check) + `npm run lint`; then a manual pass: add an employee with
bank details + department (no I-Card/leave/pay prompts) → see bank + department on the
profile → dashboard boxes reflect category/department/project/undeployed counts and fit
one screen → attendance header is one slim card and the XLSX has EMP ID / Name split →
payroll editor shows the ×12 delta hint → asset add/edit with type/condition/allocated
date → employees XLSX shows Payroll Type + Monthly Gross + Annualised Gross + Department
and no I-Card.
