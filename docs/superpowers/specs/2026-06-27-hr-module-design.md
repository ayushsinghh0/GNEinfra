# HR Module — Design (Employees · Assets · Attendance · Payout · Analytics)

**Date:** 2026-06-27
**Branch:** `multi-role-erp` (builds on the RBAC foundation; replaces the HR "coming soon" shell)
**Status:** Design — approved verbally, pending written-spec review
**Source of requirements:** `HR , Manpower details.xlsx` (3 sheets: Man-EMID, Assest, Payout format) + product owner

---

## 1. Goal

Build the **HR department vertical** as the first fully-functional ERP module on top of the role
foundation. HR manages four data surfaces — **Employees** (the Man-EMID master), **Assets**,
**Attendance**, **Payout** (monthly payroll/payslips) — and manager/admin/superadmin get a
read-only **Analytics** view across all of it. The five line departments other than HR have no
access (siloed, per the foundation).

This is the **full HR vertical in one pass** (product owner's choice). Attendance is **entered by
HR**, not by employees (owner's choice) — so an `Employee` is a pure HR data record with **no login
account**; the existing BD/SCM/… staff users stay separate from this registry.

### Source workbook → surfaces (exact columns)

| Sheet | Becomes | Columns (verbatim from the workbook) |
|---|---|---|
| **Man - EMID** | `Employee` master | S.No, Name, Designation, Payroll, **EMP ID**, DOB, Date of Joining, Leaving, Emergency Number, Blood Group, I-Card, Location, Offer Letter issue date, Joining date, Total CTC, Salary, LTA, Special Allowance, Conveyance |
| **Assest** | `EmployeeAsset` | S.No, Emp Category, **Emp ID**, Name, Position, Mail Id, Location, Laptop, LP Serial No, Make/Model, Laptop Bag, Mouse, Charger, ID Card, LP category, OEM name |
| **Payout format** | `PayrollRecord` (monthly payslip) | Sl.No, D.O.J, Code, Name, Role, Designation, CTC · *Earnings:* Basic, HRA, CCA, Personal Pay, Conveyance, PLA, Medical Reimb, Total · *Deductions:* TDS, Loan Adv, EPF, ESI, Total Ded · Payable Amt, Remarks |

The workbook is an **empty template** (headers only); HR enters real data in-app.

---

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Attendance | Who enters it | **HR enters** (register grid); employees get NO login |
| Scope | This pass | **Full vertical** — Employees + Assets + Attendance + Payout + Analytics |
| ① Employee identity | Link to auth? | **Standalone** `Employee` entity; not linked to `User`/login |
| ② Import/Export | Excel | **Export yes, import deferred** (exceljs *reader* is broken here — missing `rimraf`; the *writer* works) |
| ③ Required on add | Which fields | **Name, EMP ID (unique), Designation, Emp Category, Date of Joining, Location**; rest optional |
| Payout | Calc model | HR **enters/edits** monthly figures; **Total / Total Ded / Payable auto-computed**; prefilled from the employee's salary structure (no full auto-calc engine) |
| Money | Storage | **Integer rupees** (whole ₹) — exact arithmetic, clean JSON serialization (no Prisma `Decimal` across the RSC boundary) |

---

## 3. Data model (additive Prisma — no `Role`/auth changes)

Five models + two enums. All money fields are `Int` (whole rupees). Additive migration only.

```prisma
enum EmployeeStatus { ACTIVE INACTIVE }

enum AttendanceStatus { PRESENT ABSENT LEAVE HALF_DAY HOLIDAY WEEK_OFF }

model Employee {
  id              String         @id @default(cuid())
  empId           String         @unique          // "EMP ID" — the business key
  name            String
  designation     String
  empCategory     String?                          // "Emp Category" (On-Roll, Contract, …)
  payrollType     String?                          // "Payroll" column
  mailId          String?
  location        String?
  emergencyNumber String?
  bloodGroup      String?
  iCardNo         String?                          // "I card"
  dob             DateTime?
  dateOfJoining   DateTime                         // "Date of Joining" (the duplicate "Joining date" column is collapsed into this)
  offerLetterDate DateTime?
  leavingDate     DateTime?
  status          EmployeeStatus @default(ACTIVE)

  // Salary structure (from Man-EMID), all whole rupees:
  totalCtc        Int?
  salary          Int?
  lta             Int?
  specialAllowance Int?
  conveyance      Int?

  assets      EmployeeAsset[]
  attendance  AttendanceRecord[]
  payrolls    PayrollRecord[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([location])
  @@index([designation])
}

model EmployeeAsset {
  id         String    @id @default(cuid())
  employeeId String
  employee   Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  hasLaptop  Boolean   @default(false)
  lpSerialNo String?                              // "LP Serials No"
  makeModel  String?                              // "Make / Model"
  lpCategory String?                              // "LP category"
  oemName    String?                              // "OEM name"
  laptopBag  Boolean   @default(false)
  mouse      Boolean   @default(false)
  charger    Boolean   @default(false)
  idCard     Boolean   @default(false)

  allocatedAt DateTime  @default(now())
  returnedAt  DateTime?

  @@index([employeeId])
}

model AttendanceRecord {
  id          String           @id @default(cuid())
  employeeId  String
  employee    Employee         @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  date        DateTime         @db.Date           // day only
  status      AttendanceStatus
  note        String?
  enteredById String?                              // User who recorded it

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, date])
  @@index([date])
}

model PayrollRecord {
  id          String   @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  periodYear  Int
  periodMonth Int                                  // 1-12

  // snapshot at run time:
  code        String?                              // "Code"
  role        String?
  designation String?
  doj         DateTime?
  ctc         Int?

  // Earnings (whole rupees):
  basic         Int @default(0)
  hra           Int @default(0)
  cca           Int @default(0)
  personalPay   Int @default(0)
  conveyance    Int @default(0)
  pla           Int @default(0)
  medicalReimb  Int @default(0)
  totalEarnings Int @default(0)                    // computed server-side = sum of earnings

  // Deductions:
  tds             Int @default(0)
  loanAdv         Int @default(0)
  epf             Int @default(0)
  esi             Int @default(0)
  totalDeductions Int @default(0)                  // computed = sum of deductions

  payableAmount Int @default(0)                    // computed = totalEarnings - totalDeductions
  remarks       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, periodYear, periodMonth])
  @@index([periodYear, periodMonth])
}
```

`totalEarnings`, `totalDeductions`, `payableAmount` are **always recomputed server-side** on
create/update from the component fields — never trusted from the client (the client total is a
display convenience only).

---

## 4. Routing & access

All HR pages live under the `(erp)` route group at `/hr/*`; APIs under `/api/hr/*`.

**New `rbac.ts` role-sets** (mirroring the vendor pattern): `HR_VIEW = [HR, MANAGER, ADMIN, SUPERADMIN]`,
`HR_WRITE = [HR, ADMIN, SUPERADMIN]` (MANAGER read-only).

| Route | Purpose | Guard |
|---|---|---|
| `/hr` | HR home / quick stats | `HR_VIEW` |
| `/hr/employees` (+ `/[id]`) | directory + add/edit employee | view `HR_VIEW`; mutate `HR_WRITE` |
| `/hr/assets` | asset register | view `HR_VIEW`; mutate `HR_WRITE` |
| `/hr/attendance` | monthly attendance grid | view `HR_VIEW`; mutate `HR_WRITE` |
| `/hr/payout` (+ `/[id]/print`) | monthly payroll + payslip | view `HR_VIEW`; mutate `HR_WRITE` |
| `/hr/analytics` | cross-HR analytics (read-only) | `HR_VIEW` |
| `/api/hr/employees`, `/employees/[id]` | CRUD | GET `HR_VIEW`; POST/PATCH/DELETE `HR_WRITE` |
| `/api/hr/assets`, `/assets/[id]` | CRUD | same split |
| `/api/hr/attendance` | bulk upsert grid | GET `HR_VIEW`; POST `HR_WRITE` |
| `/api/hr/payroll`, `/payroll/[id]` | upsert payslips | GET `HR_VIEW`; POST/PATCH `HR_WRITE` |
| `/api/hr/*/export` | xlsx export | `HR_VIEW` |

Every route guards itself with `getCurrentUser()` + the role-set + the `mustChangePassword` check
(consistent with the foundation's final-review hardening). Line roles (BD/SCM/PROJECT/FINANCE) get
no HR access. MANAGER sees every HR page but no mutate controls (UI hides them; APIs enforce via
`HR_WRITE`) — exactly the vendor-master pattern.

**Sidebar:** the HR section in `nav.tsx` swaps its "coming soon" items for real links — Dashboard
(`/hr`), Employees, Assets, Attendance, Payout, Analytics. (Manpower Planning & Recruitment stay
"coming soon" — out of scope here.)

---

## 5. The five surfaces

- **`/hr` Home** — `StatCard`s (active headcount, present today, on leave today, this month's net
  payroll) + shortcuts. Read for everyone with HR access.
- **`/hr/employees`** — searchable/filterable table (by status, location, designation). **Add/Edit**
  form with every Man-EMID field; required = Name, EMP ID, Designation, Emp Category, Date of
  Joining, Location (Zod in `src/lib/hr-validation.ts`, one source of truth for client + server).
  EMP ID unique (409 on dup). Detail page `/hr/employees/[id]` shows the employee + their assets,
  recent attendance, and latest payslip.
- **`/hr/assets`** — register grouped by employee; add/edit an asset allocation (laptop + accessory
  checkboxes, serial, make/model, OEM, category); mark returned.
- **`/hr/attendance`** — pick a month → grid of **active employees × days of month**; each cell is a
  status (P/A/L/H½/Holiday/Week-off) set via click-cycle or dropdown; "Save" bulk-upserts the
  month's records (`POST /api/hr/attendance` with `{ year, month, entries: [{employeeId, day, status}] }`).
  Per-row monthly tallies shown live. Atmosphere stays in chrome; the grid is plain (daylight
  legibility — design guardrail).
- **`/hr/payout`** — pick a month → rows for active employees; each row's earnings/deductions are
  editable; Total / Total Ded / Payable update live and are recomputed server-side on save
  (`POST /api/hr/payroll`). When no record exists yet for that employee+month, the new row is
  **prefilled** only from the fields that map cleanly from the employee record — `ctc ← totalCtc`,
  `basic ← salary`, `conveyance ← conveyance`, `designation ← designation`, `doj ← dateOfJoining`
  (and `code`/`role` blank) — every other earning (HRA, CCA, Personal Pay, PLA, Medical Reimb) and
  all deductions default to **0** for HR to fill. `/hr/payout/[id]/print` renders a printable
  payslip (reusing the `PrintBar` pattern from the vendor print page).
- **`/hr/analytics`** — bespoke SVG charts (`Charts.tsx` `AreaChart`/`Donut`) + `StatCard`s:
  headcount by location/designation/empCategory, attendance summary (present % this month, on-leave
  today), payroll totals (gross/deductions/net for the latest month + a few-month trend), asset
  allocation counts (laptops + accessories). Read-only; this is the oversight roles' primary HR view.

---

## 6. Export (no import)

- **Payslip:** printable page `/hr/payout/[id]/print` → browser print/PDF (no new dependency).
- **Excel:** `src/lib/hr-excel.ts` reusing the working exceljs **writer** (same pattern as
  `vendor-excel.ts`) for employee-list, attendance-register, and payroll exports, behind
  `GET /api/hr/*/export` (gated `HR_VIEW`).
- **Import is out of scope** (exceljs reader broken; workbook is empty). CSV import is the future path.

---

## 7. Out of scope (future)

- Employee self-service / employee logins (attendance is HR-entered) — would add an `EMPLOYEE` role.
- A full payroll **calc engine** (statutory EPF/ESI/TDS auto-computation) — HR enters figures now.
- Leave-request/approval workflow, Manpower Planning, Recruitment (stay "coming soon").
- Excel/CSV **import** of existing data.

---

## 8. Security & conventions (don't regress)

- Every page/route self-guards (`getCurrentUser` + role-set + `mustChangePassword`); MANAGER
  read-only enforced in BOTH UI and APIs (`HR_WRITE` excludes MANAGER).
- Computed money totals are server-authoritative; `Int` rupees end-to-end.
- Zod schemas are the field whitelist (`status` is server-set, not client-settable; EMP ID unique).
- Additive `prisma migrate` only (offline `migrate diff` in this env; runtime apply on Neon).
- "Soft Wave" design system: compose `ui.tsx`/`chrome.tsx`/`Charts.tsx`; atmosphere only in chrome,
  never behind the attendance grid or data tables; `.nums` on money/dates/codes; bespoke SVG charts
  (no chart libs).

---

## 9. Migration & rollout

1. Additive migration: `Employee`, `EmployeeAsset`, `AttendanceRecord`, `PayrollRecord` + the two
   enums (offline `prisma migrate diff`; `prisma generate` regenerates the client).
2. Build the surfaces; gate = `npm run build` + `npm run lint` (no test runner; DB/runtime deferred
   to Neon deploy, Docker down locally).
3. Ships on the same `multi-role-erp` branch as the foundation it depends on.
