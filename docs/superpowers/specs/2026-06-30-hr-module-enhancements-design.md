# HR Module Enhancements — Design

- **Date:** 2026-06-30
- **Branch:** `multi-role-erp`
- **Scope:** HR role / `/hr/*` module only. No changes to BD, SCM, Project, Finance, vendor flows, auth, or oversight pages except where a shared UI primitive (`ui.tsx`, `Charts.tsx`) is extended additively.
- **Status:** Awaiting user review.

## 1. Background & motivation

The user requested a batch of HR changes. Exploration of the current `multi-role-erp` branch shows the request is partly **already implemented** and partly **genuinely new**. This spec records the true starting state and the agreed work.

### Already implemented (no new fields needed)

Every employee field the user listed already exists in `prisma/schema.prisma` (`Employee`), in the shared Zod `employeeSchema` (`src/lib/hr-validation.ts`), and in the create/edit form `src/components/hr/EmployeeForm.tsx`, and is shown on the detail page:

- Date of Leaving → `leavingDate`
- Emergency No. → `emergencyNumber`
- Blood Group → `bloodGroup`
- Offer Letter issue → `offerLetterDate`
- Total CTC → `totalCtc`
- Salary → `salary`
- LTA → `lta`
- Special Allowance → `specialAllowance`
- Conveyance Allowance → `conveyance`
- Mail ID → `mailId`, Location → `location`

