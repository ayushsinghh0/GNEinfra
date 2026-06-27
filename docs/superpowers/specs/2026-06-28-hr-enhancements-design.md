# HR Enhancements — Projects, Leave Balances, Premium Salary Slip

**Date:** 2026-06-28
**Branch:** `multi-role-erp` (builds on the just-completed HR module)
**Status:** Design — approved verbally, pending written-spec review
**Base:** extends `docs/superpowers/specs/2026-06-27-hr-module-design.md`

---

## 1. Goal

Round out the HR vertical with three product owner-requested capabilities, plus the gaps a
real HR system needs:

1. **Multi-project allocation** — a Project master HR maintains, and per-employee assignments so
   one employee can work on **several projects concurrently** (with a role + allocation % + dates).
2. **Leave & sick tracking with balances** — a distinct **Sick** attendance status, plus annual
   **quota → taken → remaining** balances per employee (casual + sick).
3. **A premium, print-to-PDF salary slip** — a professionally designed A4 payslip with the gne
   infra letterhead, paid-days from attendance, and **net pay in words**.
4. **Comprehensive employee page** — one page showing everything about a person.
5. **Richer analytics** — project allocation + leave summary on top of the existing views.

Access is unchanged: HR manages everything; **manager read-only** (UI hides mutate controls,
APIs enforce via `HR_WRITE`); admin/superadmin RW; line roles no HR access. Money stays **integer
rupees**. All new routes reuse the `getCurrentUser()` + role-set + `mustChangePassword` guard.

---

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Projects | model | **Project master** (name/code/client/status) + **ProjectAssignment** (role, allocation %, dates); concurrent assignments per employee |
| Leave | depth | **Sick status** + **balances/quotas** (annual allotted → taken → remaining) |
| Slip | PDF | **Premium print-to-PDF** (no new dependency; quality via design) |
| ① Carry-forward | leave balances | **None in v1** — flat annual quota per employee; *taken* counted from that calendar year's attendance; *remaining = quota − taken*; resets each year |
| ② Slip optional fields | bank/PAN/UAN | shown on the slip **only when filled** (all optional) |
| Migration | enum + tables | **A new additive migration** (`ALTER TYPE ADD VALUE 'SICK'`, `ALTER TABLE Employee ADD …`, `CREATE TABLE Project`/`ProjectAssignment`) — does NOT re-touch the reviewed `hr_module` migration |

---

## 3. Data model (additive)

```prisma
// AttendanceStatus gains SICK (LEAVE = paid/casual leave; SICK = sick leave):
enum AttendanceStatus { PRESENT ABSENT LEAVE SICK HALF_DAY HOLIDAY WEEK_OFF }

enum ProjectStatus { ACTIVE ON_HOLD COMPLETED }

// Employee gains (all additive columns):
//   casualLeaveQuota Int  @default(12)
//   sickLeaveQuota   Int  @default(12)
//   bankAccountNo    String?
//   uan              String?   // PF/UAN, for the salary slip
//   panNo            String?
//   projectAssignments ProjectAssignment[]   // back-relation

model Project {
  id        String        @id @default(cuid())
  name      String
  code      String        @unique
  client    String?
  status    ProjectStatus @default(ACTIVE)
  startDate DateTime?
  endDate   DateTime?
  assignments ProjectAssignment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status])
}

model ProjectAssignment {
  id            String    @id @default(cuid())
  employeeId    String
  employee      Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  roleOnProject String?
  allocationPct Int?      // 0–100
  startDate     DateTime
  endDate       DateTime? // null = ongoing
  createdAt     DateTime  @default(now())
  @@unique([employeeId, projectId])
  @@index([employeeId])
  @@index([projectId])
}
```

`ProjectAssignment` cascades from both Employee and Project (an assignment is a link, not
compliance history — unlike payroll/attendance, which stay `Restrict`). Multiple active rows
per employee = concurrent projects; `@@unique([employeeId, projectId])` prevents duplicate
assignment to the same project.

---

## 4. Leave balances (computed, not stored)

For an employee, for a given calendar **year** `Y`:
- `casualTaken` = count of `AttendanceRecord` where `status = LEAVE` and `date` in `[Y-01-01, Y-12-31]` (UTC).
- `sickTaken` = count where `status = SICK` in that window.
- `casualRemaining = max(0, employee.casualLeaveQuota − casualTaken)`; likewise sick.
A shared helper `leaveBalances(employeeId, year)` (server, in `src/lib/hr-leave.ts`) returns
`{ casualQuota, casualTaken, casualRemaining, sickQuota, sickTaken, sickRemaining }`. Used by the
employee page and analytics. Quotas are HR-editable on the employee form.

---

## 5. Surfaces

- **`/hr/projects`** (new) — HR maintains the project master: searchable list + **add/edit** (name,
  code unique, client, status, start/end). New sidebar item "Projects". Detail `/hr/projects/[id]`
  shows the project + its assigned employees. Mutations gated `HR_WRITE`.
- **Project assignment** — from the **employee detail page**, an "Assign to project" control (HR
  only): pick a Project + role + allocation % + start date (+ optional end). Lists the employee's
  current assignments with a remove (HR only). `POST /api/hr/assignments`, `DELETE /api/hr/assignments/[id]`.
