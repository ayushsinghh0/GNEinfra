# HR positions + payroll page + payment slip — design

**Date:** 2026-07-08
**Status:** Approved (via brainstorming)

## Goals

1. New employees pick a **Designation** from a preset list of positions (+ "Other").
2. **Remove salary/CTC (and bank/statutory) from the employee form + profile** —
   salary is decided later.
3. A new **`/hr/payroll` page** is the single home for CTC, person-wise.
4. A printable **payment slip** per employee, from the pay structure.

Decisions: designation = dropdown **+ Other** · payroll = **new `/hr/payroll` list
page** · bank/statutory **move to payroll** with CTC · payslip **from the pay
structure** with **earnings + optional deductions → net**.

## Positions

`EMPLOYEE_POSITIONS` (hr-validation): Assistant Manager – Solar EPC · Solar Plant
Supervisor · Health, Safety & Environment (HSE) · Project Coordinator · Civil
Engineer · Electrical Engineer · Supply Chain Manager. The employee form renders
`designation` as a `<Select>` of these + **"Other"**, which reveals a free-text
input (an existing non-listed designation seeds "Other" on edit). `designation`
stays a free string in the schema (max length unchanged) — the dropdown is a UI
convenience, so legacy values keep working.

## Pay leaves the employee record

- **EmployeeForm** drops the **Compensation** section (totalCtc/salary/lta/
  specialAllowance/conveyance) and the **bank + statutory** fields (bankAccountNo/
  bankName/ifsc/panNo/uan/esicNo). Leave quotas stay (section → "Leave").
- **`employeeSchema`** drops those 11 fields; the employee create/update routes
  stop writing them → a new hire is created with null pay, and editing an employee
  never overwrites pay entered later on the payroll page.
- **Compensation tab** removed from `EmployeeTabs`; `(hub)/compensation/page.tsx`
  **redirects to `/hr/payroll/[id]`** (keeps old links alive).

## Payroll page

- **`/hr/payroll`** (HR_VIEW): `DataTable` of employees — name (`EntityLink`) ·
  band · designation · CTC · net-monthly (gross − deductions). Search + active
  filter. Row → `/hr/payroll/[id]`.
- **`/hr/payroll/[id]`** (HR_VIEW; edit HR_WRITE): a `PayrollForm` (client) with
  **Pay** (CTC, salary, LTA, special allowance, conveyance), **Bank** (A/C, name,
  IFSC), **Statutory** (PAN, UAN, ESIC), **Deductions** (PF, ESI, TDS, other) — a
  live gross/net summary. Header has a **"Payment slip"** link. `key={id}`
  (remount rule).
- **`payrollSchema`** (hr-validation): the pay/bank/statutory + 4 deduction money
  fields, all optional. Server + client validate identically.
- **`PATCH /api/hr/payroll/[id]`** (HR_WRITE): updates only those fields on the
  Employee. `GET` for the editor is the page's own Prisma read.
- **Nav:** "Payroll" re-added to the HR section → `/hr/payroll`.

## Payment slip

- **`(print)/hr/payroll/[id]/slip/print/page.tsx`** (HR_VIEW; outside the shell,
  print-clean) — company "From" block via `getCompany()`, employee identity
  (name / EMP ID / designation / band / bank A/C + IFSC / PAN / UAN),
  **Earnings** (salary, LTA, special allowance, conveyance → **Gross**),
  **Deductions** (PF, ESI, TDS, other → total), **Net Pay**. Reuses `PrintBar` +
  the salary-slip styling conventions of the finance print docs.
- Amounts are the stored monthly structure values (integer rupees); net = gross −
  deductions. A `notFound()` guards a missing employee.

## Migration (additive)

`Employee` gains `pfDeduction`, `esiDeduction`, `tdsDeduction`, `otherDeduction`
(all `Int?`, integer rupees). Pay/bank/statutory columns already exist. No column
is dropped.

## RBAC / conventions

HR_VIEW views payroll + slip; HR_WRITE edits; `mustChangePassword` rejected;
**managers read-only** (view CTC like the old Compensation tab, no edit). Money is
integer rupees. The monthly `PayrollRecord` module stays removed — this is CTC
master data + a structure-based slip, not monthly payroll runs. `/hr/search`
already returns a shaped payload (no raw salary) — unchanged.

## Verification

`npx tsc --noEmit` + `npm run lint` + `npm run build`. Functional: create an
employee (no salary prompt), set their CTC + deductions on the payroll page,
open the payment slip and confirm gross/net, and confirm editing the employee
doesn't wipe the pay.

## Out of scope

Monthly payslip runs / attendance-LOP; payslip emailing; bulk CTC edit.