The real problem for employees is **UX**: all 24 fields render in one flat `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with no headings, and the detail page stacks 7 cards vertically (heavy scrolling).

## 2. Goals

1. **Employees** — reorganize the form into labeled sections; tab the detail page.
2. **Assets** — surface `Position / Mail ID / Location` (auto from the linked employee); add the missing Edit / Delete / Mark-returned UI.
3. **Attendance** — remove autofill; add a month/year picker (also on Payout).
4. **Payslip** — add LTA & Special Allowance as earnings; surface stored fields; add a company/statutory header + optional bank/ESIC details.
5. **Dashboard + Analytics** — merge into one `/hr` page with an interactive pill/segmented control and a pill-driven ("pill-wise") trend graph.
6. **UI/UX** — consistent, polished, Soft-Wave-compliant chrome and section navigation across every HR page; eliminate excessive scrolling via sticky tab/pill nav on long pages.

### Non-goals (YAGNI)

- No new departments, no oversight/overview changes, no vendor changes.
- No chart or animation libraries (bespoke SVG/CSS only — project guardrail).
- No ML — analytics keep least-squares trend (`src/lib/hr-forecast.ts`).
- No PDF generator — the printable slip stays a `(print)` HTML page.
- Payslip statutory header uses a single static company-config constant, not a per-tenant settings UI.

## 3. Decisions (defaults chosen; user may veto any)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Employee fields | Already present — work is **reorganize + polish**, not add. |
| D2 | Asset `Position/Mail ID/Location` | **Auto-pull from linked employee** (Position = `designation`, Mail ID = `mailId`, Location = `location`). Read-only on the asset; no duplicate storage; always in sync. |
| D3 | Asset Edit/Delete/Return | Wire the existing `[id]` PATCH/DELETE API to real UI (row actions + a "Mark returned" date). |
| D4 | Attendance autofill | **Remove** both entry points (toolbar button + per-row ✨ `Sparkles`). |
| D5 | Month navigation | Add a **month + year picker** (label opens a popover with a 12-month grid + year stepper) on **attendance and payout**; keep prev/next chevrons. |
| D6 | Payslip additions | (a) **LTA + Special Allowance** as new earnings line items; (b) surface already-stored fields (location, category, CTC, code/role); (c) **company/statutory header**; (d) optional bank **IFSC/branch + ESIC** numbers. |
| D7 | Dashboard combine | Merge `/hr` (home) + `/hr/analytics` into one `/hr` page; remove the separate Analytics nav entry (redirect `/hr/analytics` → `/hr`). |
| D8 | Pill-wise graph | New `Segmented` pill component. Metric pills (**Payroll · Headcount · Attendance · Leave · Projects**) switch the active trend chart; a second range pill row (**6 mo · 12 mo**) sets the window. |
| D9 | Long-page scrolling | Sticky **tab/pill section nav** on employee detail and on the attendance page (jump-to instead of scroll). |

## 4. Architecture & components

### 4.1 New shared primitives

- **`Segmented`** (`src/components/ui.tsx`, `"use client"`): a controlled pill/segmented control. Props `{ options: {value,label,icon?}[]; value; onChange; size?; ariaLabel }`. Visual language mirrors the existing AttendanceGrid brush buttons (`press rounded-xl border px-2.5 py-1.5 text-xs font-medium`, active = brand fill). Keyboard: arrow-key roving focus, `role="tablist"`/`radiogroup`, `aria-pressed`. Motion gated on `prefers-reduced-motion`.
- **`SectionNav`** (sticky pill/tab bar): thin wrapper over `Segmented` that scroll-spies anchored `<section>`s and smooth-scrolls on click (smooth-scroll disabled under reduced-motion). Used on long pages.
- **`MonthPicker`** (`src/components/hr/MonthPicker.tsx`, `"use client"`): button showing the current month label; opens a popover with a 12-cell month grid + prev/next-year stepper. On select it `router.push`es `?year=&month=` (keeps the existing URL-param contract, so server pages are unchanged in how they read the period). Replaces/augments the chevron-only nav on attendance + payout headers.

### 4.2 Pill-wise analytics graph

- New client component **`TrendBoard`** (`src/components/hr/TrendBoard.tsx`): receives all precomputed series from the server (payroll actual+forecast, headcount, attendance-rate, leave-burn, project-utilization) as plain arrays, holds `metric` + `range` pill state, and renders the matching existing chart (`ForecastArea` for payroll, `AreaChart` for the rest; `idPrefix` per metric to avoid gradient-ID collisions). No new chart math — feeds existing `Charts.tsx` components. Server (`/hr/page.tsx`) does all Prisma aggregation (moved/merged from the current `analytics/page.tsx`).
- The merged `/hr` page keeps the KPI bento + DeltaBadges from analytics, adds the `TrendBoard`, and keeps the quick-links.

### 4.3 Per-area changes

- **Employees** (`EmployeeForm.tsx`): wrap fields in 4 `<fieldset>`/section blocks with `<legend>`s — *Identity & Role* (empId, name, designation, empCategory, location, dateOfJoining, status-derived), *Contact & Personal* (mailId, emergencyNumber, bloodGroup, iCardNo, dob, offerLetterDate, leavingDate, payrollType), *Compensation* (totalCtc, salary, lta, specialAllowance, conveyance), *Statutory & Leave* (bankAccountNo, ifsc, bankName, panNo, uan, esicNo, casualLeaveQuota, sickLeaveQuota). Detail page (`[id]/page.tsx`) gets `SectionNav` tabs over its cards.
- **Assets** (`assets/page.tsx`, `AssetForm.tsx`): table gains Position/Mail/Location columns from the `employee` relation (already `include`d); the form shows them read-only once an employee is picked (client-side lookup from the passed employee list). Add row actions: Edit (opens form prefilled — extend `AssetForm` to PATCH when given an `id`), Delete (confirm), and a "Mark returned" control that PATCHes `returnedAt`. No schema change for assets.
- **Attendance** (`AttendanceGrid.tsx`): delete `autofill` fn, the toolbar Autofill `Button`, and the per-row `Sparkles` button. Add `MonthPicker` to the page header. Add a sticky in-grid **jump bar** (Segmented or a compact employee quick-jump) + keep the search filter, so you reach any employee without long scrolling.
- **Payout** (`PayrollEditor.tsx`, payslip print page): add `lta` + `specialAllowance` to the `EARNINGS` array (prefilled from employee master, editable); update `splitFromGross` to leave them untouched. Add `MonthPicker` to the header. Print page (`(print)/hr/payout/[id]/print/page.tsx`): add LTA + Special Allowance rows to the earnings table, a company/statutory header block (from a new `src/lib/company.ts` constant), surface location/category/CTC/code/role, and bank IFSC/branch + ESIC rows when present.

## 5. Data model & migrations (additive only)

Per `CLAUDE.md`, migrations are additive and authored via `prisma migrate dev` (or offline `prisma migrate diff` when no DB is reachable — local dev DB is drifted, so offline authoring is expected). One new migration `*_hr_payslip_fields`:

- `PayrollRecord`: `lta Int @default(0)`, `specialAllowance Int @default(0)` (integer rupees, like other earnings).
- `Employee`: `ifsc String?`, `bankName String?`, `esicNo String?` (all optional).

`computePayrollTotals` (`src/lib/hr-validation.ts`) updated:
`totalEarnings = basic + hra + cca + personalPay + conveyance + pla + medicalReimb + lta + specialAllowance`. `payrollSchema` gains `lta`/`specialAllowance` as `money0`; `employeeSchema` gains `ifsc`/`bankName`/`esicNo` as optional trimmed strings. Totals remain **server-recomputed** (never trust client).

## 6. RBAC & security (preserve invariants)

- All new/changed pages keep `requirePageRole(HR_VIEW)`; mutations stay `HR_WRITE` (MANAGER read-only) in **both** UI (`canWrite`) and every API route, and reject `mustChangePassword`.
- New asset Edit/Delete/Return UI is gated by `canWrite`; the PATCH/DELETE routes already self-guard `HR_WRITE`.
- No new unauthenticated endpoints; URL-param month changes need no new API. The print page keeps its own `getCurrentUser()` + `HR_VIEW` guard.

## 7. UI/UX guardrails (Soft Wave)

- Light mode only; brand atmosphere only in chrome (heroes/headers), never behind fields or data tables.
- All motion gated on `prefers-reduced-motion`; transparency on `prefers-reduced-transparency`.
- `BrandHero` headers consistently (mint/sm) on dashboard-style pages; `PageHeader` on data-grid pages (attendance/payout).
- Tabular `.nums` on codes/money/dates; 16px inputs; 44px tap targets; `:focus-visible` rings.
- No new libraries.

## 8. Verification

`npm run build` (full type-check) + `npm run lint` must pass — these are the only gates (no test runner). Manual smoke against a fresh seeded DB (`db:seed` + `db:seed:demo`) for: employee create/edit, asset edit/delete/return, attendance month-jump + no-autofill, payslip with LTA/Special Allowance + company header, merged dashboard pill switching.

## 9. Open questions / risks

- **Company header content** (address, PAN/GST/CIN) — needs real values; spec uses placeholders in `src/lib/company.ts` until provided.
- **"Position" on assets** assumed to mean job designation; if it means a physical/seating position, it becomes an editable asset field instead (small change).
- Bank IFSC/ESIC are new optional fields; if undesired they can be dropped from D6 with no other impact.