- **Employee detail page** (`/hr/employees/[id]`, big upgrade) — one comprehensive page:
  personal/statutory fields · **project assignments** (+ assign control) · **attendance summary**
  (present/absent/leave/sick/half-day counts for the current year) + **leave balances** (casual &
  sick: allotted/taken/remaining) · **all payslips** (each links to its salary slip) · assets.
- **Attendance grid** — adds the **Sick** mark ("S", amber-orange), included in the click-cycle and
  the per-row tallies. (Adding `SICK` to `ATTENDANCE_STATUSES` flows through the existing grid.)
- **Premium salary slip** (`/hr/payout/[id]/print`, redesigned, stays in the `(print)` group) —
  A4 layout: **gne infra letterhead** (logo) · "Salary Slip — {Month} {Year}" · employee block
  (name, EMP ID, designation, DOJ; bank a/c, PAN, UAN **only if filled**) · **Paid days / LOP days**
  for that month (from attendance, §6) · two-column **Earnings** (Basic/HRA/CCA/Personal Pay/
  Conveyance/PLA/Medical Reimb → Total) and **Deductions** (TDS/Loan Adv/EPF/ESI → Total Ded) tables
  · **Net Pay** (= payableAmount) and **amount in words** (Indian, §7) · "system-generated, no
  signature required" note + footer. Print CSS for clean A4 (`@media print`).
- **Analytics** (`/hr/analytics`, upgrade) — adds **Project allocation** (headcount per active
  project + an "unassigned / bench" count) and a **Leave summary** (total casual + sick taken this
  month and this year) alongside the existing headcount/attendance/payroll/asset sections.

An **active assignment** = a `ProjectAssignment` whose `endDate` is null OR `endDate ≥ today` (UTC).
"Bench" = ACTIVE employees with zero active assignments. "Headcount per project" counts active
assignments grouped by project. Both the employee page and analytics use this same definition.

---

## 6. Paid-days computation (salary slip)

For the slip's `periodYear`/`periodMonth`, query that employee's `AttendanceRecord`s in the month
(UTC window). Let `daysInMonth` = calendar days, `absent` = count(ABSENT), `half` = count(HALF_DAY).
Then **`lopDays = absent + 0.5 × half`** and **`paidDays = daysInMonth − lopDays`**. The slip shows
Days in Month, Paid Days, LOP Days. (Earnings are HR-entered figures and are NOT auto-prorated by
paid days in v1 — the days are informational; note this explicitly so no one expects auto-proration.)

## 7. Amount in words

A pure helper `amountInWords(rupees: number): string` (`src/lib/number-to-words.ts`) — Indian
numbering (crore / lakh / thousand / hundred), e.g. `123456 → "Rupees One Lakh Twenty Three Thousand
Four Hundred Fifty Six Only"`. Handles 0 → "Rupees Zero Only" and is capped at a sane max
(≤ 99,99,99,999). Pure + unit-checkable via `npx tsx`.

---

## 8. Validation & API

Extend `src/lib/hr-validation.ts`:
- `ATTENDANCE_STATUSES` gains `"SICK"` (keep the `AttendanceStatusValue` type in sync).
- `employeeSchema` gains optional `casualLeaveQuota`/`sickLeaveQuota` (money0-style non-negative int,
  defaulting to 12 on create), and optional `bankAccountNo`/`uan`/`panNo` (trimmed strings).
- New `projectSchema` (name required, code required+unique-checked at the route, client?, status enum,
  start/end optional ISO) and `assignmentSchema` (employeeId, projectId required; roleOnProject?,
  allocationPct 0–100?, startDate required, endDate?).

New API routes (all self-guard; GET = `HR_VIEW`, mutations = `HR_WRITE`, all + `mustChangePassword`,
`status: user ? 403 : 401`; P2002 code → 409, P2025 → 404):
- `GET/POST /api/hr/projects`, `PATCH/DELETE /api/hr/projects/[id]`.
- `POST /api/hr/assignments`, `DELETE /api/hr/assignments/[id]`.
The employee `POST`/`PATCH` already exist; they pick up the new optional fields via the extended
schema.

**Nav:** add a "Projects" item (`href: "/hr/projects"`) to the HR section in `nav.tsx`, using
`FolderKanban` if the installed `lucide-react` exports it, else the already-imported `HardHat`.

---

## 9. Out of scope (flagged)

Employee document uploads (offer letter / ID proof — could reuse the existing storage system later);
leave **application/approval** workflow (HR-entered, by design); reporting-manager hierarchy;
auto-proration of salary by paid days; leave carry-forward/accrual. Each is a clean future addition.

---

## 10. Migration & conventions

One **new additive** migration authored offline (`prisma migrate diff` from the committed schema to
the new schema): `ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK'`, `ALTER TABLE "Employee" ADD`
(quotas + bank/uan/pan), `CREATE TYPE "ProjectStatus"`, `CREATE TABLE "Project"` + `"ProjectAssignment"`
+ indexes/FKs. Purely additive — Neon-safe with the HR data already there. `prisma generate` offline.
Gate = `npm run build` + `npm run lint`; runtime deferred to Neon deploy. Design system unchanged
(compose `ui.tsx`/`chrome.tsx`/`Charts.tsx`; atmosphere only in chrome; `.nums` on money/dates; the
salary slip and grid are plain/print-clean).
