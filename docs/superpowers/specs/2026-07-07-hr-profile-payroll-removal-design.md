# HR Profile Slimming + Payroll Module Removal — Design

**Date:** 2026-07-07
**Status:** Approved (brainstormed with Ayush; sub-project A of the 2026-07 ERP change request)
**Approach:** Clean cut + tab swap (approved over soft-retirement flag and band-master micro-module)

## Context

The ERP review requested three HR changes: remove CTC details from the employee profile,
keep "band details" (no band concept exists today — it must be added), and remove the
Payroll module. The reviewer's direction, confirmed in brainstorming: kill the org-wide
payout module, and give each employee a dedicated **Compensation** page carrying every
small-to-big pay detail — not just CTC — while the profile Overview stops showing pay data.

"Number of employees allocated to each project" from the same review is **already
satisfied** (project cards show team counts; project detail has a Team table). No work.

## Goals

1. Add an `Employee.band` field (free-text grade, e.g. "B1"), editable in the employee form.
2. Remove all pay data (CTC breakdown AND bank/statutory IDs) from the profile Overview.
3. New per-employee **Compensation** tab with the full breakdown, replacing the Payroll tab.
4. Delete the payroll feature from UI/API/code. **All `PayrollRecord` data stays in the DB.**

## Non-goals

- No band master table, salary ranges, or compensation change history (YAGNI).
- No schema removal: `PayrollRecord` and Employee compensation fields keep existing.
- Sub-projects B (BD rework), C (project taxonomy), D (Recruitment) — separate specs.

## Design

### Data model

One additive migration: `Employee.band String?` (nullable, free text, no index).
Band joins the Zod employee schema (`hr-validation.ts`), `EmployeeForm` (next to
designation/category), and the Excel import/export columns (`hr-excel.ts`).

### Employee hub

- **Overview** (`(hub)/page.tsx`): add a "Band" row to *Identity & Role*; delete the
  *Compensation* section (CTC, salary, LTA, special allowance, conveyance, monthly-gross
  hint) and the *Statutory & Leave* section (bank A/C, IFSC, PAN, UAN, ESIC) — both move
  to the Compensation tab. Delete the *Payslips* summary card; the bottom row becomes two
  cards (Assets, Projects). `payrollType` stays in Identity & Role (identity attribute).
- **Hub header**: add a Band snapshot chip when set.
- **Compensation tab** (`(hub)/compensation/page.tsx`): replaces "Payroll" in
  `EmployeeTabs`. Read-only `KeyValue` rows in three `DetailSection`s:
  *Pay structure* (Band, Total CTC, Salary, LTA, Special Allowance, Conveyance,
  monthly-gross hint), *Bank details* (A/C no, bank name, IFSC), *Statutory IDs*
  (PAN, UAN, ESIC). Editing stays in the existing employee edit form.
- **Redirect stub**: `(hub)/payroll/page.tsx` becomes a `redirect()` to
  `/hr/employees/[id]/compensation` so old bookmarks don't 404.
- **Access**: Compensation tab gates on `HR_VIEW` — the same exposure these fields have
  on today's Overview. Managers stay read-only by the existing write-set convention.

### Payroll removal (code only — data untouched)

Deleted outright (git history is the archive):

- Pages: `src/app/(erp)/hr/payout/page.tsx` + `loading.tsx`;
  print page `src/app/(print)/hr/payout/[id]/print/page.tsx`
- APIs: `src/app/api/hr/payroll/{route,batch/route,export/route,[id]/route}.ts`
- Components: `src/components/hr/PayrollEditor.tsx`, `src/components/hr/PayoutViewPills.tsx`
- Libs: `src/lib/hr-lop.ts`; payroll Zod schemas + `computePayrollTotals` in
  `hr-validation.ts` (verify no non-payroll callers first); payroll bits of `hr-excel.ts`

Adjusted:

- `src/lib/nav.tsx`: remove the Payout entry from HR and oversight nav.
- `src/components/CommandPalette.tsx`: remove the payout action.
- `(hub)/_data.ts`: stop fetching `payrolls`.
- `/hr` dashboard + `/overview`: remove payroll KPIs/trend series
  (`DashboardTrends`/`TrendBoard`/`SnapshotStrip`); remaining bento cells reflow.
- `src/lib/hr-status.ts` / `src/lib/hr-filters.ts`: prune payroll-only entries and the
  payout `?view=` param handling.
- `prisma/seed-demo.ts`: drop payroll sample data if it imports deleted helpers.

### Edge cases

- Deleted page routes fall through to the branded 404s; deleted API routes return
  Next's default 404 (acceptable).
- Attendance is untouched; the attendance→LOP linkage dies with payroll.
- `/api/hr/search` already returns a shaped payload without salary — unchanged.

## Verification

`npm run build` (the type-check catches every dangling import) + `npm run lint`; manual
pass over hub tabs (incl. the `/payroll` → `/compensation` redirect), HR dashboard,
oversight overview, nav, command palette, and a 404 check on `/hr/payout`.
