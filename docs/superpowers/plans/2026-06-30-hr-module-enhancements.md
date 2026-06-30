# HR Module Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish and extend the GNE ERP HR module (HR role only) — sectioned employee form + tabbed detail, asset Position/Mail/Location + edit/delete/return UI, attendance autofill removal + month picker, richer salary slip (LTA/Special Allowance + company/bank header), and a merged HR dashboard with an interactive pill-driven trend graph.

**Architecture:** Next.js 16 App Router + Prisma/Postgres. Server RSC pages do Prisma aggregation and pass plain data to focused client components. New interactive pieces (`Segmented`, `SectionNav`, `MonthPicker`, `TrendBoard`) are isolated `"use client"` files so the existing server-safe `ui.tsx` stays server-renderable. Money is integer rupees; payslip totals are recomputed server-side. Migrations are additive.

**Tech Stack:** Next.js 16 (App Router, async `params`/`searchParams`), React 19, Prisma, Zod, Tailwind v4 (`@theme` tokens, Soft Wave design system), lucide-react icons. Bespoke SVG charts (`Charts.tsx`) — no chart libraries.

## Global Constraints

- **HR scope only.** Touch only `/hr/*`, `/api/hr/*`, the payslip `(print)` page, HR components under `src/components/hr/`, shared primitives (`ui.tsx`, `Charts.tsx`, new component files), `src/lib/hr-validation.ts`, `src/lib/nav.tsx`, `prisma/schema.prisma`. No BD/SCM/Project/Finance/vendor/auth changes.
- **Verification gate (no test runner):** every task ends with `npm run build` (full TypeScript type-check) AND `npm run lint` both passing. There is no unit-test framework; do NOT add one.
- **Money = integer rupees** (Prisma `Int`, no `Decimal`). Payslip totals are server-recomputed via `computePayrollTotals`; never trust client totals.
- **RBAC:** `HR_VIEW = [HR, MANAGER, ADMIN, SUPERADMIN]` (read); `HR_WRITE = [HR, ADMIN, SUPERADMIN]` (MANAGER excluded). Every page calls `requirePageRole(HR_VIEW)`; mutations gated by `canWrite = HR_WRITE.includes(viewer.role)` in UI AND re-checked in every API route, which also reject `user.mustChangePassword`.
- **Migrations are additive only.** Never reset/squash. Local dev DB is schema-drifted — author migrations and run `npx prisma generate` offline if no DB is reachable.
- **UI guardrails (Soft Wave):** light mode only; brand atmosphere (gradient/glow/grain/waves) only in chrome (heroes/headers), never behind form fields or data tables. Gate all motion on `prefers-reduced-motion`. Tabular `.nums` on codes/money/dates. 16px inputs (`text-base sm:text-sm`), 44px tap targets, `:focus-visible` rings. No new dependencies.
- **Date storage:** `AttendanceRecord.date` is `@db.Date` at UTC midnight; payroll periods use `periodYear`/`periodMonth` (month 1–12). Compute all windows in UTC.
- **Commits:** branch is `multi-role-erp`. Commit after each task. End commit messages with the trailer required by the repo (`Co-Authored-By: Claude ...` / `Claude-Session: ...`).

---

### Task 1: Schema fields, migration, validation & payroll totals

**Files:**
- Modify: `prisma/schema.prisma` (Employee block ~290-330; PayrollRecord block ~366-397)
- Create: `prisma/migrations/<UTC-timestamp>_hr_payslip_fields/migration.sql`
- Modify: `src/lib/hr-validation.ts` (employeeSchema ~36-61; payrollSchema ~91-103; computePayrollTotals ~128-136)

**Interfaces:**
- Produces: `Employee.ifsc/bankName/esicNo` (`String?`); `PayrollRecord.lta/specialAllowance` (`Int @default(0)`). `payrollSchema` now parses `lta`/`specialAllowance` (default 0). `computePayrollTotals` accepts `lta`/`specialAllowance` and includes them in `totalEarnings`. `employeeSchema` parses `ifsc`/`bankName`/`esicNo` (optional strings).

- [ ] **Step 1: Add columns to the Prisma schema**

In `prisma/schema.prisma`, inside `model Employee`, add three optional bank/statutory columns next to the existing `bankAccountNo`/`uan`/`panNo` group (after line 317 `panNo String?`):

```prisma
  casualLeaveQuota   Int     @default(12)
  sickLeaveQuota     Int     @default(12)
  bankAccountNo      String?
  bankName           String?
  ifsc               String?
  uan                String?
  panNo              String?
  esicNo             String?
```

Inside `model PayrollRecord`, add two earnings columns. Place them in the earnings group (after line 381 `conveyance Int @default(0)`), so the order reads:

```prisma
  basic         Int @default(0)
  hra           Int @default(0)
  cca           Int @default(0)
  personalPay   Int @default(0)
  conveyance    Int @default(0)
  lta              Int @default(0)
  specialAllowance Int @default(0)
  pla           Int @default(0)
  medicalReimb  Int @default(0)
  totalEarnings Int @default(0)
```

- [ ] **Step 2: Create the additive migration**

If a dev database is reachable, run `npm run db:migrate -- --name hr_payslip_fields` (this creates the timestamped folder, applies it, and regenerates the client) and skip to Step 4.

If no DB is reachable (local dev DB is drifted — the expected case), author it offline. Create `prisma/migrations/20260630120000_hr_payslip_fields/migration.sql` (replace `20260630120000` with the current UTC timestamp in `YYYYMMDDHHMMSS` form) containing:

```sql
-- AlterTable: Employee bank/statutory additions (all nullable)
ALTER TABLE "Employee" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "ifsc" TEXT;
ALTER TABLE "Employee" ADD COLUMN "esicNo" TEXT;

-- AlterTable: PayrollRecord earnings additions (non-null, default 0)
ALTER TABLE "PayrollRecord" ADD COLUMN "lta" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRecord" ADD COLUMN "specialAllowance" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success; no schema validation errors.

- [ ] **Step 4: Extend `employeeSchema` with the new optional fields**

In `src/lib/hr-validation.ts`, inside `employeeSchema` (after the `bankAccountNo`/`uan`/`panNo` lines, ~58-60), add:

```ts
  bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  ifsc: z.string().trim().max(11).optional().or(z.literal("")),
  uan: z.string().trim().max(20).optional().or(z.literal("")),
  panNo: z.string().trim().max(10).optional().or(z.literal("")),
  esicNo: z.string().trim().max(20).optional().or(z.literal("")),
```

- [ ] **Step 5: Extend `payrollSchema` and `computePayrollTotals`**

In `payrollSchema` (the earnings line ~99-100), add `lta` and `specialAllowance` as required-default-0 money:

```ts
  basic: money0, hra: money0, cca: money0, personalPay: money0,
  conveyance: money0, lta: money0, specialAllowance: money0, pla: money0, medicalReimb: money0,
  tds: money0, loanAdv: money0, epf: money0, esi: money0,
```

Replace `computePayrollTotals` (lines 128-136) with the version that includes the two new earnings:

```ts
// Server-authoritative totals — earnings sum, deductions sum, net payable.
export function computePayrollTotals(p: {
  basic: number; hra: number; cca: number; personalPay: number;
  conveyance: number; lta: number; specialAllowance: number; pla: number; medicalReimb: number;
  tds: number; loanAdv: number; epf: number; esi: number;
}) {
  const totalEarnings =
    p.basic + p.hra + p.cca + p.personalPay + p.conveyance +
    p.lta + p.specialAllowance + p.pla + p.medicalReimb;
  const totalDeductions = p.tds + p.loanAdv + p.epf + p.esi;
  return { totalEarnings, totalDeductions, payableAmount: totalEarnings - totalDeductions };
}
```

- [ ] **Step 6: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: build fails with type errors in `PayrollEditor.tsx` / payout page / payroll route / slip page because they don't yet supply `lta`/`specialAllowance` to `computePayrollTotals`. **This is expected** — those callers are fixed in Tasks 4-6. If you are executing tasks strictly one-at-a-time with a green gate per task, instead combine the build gate with Task 5 (PayrollEditor) which makes the editor type-check; for now confirm the ONLY errors are the missing `lta`/`specialAllowance` properties on payroll callers. `npm run lint` should pass.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/hr-validation.ts
git commit -m "feat(hr): add LTA/Special Allowance payroll earnings + bank/ESIC employee fields"
```

---

### Task 2: Company config constant for the salary slip

**Files:**
- Create: `src/lib/company.ts`

**Interfaces:**
- Produces: `export const COMPANY` with `{ name, addressLines: string[], pan, gstin, cin, email, phone }` — consumed by the salary-slip print page (Task 3).

- [ ] **Step 1: Create the company config**

Create `src/lib/company.ts`. These are placeholders flagged in the spec — the user will supply real values; keep the shape stable:

```ts
// Static company details printed on the salary slip header.
// Replace placeholder values with the real registered-office details.
export const COMPANY = {
  name: "GNE Infra",
  addressLines: [
    "Registered Office address line 1",
    "City, State – PIN",
  ],
  pan: "",       // company PAN, e.g. "AAAAA0000A"
  gstin: "",     // GSTIN
  cin: "",       // CIN
  email: "",     // HR/payroll contact email
  phone: "",     // contact phone
} as const;
```

- [ ] **Step 2: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: no new errors from this file (it is unused until Task 3). Same pre-existing payroll-caller errors from Task 1 may remain.

- [ ] **Step 3: Commit**

```bash
git add src/lib/company.ts
git commit -m "feat(hr): add company config constant for salary slip"
```

---

### Task 3: Salary slip — LTA/Special Allowance, company header, bank & statutory detail

**Files:**
- Modify: `src/app/(print)/hr/payout/[id]/print/page.tsx`

**Interfaces:**
- Consumes: `COMPANY` (Task 2); `record.lta`, `record.specialAllowance` (Task 1).

- [ ] **Step 1: Import the company config**

In `src/app/(print)/hr/payout/[id]/print/page.tsx`, add to the imports (after line 8 `import PrintBar ...`):

```ts
import { COMPANY } from "@/lib/company";
```

- [ ] **Step 2: Expand `hasBankInfo` to include the new fields**

Replace line 67:

```ts
  const hasBankInfo = emp.bankAccountNo || emp.bankName || emp.ifsc || emp.panNo || emp.uan || emp.esicNo;
```

- [ ] **Step 3: Add the company header text to the letterhead**

In the letterhead block, replace the left `<div className="flex items-center gap-4">…</div>` (lines 77-94) with a version that prints the company name + address:

```tsx
          <div className="flex items-center gap-4">
            <Image
              src="/brand/gne-infra.png"
              alt={COMPANY.name}
              width={120}
              height={34}
              className="h-9 w-auto"
              priority
            />
            <div>
              <div className="text-base font-bold leading-tight tracking-tight text-slate-900">
                {COMPANY.name}
              </div>
              {COMPANY.addressLines.map((l) => (
                <div key={l} className="text-[10px] leading-tight text-slate-500">{l}</div>
              ))}
              <div className="mt-0.5 text-[10px] text-slate-400">
                {[COMPANY.cin && `CIN ${COMPANY.cin}`, COMPANY.gstin && `GSTIN ${COMPANY.gstin}`, COMPANY.pan && `PAN ${COMPANY.pan}`].filter(Boolean).join("  ·  ")}
              </div>
            </div>
          </div>
```

- [ ] **Step 4: Surface Category & Location, and the bank/ESIC rows in the employee block**

In the left identity column, after the `Date of Joining` InfoRow (line 116), add:

```tsx
            <InfoRow label="Category"        value={emp.empCategory} />
            <InfoRow label="Location"        value={emp.location} />
```

In the right "Bank & Statutory" column, replace the inner `hasBankInfo ? (…) : (…)` block (lines 124-132) with:

```tsx
            {hasBankInfo ? (
              <>
                <InfoRow label="Bank A/C"  value={emp.bankAccountNo} />
                <InfoRow label="Bank Name" value={emp.bankName} />
                <InfoRow label="IFSC"      value={emp.ifsc} />
                <InfoRow label="PAN"       value={emp.panNo} />
                <InfoRow label="UAN"       value={emp.uan} />
                <InfoRow label="ESIC No"   value={emp.esicNo} />
              </>
            ) : (
              <span className="text-[12px] text-slate-400">No bank / statutory info on file</span>
            )}
```

- [ ] **Step 5: Add LTA & Special Allowance earnings rows**

In the Earnings table `<tbody>` (lines 166-174), insert two rows after the Conveyance row:

```tsx
                <ERow label="Basic Salary"   value={fmtINR(record.basic)} />
                <ERow label="HRA"            value={fmtINR(record.hra)} />
                <ERow label="CCA"            value={fmtINR(record.cca)} />
                <ERow label="Personal Pay"   value={fmtINR(record.personalPay)} />
                <ERow label="Conveyance"     value={fmtINR(record.conveyance)} />
                <ERow label="LTA"            value={fmtINR(record.lta)} />
                <ERow label="Special Allow." value={fmtINR(record.specialAllowance)} />
                <ERow label="PLA"            value={fmtINR(record.pla)} />
                <ERow label="Medical Reimb." value={fmtINR(record.medicalReimb)} />
```

- [ ] **Step 6: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: the slip page now type-checks (it reads `record.lta`/`record.specialAllowance`, which exist after Task 1). Pre-existing errors in `PayrollEditor`/payout page/payroll route may remain until Tasks 4-6.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(print)/hr/payout/[id]/print/page.tsx"
git commit -m "feat(hr): salary slip — LTA/Special Allowance, company header, bank & ESIC detail"
```

---

### Task 4: Payout page server — select & prefill the new earnings

**Files:**
- Modify: `src/app/(erp)/hr/payout/page.tsx`

**Interfaces:**
- Consumes: `Employee.lta/specialAllowance`, `PayrollRecord.lta/specialAllowance` (Task 1).
- Produces: `PayrollRow` objects now carry `lta`/`specialAllowance` for `PayrollEditor` (Task 5).

- [ ] **Step 1: Select the new fields**

In `src/app/(erp)/hr/payout/page.tsx`:

In the `employees` query `select` (lines 33-41), add `lta: true, specialAllowance: true` after `conveyance: true`:

```ts
      select: {
        id: true, empId: true, name: true, designation: true,
        totalCtc: true, salary: true, conveyance: true,
        lta: true, specialAllowance: true,
      },
```

In the `payrolls` query `select` (lines 45-64), add `lta: true, specialAllowance: true` after `conveyance: true`.

In the `prevPayrolls` query `select` (lines 67-73), add `lta: true, specialAllowance: true` after `conveyance: true,`.

- [ ] **Step 2: Map the new fields into PayrollRow (both branches)**

In the `rows` mapping, the existing-record branch (the object returned when `rec` is truthy, lines 89-108) — add after `conveyance: rec.conveyance,`:

```ts
        conveyance: rec.conveyance,
        lta: rec.lta,
        specialAllowance: rec.specialAllowance,
```

In the prefill branch (lines 111-130) — add after `conveyance: emp.conveyance ?? 0,`:

```ts
      conveyance: emp.conveyance ?? 0,
      lta: emp.lta ?? 0,
      specialAllowance: emp.specialAllowance ?? 0,
```

- [ ] **Step 3: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: this file type-checks once `PayrollRow` includes the fields (Task 5). If running before Task 5, expect a type error that `lta`/`specialAllowance` are not in `PayrollRow` — resolved by Task 5. Implement Tasks 4 and 5 together if you need a green gate.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(erp)/hr/payout/page.tsx"
git commit -m "feat(hr): payout — load LTA/Special Allowance for the editor"
```

---

### Task 5: PayrollEditor — LTA & Special Allowance earning rows

**Files:**
- Modify: `src/components/hr/PayrollEditor.tsx`
- Modify: `src/app/api/hr/payroll/route.ts`

**Interfaces:**
- Consumes: rows with `lta`/`specialAllowance` (Task 4); `computePayrollTotals` with the new params (Task 1).
- Produces: POST body includes `lta`/`specialAllowance`; the API persists them.

- [ ] **Step 1: Add `lta`/`specialAllowance` to the PayrollRow type & NumericKey**

In `src/components/hr/PayrollEditor.tsx`, in `PayrollRow` (lines 11-30) add after `conveyance: number;`:

```ts
  conveyance: number;
  lta: number;
  specialAllowance: number;
```

Extend `NumericKey` (lines 32-34):

```ts
type NumericKey =
  | "basic" | "hra" | "cca" | "personalPay" | "conveyance" | "lta" | "specialAllowance" | "pla" | "medicalReimb"
  | "tds" | "loanAdv" | "epf" | "esi";
```

- [ ] **Step 2: Add the two earning rows to the EARNINGS list**

Replace the `EARNINGS` array (lines 38-46):

```ts
const EARNINGS: { key: NumericKey; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "cca", label: "CCA" },
  { key: "personalPay", label: "Personal Pay" },
  { key: "conveyance", label: "Conveyance" },
  { key: "lta", label: "LTA" },
  { key: "specialAllowance", label: "Special Allowance" },
  { key: "pla", label: "PLA" },
  { key: "medicalReimb", label: "Medical reimb." },
];
```

- [ ] **Step 3: Send the new fields on save**

In `save()` (the `body: JSON.stringify({…})`, lines 101-107), add `lta`/`specialAllowance` to the earnings:

```ts
          basic: r.basic, hra: r.hra, cca: r.cca, personalPay: r.personalPay,
          conveyance: r.conveyance, lta: r.lta, specialAllowance: r.specialAllowance,
          pla: r.pla, medicalReimb: r.medicalReimb,
          tds: r.tds, loanAdv: r.loanAdv, epf: r.epf, esi: r.esi, remarks: r.remarks,
```

(No change needed to `splitFromGross` — it returns a partial that leaves `lta`/`specialAllowance` untouched.)

- [ ] **Step 4: Persist the new fields in the payroll API**

In `src/app/api/hr/payroll/route.ts`, in the `data` object (lines 17-25) add the two earnings after `conveyance: d.conveyance,`:

```ts
    basic: d.basic, hra: d.hra, cca: d.cca, personalPay: d.personalPay,
    conveyance: d.conveyance, lta: d.lta, specialAllowance: d.specialAllowance,
    pla: d.pla, medicalReimb: d.medicalReimb,
    tds: d.tds, loanAdv: d.loanAdv, epf: d.epf, esi: d.esi,
```

(`computePayrollTotals(d)` already receives `d.lta`/`d.specialAllowance` via the schema from Task 1.)

- [ ] **Step 5: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS. After this task, all Task 1 payroll-caller errors are resolved (editor, payout page, slip, route all supply the new fields).

- [ ] **Step 6: Manual smoke (optional, if a seeded DB is available)**

Open `/hr/payout`, open an employee, confirm "LTA" and "Special Allowance" rows appear under Earnings, edit them, Save, open the printed slip, confirm both lines show and Net Pay reflects them.

- [ ] **Step 7: Commit**

```bash
git add src/components/hr/PayrollEditor.tsx src/app/api/hr/payroll/route.ts
git commit -m "feat(hr): payroll editor + API — LTA & Special Allowance earnings"
```

---

### Task 6: MonthPicker component + wire into Attendance & Payout

**Files:**
- Create: `src/components/hr/MonthPicker.tsx`
- Modify: `src/app/(erp)/hr/attendance/page.tsx` (header cluster ~71-87)
- Modify: `src/app/(erp)/hr/payout/page.tsx` (header cluster ~145-161)

**Interfaces:**
- Produces: `MonthPicker({ year, month, basePath, extraQuery? })` — a client month/year popover that `router.push`es `${basePath}?year=&month=` (preserving `extraQuery` keys). Consumed by attendance + payout headers.

- [ ] **Step 1: Create the MonthPicker**

Create `src/components/hr/MonthPicker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/hr-validation";
import { cn } from "@/components/ui";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthPicker({
  year,
  month,
  basePath,
}: {
  year: number;
  month: number; // 1-12
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(y: number, m: number) {
    setOpen(false);
    router.push(`${basePath}?year=${y}&month=${m}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setViewYear(year); setOpen((o) => !o); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="press inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="nums">{MONTHS[month - 1]} {year}</span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose month"
          className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-pop)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => Math.max(2000, y - 1))}
              aria-label="Previous year"
              className="press grid h-7 w-7 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="nums text-sm font-semibold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => Math.min(2100, y + 1))}
              aria-label="Next year"
              className="press grid h-7 w-7 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {SHORT.map((label, i) => {
              const m = i + 1;
              const isCurrent = viewYear === year && m === month;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => go(viewYear, m)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "press rounded-lg py-1.5 text-sm font-medium transition-colors",
                    isCurrent
                      ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire MonthPicker into the Attendance header**

In `src/app/(erp)/hr/attendance/page.tsx`, add the import after line 7:

```ts
import MonthPicker from "@/components/hr/MonthPicker";
```

Replace the centered static `<span>…{monthLabel}…</span>` (lines 78-80) with the picker, keeping the prev/next chevron Links around it:

```tsx
        <MonthPicker year={y} month={m} basePath="/hr/attendance" />
```

- [ ] **Step 3: Wire MonthPicker into the Payout header**

In `src/app/(erp)/hr/payout/page.tsx`, add the import after line 7:

```ts
import MonthPicker from "@/components/hr/MonthPicker";
```

Replace the centered static `<span>…{monthLabel}…</span>` (lines 152-154) with:

```tsx
        <MonthPicker year={year} month={month} basePath="/hr/payout" />
```

- [ ] **Step 4: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional)**

On `/hr/attendance` and `/hr/payout`, click the month label → popover opens → pick a different month/year → URL updates and the grid reloads for that period. Prev/next chevrons still work.

- [ ] **Step 6: Commit**

```bash
git add src/components/hr/MonthPicker.tsx "src/app/(erp)/hr/attendance/page.tsx" "src/app/(erp)/hr/payout/page.tsx"
git commit -m "feat(hr): month/year picker on attendance & payout"
```

---

### Task 7: Attendance — remove autofill, add employee jump-pills

**Files:**
- Modify: `src/components/hr/AttendanceGrid.tsx`

**Interfaces:**
- Consumes: existing `employees`/`grid` state. No prop changes.

- [ ] **Step 1: Remove the Sparkles import and the `autofill` function**

In `src/components/hr/AttendanceGrid.tsx`, change the lucide import (line 5) to drop `Sparkles`:

```ts
import { CalendarCheck2, Eraser, Search, Users } from "lucide-react";
```

Delete the entire `autofill` function (lines 108-117):

```ts
  function autofill(ids: string[]) {
    setGrid((g) => {
      const next = { ...g };
      for (const id of ids) for (const { d, weekend } of days) {
        const k = key(id, d);
        if ((next[k] ?? "") === "") next[k] = weekend ? "WEEK_OFF" : "PRESENT";
      }
      return next;
    });
  }
```

- [ ] **Step 2: Remove the toolbar Autofill button**

Delete the toolbar Autofill `Button` (lines 218-222):

```tsx
            {canWrite && (
              <Button variant="secondary" size="sm" onClick={() => autofill(filtered.map((e) => e.id))} title="Fill empty cells: weekdays Present, weekends Week-off">
                <Sparkles className="h-3.5 w-3.5" /> Autofill
              </Button>
            )}
```

- [ ] **Step 3: Remove the per-row Sparkles button**

Replace the employee-name cell content (lines 253-266) — drop the per-row autofill button, keep the name:

```tsx
                <td className="sticky left-0 z-10 bg-white px-4 py-1.5 font-medium text-slate-800 whitespace-nowrap group-hover:bg-slate-50">
                  <span><span className="nums text-slate-400">{emp.empId}</span> {emp.name}</span>
                </td>
```

- [ ] **Step 4: Add row refs + a reduced-motion-aware jump helper**

Add a ref map and helper near the other hooks (after `dragRef`, line 57):

```ts
  const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const [flashId, setFlashId] = useState<string | null>(null);

  function jumpTo(id: string) {
    const el = rowRefs.current.get(id);
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }
```

- [ ] **Step 5: Render the jump-pill strip**

Immediately before the grid `<div className="overflow-x-auto …">` (line 234), add a sticky, horizontally scrollable pill strip built from `filtered`:

```tsx
      {/* Jump pills — click to scroll straight to an employee's row */}
      {filtered.length > 1 && (
        <div className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-1 py-2 shadow-[var(--shadow-card)] backdrop-blur">
          {filtered.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => jumpTo(emp.id)}
              title={emp.name}
              className="press shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <span className="nums text-slate-400">{emp.empId}</span> {emp.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 6: Attach the ref + flash highlight to each row**

Update the employee `<tr>` opening tag (line 252) to register the ref and apply a transient highlight:

```tsx
              <tr
                key={emp.id}
                ref={(el) => { rowRefs.current.set(emp.id, el); }}
                className={cn(
                  "border-b border-slate-100 last:border-0 transition-colors",
                  flashId === emp.id ? "bg-brand-50" : "hover:bg-slate-50/40"
                )}
              >
```

(`cn` is already imported on line 6.)

- [ ] **Step 7: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS. Confirm no remaining references to `Sparkles` or `autofill` (`npm run build` will error on any leftover).

- [ ] **Step 8: Manual smoke (optional)**

On `/hr/attendance`, confirm no Autofill button anywhere; the pill strip appears above the grid; clicking a pill scrolls to and briefly highlights that employee's row.

- [ ] **Step 9: Commit**

```bash
git add src/components/hr/AttendanceGrid.tsx
git commit -m "feat(hr): attendance — remove autofill, add employee jump-pills"
```

---

### Task 8: Employee form — bank/ESIC fields + sectioned layout

**Files:**
- Modify: `src/components/hr/EmployeeForm.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/edit/page.tsx` (initial map ~31-56)
- Modify: `src/app/api/hr/employees/route.ts` (POST data ~30-45)
- Modify: `src/app/api/hr/employees/[id]/route.ts` (PATCH data ~34-49)
- Modify: `src/app/(erp)/hr/employees/[id]/page.tsx` (detail rows ~132-134)

**Interfaces:**
- Consumes: `employeeSchema` with `bankName`/`ifsc`/`esicNo` (Task 1).
- Produces: the form posts the three new fields; create/update persist them; edit prefills them; detail page displays them.

- [ ] **Step 1: Add the new fields to the form's EMPTY defaults**

In `src/components/hr/EmployeeForm.tsx`, replace the `EMPTY` object (lines 9-15):

```ts
const EMPTY: Values = {
  empId: "", name: "", designation: "", empCategory: "On-Roll", location: "",
  dateOfJoining: "", payrollType: "", mailId: "", emergencyNumber: "", bloodGroup: "",
  iCardNo: "", dob: "", offerLetterDate: "", leavingDate: "",
  totalCtc: "", salary: "", lta: "", specialAllowance: "", conveyance: "",
  casualLeaveQuota: "12", sickLeaveQuota: "12",
  bankAccountNo: "", bankName: "", ifsc: "", uan: "", panNo: "", esicNo: "",
};
```

- [ ] **Step 2: Replace the flat field grid with four sections**

Replace the single `<div className="grid …">…</div>` block (lines 56-85) with four labeled sections. Add a small `Section` helper at the top of the component's return (or as a local function). Replace lines 49-85 (`return ( <form …> … </div>` up to the closing of the fields grid) with:

```tsx
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Identity & Role">
        {Txt("empId", "EMP ID", true)}
        {Txt("name", "Name", true)}
        {Txt("designation", "Designation", true)}
        <Field label="Emp Category" required htmlFor="empCategory">
          <Select id="empCategory" value={v.empCategory} onChange={set("empCategory")}>
            {EMP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        {Txt("location", "Location", true)}
        {Txt("dateOfJoining", "Date of Joining", true, "date")}
        {Txt("payrollType", "Payroll")}
        {Txt("iCardNo", "I-Card No")}
      </Section>

      <Section title="Contact & Personal">
        {Txt("mailId", "Mail Id", false, "email")}
        {Txt("emergencyNumber", "Emergency Number")}
        {Txt("bloodGroup", "Blood Group")}
        {Txt("dob", "DOB", false, "date")}
        {Txt("offerLetterDate", "Offer Letter Date", false, "date")}
        {Txt("leavingDate", "Leaving Date", false, "date")}
      </Section>

      <Section title="Compensation">
        {Txt("totalCtc", "Total CTC (₹)")}
        {Txt("salary", "Salary (₹)")}
        {Txt("lta", "LTA (₹)")}
        {Txt("specialAllowance", "Special Allowance (₹)")}
        {Txt("conveyance", "Conveyance (₹)")}
      </Section>

      <Section title="Statutory & Leave">
        {Txt("bankAccountNo", "Bank A/C No")}
        {Txt("bankName", "Bank Name")}
        {Txt("ifsc", "IFSC")}
        {Txt("panNo", "PAN No")}
        {Txt("uan", "UAN (PF)")}
        {Txt("esicNo", "ESIC No")}
        {Txt("casualLeaveQuota", "Casual Leave Quota", false, "number")}
        {Txt("sickLeaveQuota", "Sick Leave Quota", false, "number")}
      </Section>
```

(Keep the existing submit/cancel `<div className="flex gap-2">…</div>` and the closing `</form>` that follow.)

- [ ] **Step 3: Prefill the new fields on edit**

In `src/app/(erp)/hr/employees/[id]/edit/page.tsx`, in the `initial` object (lines 53-55) replace the bank/statutory tail with:

```ts
    bankAccountNo: emp.bankAccountNo ?? "",
    bankName: emp.bankName ?? "",
    ifsc: emp.ifsc ?? "",
    uan: emp.uan ?? "",
    panNo: emp.panNo ?? "",
    esicNo: emp.esicNo ?? "",
```

- [ ] **Step 4: Persist the new fields on create**

In `src/app/api/hr/employees/route.ts`, in the POST `data` object (lines 42-44) replace the bank/statutory tail with:

```ts
        bankAccountNo: d.bankAccountNo || null,
        bankName: d.bankName || null,
        ifsc: d.ifsc || null,
        uan: d.uan || null,
        panNo: d.panNo || null,
        esicNo: d.esicNo || null,
```

- [ ] **Step 5: Persist the new fields on update**

In `src/app/api/hr/employees/[id]/route.ts`, in the PATCH `data` object (lines 46-48) replace the bank/statutory tail with the identical six lines:

```ts
        bankAccountNo: d.bankAccountNo || null,
        bankName: d.bankName || null,
        ifsc: d.ifsc || null,
        uan: d.uan || null,
        panNo: d.panNo || null,
        esicNo: d.esicNo || null,
```

- [ ] **Step 6: Show the new fields on the detail page**

In `src/app/(erp)/hr/employees/[id]/page.tsx`, in the Employee Details card, replace the bank rows (lines 132-134) with:

```tsx
              <Row label="Bank A/C No" value={emp.bankAccountNo} />
              <Row label="Bank Name" value={emp.bankName} />
              <Row label="IFSC" value={emp.ifsc} />
              <Row label="PAN" value={emp.panNo} />
              <Row label="UAN" value={emp.uan} />
              <Row label="ESIC No" value={emp.esicNo} />
```

- [ ] **Step 7: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS.

- [ ] **Step 8: Manual smoke (optional)**

Create/edit an employee: the form shows 4 sections; Bank Name / IFSC / ESIC No save and reappear on edit and on the detail page; they also appear on the salary slip (Task 3) once a payslip is printed.

- [ ] **Step 9: Commit**

```bash
git add src/components/hr/EmployeeForm.tsx "src/app/(erp)/hr/employees/[id]/edit/page.tsx" src/app/api/hr/employees/route.ts "src/app/api/hr/employees/[id]/route.ts" "src/app/(erp)/hr/employees/[id]/page.tsx"
git commit -m "feat(hr): sectioned employee form + bank/ESIC fields end-to-end"
```

---

### Task 9: Assets — Position/Mail/Location columns + Edit/Delete/Return UI

**Files:**
- Modify: `src/app/(erp)/hr/assets/page.tsx`
- Rewrite: `src/components/hr/AssetForm.tsx` (support create AND edit, show employee Position/Mail/Location)
- Create: `src/components/hr/AssetRowActions.tsx` (edit/delete/return controls)

**Interfaces:**
- Consumes: `EmployeeAsset` PATCH/DELETE routes (already exist, `HR_WRITE`-guarded).
- Produces: `AssetForm({ employees, asset? })` — `employees` now includes `designation/mailId/location`; when an `asset` is passed it edits via PATCH. `AssetRowActions({ asset, employees })` renders edit (opens form in a SlideOver), delete, and mark-returned.

- [ ] **Step 1: Widen the asset page queries & pass richer employee data**

In `src/app/(erp)/hr/assets/page.tsx`, change the `assets` query include and the `employees` query select (lines 24-36):

```ts
  const [assets, employees] = await Promise.all([
    prisma.employeeAsset.findMany({
      include: { employee: { select: { id: true, empId: true, name: true, designation: true, mailId: true, location: true } } },
      orderBy: { allocatedAt: "desc" },
    }),
    canWrite
      ? prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, empId: true, name: true, designation: true, mailId: true, location: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
```

- [ ] **Step 2: Add Position/Mail/Location columns + a row-actions column**

In the same file, add the import for the new actions component (after line 5):

```ts
import AssetRowActions from "@/components/hr/AssetRowActions";
```

Replace the table header row (lines 63-75) to add Position, Mail ID, Location, and (when `canWrite`) an Actions column:

```tsx
                  <tr className={theadRowCls}>
                    <th className={thCls}>Employee</th>
                    <th className={thCls}>Position</th>
                    <th className={thCls}>Mail ID</th>
                    <th className={thCls}>Location</th>
                    <th className={thCls}>Laptop</th>
                    <th className={thCls}>Serial No</th>
                    <th className={thCls}>Make / Model</th>
                    <th className={thCls}>Bag</th>
                    <th className={thCls}>Mouse</th>
                    <th className={thCls}>Charger</th>
                    <th className={thCls}>ID Card</th>
                    <th className={thCls}>OEM</th>
                    <th className={thCls}>Allocated</th>
                    <th className={thCls}>Returned</th>
                    {canWrite && <th className={thCls}>Actions</th>}
                  </tr>
```

Replace the body row (lines 79-99) — add the three employee-sourced cells and the actions cell. Also bump the table `min-w` (line 61) from `min-w-[1100px]` to `min-w-[1400px]`:

```tsx
                    <tr key={a.id} className={trCls}>
                      <td className={tdCls}>
                        <span className="nums font-mono text-xs text-slate-500">{a.employee.empId}</span>
                        {" · "}
                        <span className="font-medium text-slate-800">{a.employee.name}</span>
                      </td>
                      <td className={tdCls}>{a.employee.designation ?? "—"}</td>
                      <td className={tdCls}>{a.employee.mailId ?? "—"}</td>
                      <td className={tdCls}>{a.employee.location ?? "—"}</td>
                      <td className={tdCls}>{a.hasLaptop ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.lpSerialNo ?? "—"}</td>
                      <td className={tdCls}>{a.makeModel ?? "—"}</td>
                      <td className={tdCls}>{a.laptopBag ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.mouse ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.charger ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.idCard ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.oemName ?? "—"}</td>
                      <td className={tdCls}><span className="nums">{fmtDate(a.allocatedAt) ?? "—"}</span></td>
                      <td className={tdCls}><span className="nums">{fmtDate(a.returnedAt) ?? "—"}</span></td>
                      {canWrite && (
                        <td className={tdCls}>
                          <AssetRowActions
                            asset={{
                              id: a.id, employeeId: a.employee.id,
                              hasLaptop: a.hasLaptop, laptopBag: a.laptopBag, mouse: a.mouse, charger: a.charger, idCard: a.idCard,
                              lpSerialNo: a.lpSerialNo ?? "", makeModel: a.makeModel ?? "", lpCategory: a.lpCategory ?? "", oemName: a.oemName ?? "",
                              returnedAt: a.returnedAt ? a.returnedAt.toISOString().slice(0, 10) : "",
                            }}
                            employees={employees}
                          />
                        </td>
                      )}
                    </tr>
```

- [ ] **Step 3: Rewrite AssetForm to support create + edit and show employee Position/Mail/Location**

Replace `src/components/hr/AssetForm.tsx` entirely:

```tsx
"use client";
import { useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";

export type AssetEmployee = {
  id: string; empId: string; name: string;
  designation: string | null; mailId: string | null; location: string | null;
};

export type AssetValues = {
  employeeId: string;
  hasLaptop: boolean; laptopBag: boolean; mouse: boolean; charger: boolean; idCard: boolean;
  lpSerialNo: string; makeModel: string; lpCategory: string; oemName: string;
  returnedAt?: string;
};

const EMPTY: AssetValues = {
  employeeId: "",
  hasLaptop: false, laptopBag: false, mouse: false, charger: false, idCard: false,
  lpSerialNo: "", makeModel: "", lpCategory: "", oemName: "", returnedAt: "",
};

const CHECKBOXES: { key: keyof AssetValues; label: string }[] = [
  { key: "hasLaptop", label: "Laptop" },
  { key: "laptopBag", label: "Laptop Bag" },
  { key: "mouse", label: "Mouse" },
  { key: "charger", label: "Charger" },
  { key: "idCard", label: "ID Card" },
];

export default function AssetForm({
  employees,
  asset,
  assetId,
  onDone,
}: {
  employees: AssetEmployee[];
  asset?: AssetValues;
  assetId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<AssetValues>({ ...EMPTY, ...(asset ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => employees.find((e) => e.id === v.employeeId), [employees, v.employeeId]);

  const setStr = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  const setBool = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.checked }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch(assetId ? `/api/hr/assets/${assetId}` : "/api/hr/assets", {
        method: assetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      if (!assetId) setV({ ...EMPTY });
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee" required htmlFor="employeeId">
          <Select id="employeeId" value={v.employeeId} onChange={setStr("employeeId")} required disabled={!!assetId}>
            <option value="">Select employee…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.empId} — {emp.name}</option>
            ))}
          </Select>
        </Field>

        {/* Auto-filled from the linked employee (read-only) */}
        <Field label="Position" htmlFor="asset-position">
          <Input id="asset-position" value={selected?.designation ?? ""} readOnly disabled placeholder="—" />
        </Field>
        <Field label="Mail ID" htmlFor="asset-mail">
          <Input id="asset-mail" value={selected?.mailId ?? ""} readOnly disabled placeholder="—" />
        </Field>
        <Field label="Location" htmlFor="asset-location">
          <Input id="asset-location" value={selected?.location ?? ""} readOnly disabled placeholder="—" />
        </Field>

        <Field label="LP Serial No" htmlFor="lpSerialNo">
          <Input id="lpSerialNo" value={v.lpSerialNo} onChange={setStr("lpSerialNo")} />
        </Field>
        <Field label="Make / Model" htmlFor="makeModel">
          <Input id="makeModel" value={v.makeModel} onChange={setStr("makeModel")} />
        </Field>
        <Field label="LP Category" htmlFor="lpCategory">
          <Input id="lpCategory" value={v.lpCategory} onChange={setStr("lpCategory")} />
        </Field>
        <Field label="OEM Name" htmlFor="oemName">
          <Input id="oemName" value={v.oemName} onChange={setStr("oemName")} />
        </Field>

        {assetId && (
          <Field label="Returned On" htmlFor="returnedAt" hint="leave blank if still allocated">
            <Input id="returnedAt" type="date" value={v.returnedAt ?? ""} onChange={setStr("returnedAt")} />
          </Field>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-slate-700">Assets issued</legend>
        <div className="flex flex-wrap gap-4">
          {CHECKBOXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand accent-brand"
                checked={v[key] as boolean} onChange={setBool(key)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : assetId ? "Save changes" : "Add asset record"}
        </Button>
      </div>
    </form>
  );
}
```

Note the asset page passes `employees` already shaped as `AssetEmployee` (Step 1 selects the matching fields).

- [ ] **Step 4: Create the row-actions component (edit/delete/return)**

Create `src/components/hr/AssetRowActions.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Undo2 } from "lucide-react";
import SlideOver from "@/components/SlideOver";
import AssetForm, { type AssetEmployee, type AssetValues } from "@/components/hr/AssetForm";

export default function AssetRowActions({
  asset,
  employees,
}: {
  asset: AssetValues & { id: string };
  employees: AssetEmployee[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patchReturned() {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/hr/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...asset, returnedAt: asset.returnedAt ? "" : today }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch { alert("Could not update return status."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Delete this asset record? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch { alert("Could not delete the asset record."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setEditing(true)} aria-label="Edit asset" disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={patchReturned} aria-label={asset.returnedAt ? "Mark as allocated" : "Mark as returned"} title={asset.returnedAt ? "Mark as allocated" : "Mark as returned"} disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={remove} aria-label="Delete asset" disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
        <Trash2 className="h-4 w-4" />
      </button>

      <SlideOver open={editing} onClose={() => setEditing(false)} title="Edit asset record" subtitle={asset.employeeId}>
        <AssetForm employees={employees} asset={asset} assetId={asset.id} onDone={() => setEditing(false)} />
      </SlideOver>
    </div>
  );
}
```

- [ ] **Step 5: Confirm the SlideOver prop contract**

Open `src/components/SlideOver.tsx` and confirm it accepts `open`, `onClose`, `title`, `subtitle`, and `children` (the PayrollEditor uses `open/onClose/icon/title/subtitle/footer/children`). If `subtitle`/`title` are required differently, adjust the `AssetRowActions` SlideOver props to match the actual signature. Do not change SlideOver itself.

- [ ] **Step 6: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS.

- [ ] **Step 7: Manual smoke (optional)**

On `/hr/assets`: the register shows Position/Mail ID/Location (from the employee); the create form shows those three as read-only and fills them when you pick an employee; each row has Edit (opens slide-over, saves via PATCH), Mark-returned (toggles `returnedAt`), and Delete (confirms, removes). Managers (read-only) see no Add form and no Actions column.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(erp)/hr/assets/page.tsx" src/components/hr/AssetForm.tsx src/components/hr/AssetRowActions.tsx
git commit -m "feat(hr): assets — Position/Mail/Location columns + edit/delete/return UI"
```

---

### Task 10: `Segmented` & `SectionNav` shared client components

**Files:**
- Create: `src/components/Segmented.tsx`
- Create: `src/components/SectionNav.tsx`

**Interfaces:**
- Produces:
  - `Segmented<T extends string>({ options, value, onChange, ariaLabel, size? })` where `options: { value: T; label: string; icon?: ReactNode }[]` — a controlled pill/segmented selector.
  - `SectionNav({ sections })` where `sections: { id: string; label: string }[]` — a sticky pill bar that scroll-spies elements with those ids and smooth-scrolls (reduced-motion aware) on click.

- [ ] **Step 1: Create Segmented**

Create `src/components/Segmented.tsx`:

```tsx
"use client";
import { type ReactNode } from "react";
import { cn } from "@/components/ui";

export type SegOption<T extends string> = { value: T; label: string; icon?: ReactNode };

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              pad,
              active ? "bg-white text-brand-800 shadow-[var(--shadow-card)]" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create SectionNav**

Create `src/components/SectionNav.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
  }

  return (
    <nav aria-label="Sections" className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => go(s.id)}
          aria-current={active === s.id ? "true" : undefined}
          className={cn(
            "press shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            active === s.id ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS (both files are unused until Tasks 11-12; generic `Segmented` must compile with the `<T extends string>` signature).

- [ ] **Step 4: Commit**

```bash
git add src/components/Segmented.tsx src/components/SectionNav.tsx
git commit -m "feat(ui): add Segmented pill control + SectionNav scroll-spy"
```

---

### Task 11: Employee detail — tabbed SectionNav

**Files:**
- Modify: `src/app/(erp)/hr/employees/[id]/page.tsx`

**Interfaces:**
- Consumes: `SectionNav` (Task 10).

- [ ] **Step 1: Import SectionNav and add anchor ids to each card**

In `src/app/(erp)/hr/employees/[id]/page.tsx`, add after line 19:

```ts
import SectionNav from "@/components/SectionNav";
```

Add a matching `id` attribute with `scroll-mt-24` (so the sticky header doesn't cover the heading) to each `<Card>` in the body. Wrap each card in a section anchor by adding `id`/`className` — the simplest approach is to wrap with a `<div>`:

- Wrap "Employee Details" card: `<div id="sec-details" className="scroll-mt-24">…</div>`
- "Compensation": `<div id="sec-comp" className="scroll-mt-24">…</div>`
- "Assets": `<div id="sec-assets" className="scroll-mt-24">…</div>`
- "Projects": `<div id="sec-projects" className="scroll-mt-24">…</div>`
- "Attendance Summary & Leave Balances": `<div id="sec-attendance" className="scroll-mt-24">…</div>`
- "Payslips": `<div id="sec-payslips" className="scroll-mt-24">…</div>`
- "Recent Attendance": `<div id="sec-recent" className="scroll-mt-24">…</div>`

- [ ] **Step 2: Render the SectionNav at the top of the body**

Immediately inside `<div className="p-8 space-y-6">` (line 99), before the first card, add:

```tsx
        <SectionNav
          sections={[
            { id: "sec-details", label: "Details" },
            { id: "sec-comp", label: "Compensation" },
            { id: "sec-assets", label: "Assets" },
            { id: "sec-projects", label: "Projects" },
            { id: "sec-attendance", label: "Attendance" },
            { id: "sec-payslips", label: "Payslips" },
            { id: "sec-recent", label: "Recent" },
          ]}
        />
```

- [ ] **Step 3: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke (optional)**

On an employee detail page, a sticky pill bar appears; clicking a pill jumps to that section; the active pill updates as you scroll.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(erp)/hr/employees/[id]/page.tsx"
git commit -m "feat(hr): tabbed section nav on employee detail"
```

---

### Task 12: Merge HR Dashboard + Analytics into one pill-driven page

**Files:**
- Create: `src/components/hr/TrendBoard.tsx`
- Rewrite: `src/app/(erp)/hr/page.tsx` (merged dashboard + analytics)
- Replace: `src/app/(erp)/hr/analytics/page.tsx` (redirect to `/hr`)
- Modify: `src/lib/nav.tsx` (drop the "Analytics" HR nav item)

**Interfaces:**
- Consumes: `Segmented` (Task 10); `ForecastArea`, `AreaChart`, `DeltaBadge` (`Charts.tsx`); `StatCard`, `Card`, `CardHeader`, `CardBody`, `ProgressBar` (`ui.tsx`).
- Produces: `TrendBoard({ series })` — client component holding metric + range pill state and rendering the matching chart.

- [ ] **Step 1: Create TrendBoard**

Create `src/components/hr/TrendBoard.tsx`. It receives 12-month arrays plus forecast tails and switches which chart is shown:

```tsx
"use client";
import { useMemo, useState } from "react";
import { Wallet, Users, CalendarCheck, Plane, FolderKanban } from "lucide-react";
import Segmented from "@/components/Segmented";
import { AreaChart, ForecastArea } from "@/components/Charts";
import { Card, CardHeader, CardBody } from "@/components/ui";

type Point = { label: string; value: number; forecast?: boolean };
type Bar = { label: string; count: number };

export type TrendSeries = {
  payroll: Point[];       // 12 actual + forecast tail (forecast:true)
  headcount: Point[];     // 12 actual + 1 forecast
  attendance: Point[];    // 12 actual (no forecast)
  leave: Point[];         // 12 actual (no forecast)
  projects: Bar[];        // current allocation per project
};

type Metric = "payroll" | "headcount" | "attendance" | "leave" | "projects";
type Range = "6" | "12";

const METRICS = [
  { value: "payroll" as Metric, label: "Payroll", icon: <Wallet className="h-4 w-4" /> },
  { value: "headcount" as Metric, label: "Headcount", icon: <Users className="h-4 w-4" /> },
  { value: "attendance" as Metric, label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { value: "leave" as Metric, label: "Leave", icon: <Plane className="h-4 w-4" /> },
  { value: "projects" as Metric, label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
];

// Keep the last N actual points + all forecast points.
function windowed(points: Point[], n: number): Point[] {
  const actual = points.filter((p) => !p.forecast);
  const forecast = points.filter((p) => p.forecast);
  return [...actual.slice(-n), ...forecast];
}

const SUBTITLE: Record<Metric, string> = {
  payroll: "Net payable per month (solid) · projection (dashed)",
  headcount: "Active staff at each month-end · next month projected",
  attendance: "Monthly present-equivalent %",
  leave: "Leave + sick days taken per month",
  projects: "Active assignments per project (today)",
};

export default function TrendBoard({ series }: { series: TrendSeries }) {
  const [metric, setMetric] = useState<Metric>("payroll");
  const [range, setRange] = useState<Range>("6");
  const n = range === "6" ? 6 : 12;

  const payroll = useMemo(() => windowed(series.payroll, n), [series.payroll, n]);
  const headcount = useMemo(() => windowed(series.headcount, n), [series.headcount, n]);
  const attendance = useMemo(() => windowed(series.attendance, n), [series.attendance, n]);
  const leave = useMemo(() => windowed(series.leave, n), [series.leave, n]);

  const max = Math.max(1, ...series.projects.map((p) => p.count));

  return (
    <Card>
      <CardHeader
        title="Trends"
        subtitle={SUBTITLE[metric]}
        action={
          metric !== "projects" ? (
            <Segmented<Range>
              ariaLabel="Time range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[{ value: "6", label: "6 mo" }, { value: "12", label: "12 mo" }]}
            />
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <Segmented<Metric> ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS} />
        {metric === "payroll" && <ForecastArea data={payroll} idPrefix="tb-pay" />}
        {metric === "headcount" && <ForecastArea data={headcount} idPrefix="tb-head" />}
        {metric === "attendance" && <AreaChart data={attendance} />}
        {metric === "leave" && <AreaChart data={leave} />}
        {metric === "projects" && (
          series.projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No active projects.</p>
          ) : (
            <div className="space-y-3">
              {series.projects.map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate text-slate-600">{row.label}</span>
                    <span className="nums ml-2 font-medium text-slate-700">{row.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${(row.count / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Rewrite the merged `/hr` page**

Replace `src/app/(erp)/hr/page.tsx` entirely. It computes a 12-month window, all four time-series (payroll w/forecast, headcount w/forecast, attendance %, leave days), project allocation, KPI deltas, leave burn, and composition — then renders the KPI bento, the `TrendBoard`, leave-burn, and composition. (This folds the old analytics page in.)

```tsx
import Link from "next/link";
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, BadgeIndianRupee } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody, ProgressBar } from "@/components/ui";
import { DeltaBadge } from "@/components/Charts";
import { linearForecast, pctDelta } from "@/lib/hr-forecast";
import TrendBoard, { type TrendSeries } from "@/components/hr/TrendBoard";

export const dynamic = "force-dynamic";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Bar = { label: string; count: number };
function BarList({ rows, empty }: { rows: Bar[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{row.label}</span>
            <span className="nums ml-2 font-medium text-slate-700">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const Y = today.getUTCFullYear();
  const Mo = today.getUTCMonth() + 1;

  // Last 12 months (oldest first).
  const periods: { year: number; month: number; label: string; start: Date; end: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = Mo - i, y = Y;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push({ year: y, month: m, label: SHORT[m - 1], start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  const last = periods.length - 1;
  const cur = periods[last], prev = periods[last - 1];
  const nextLabel = SHORT[(Mo % 12)]; // month after current

  const [activeCount, byLocation, byDesignation, byEmpCategory, activeEmployees, attTodayG, payAggMonth] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true, casualLeaveQuota: true, sickLeaveQuota: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
    prisma.payrollRecord.aggregate({ where: { periodYear: cur.year, periodMonth: cur.month }, _sum: { payableAmount: true } }),
  ]);

  // Payroll series (12) → anchor on last non-zero month, forecast the rest.
  const payrollSeries = await Promise.all(periods.map((p) =>
    prisma.payrollRecord.aggregate({ where: { periodYear: p.year, periodMonth: p.month }, _sum: { payableAmount: true } }).then((r) => r._sum.payableAmount ?? 0)));
  let lastActual = payrollSeries.length - 1;
  while (lastActual > 0 && payrollSeries[lastActual] === 0) lastActual--;
  const payrollActuals = payrollSeries.slice(0, lastActual + 1);
  const fLabels = [...periods.slice(lastActual + 1).map((p) => p.label), nextLabel];
  const payrollForecast = linearForecast(payrollActuals, fLabels.length);
  const payrollPoints = [
    ...payrollActuals.map((v, i) => ({ label: periods[i].label, value: v, forecast: false })),
    ...payrollForecast.map((v, i) => ({ label: fLabels[i], value: v, forecast: true })),
  ];
  const costAnchor = payrollSeries[lastActual];
  const costDelta = pctDelta(costAnchor, lastActual > 0 ? payrollSeries[lastActual - 1] : 0);

  // Headcount at each month-end (12) → forecast 1.
  const headcountSeries = await Promise.all(periods.map((p) =>
    prisma.employee.count({ where: { dateOfJoining: { lt: p.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: p.end } }] } })));
  const headcountPoints = [
    ...periods.map((p, i) => ({ label: p.label, value: headcountSeries[i], forecast: false })),
    { label: nextLabel, value: linearForecast(headcountSeries, 1)[0], forecast: true },
  ];
  const headcountDelta = pctDelta(headcountSeries[last], headcountSeries[last - 1]);

  // Attendance rate + leave-days per month (12).
  const monthly = await Promise.all(periods.map(async (p) => {
    const g = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: { gte: p.start, lt: p.end } }, _count: { _all: true } });
    const c = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
    const worked = c("PRESENT") + c("ABSENT") + c("LEAVE") + c("SICK") + c("HALF_DAY");
    const rate = worked ? Math.round(((c("PRESENT") + 0.5 * c("HALF_DAY")) / worked) * 100) : 0;
    const leaveDays = c("LEAVE") + c("SICK");
    return { rate, leaveDays };
  }));
  const attendancePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].rate }));
  const leavePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].leaveDays }));
  const attRateDelta = pctDelta(monthly[last].rate, monthly[last - 1].rate);

  // Today / attrition.
  const presentToday = attTodayG.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveToday = (attTodayG.find((r) => r.status === "LEAVE")?._count._all ?? 0) + (attTodayG.find((r) => r.status === "SICK")?._count._all ?? 0);
  const [leaversCur, leaversPrev] = await Promise.all([
    prisma.employee.count({ where: { leavingDate: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: prev.start, lt: prev.end } } }),
  ]);
  const attritionDelta = pctDelta(leaversCur, leaversPrev);
  const netPayrollMonth = payAggMonth._sum.payableAmount ?? 0;

  // Tenure.
  const now = todayUTC.getTime();
  const tenures = activeEmployees.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // Leave burn (year).
  const totalCasualQuota = activeEmployees.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = activeEmployees.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));
  const [casualYear, sickYear] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
  ]);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;

  // Project allocation.
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] } } } } },
    orderBy: { name: "asc" },
  });
  const assigned = await prisma.projectAssignment.findMany({ where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] }, select: { employeeId: true }, distinct: ["employeeId"] });
  const benchCount = Math.max(0, activeCount - assigned.length);
  const utilization = activeCount ? Math.round((assigned.length / activeCount) * 100) : 0;

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));
  const projectBars: Bar[] = projects.map((p) => ({ label: p.name, count: p._count.assignments }));

  const series: TrendSeries = { payroll: payrollPoints, headcount: headcountPoints, attendance: attendancePoints, leave: leavePoints, projects: projectBars };

  const quickLinks = [
    { href: "/hr/employees", label: "Employees", icon: Users, desc: "View and manage employee records." },
    { href: "/hr/attendance", label: "Attendance", icon: CalendarClock, desc: "Track daily attendance and leave." },
    { href: "/hr/payout", label: "Payout", icon: BadgeIndianRupee, desc: "Process and review monthly payroll." },
    { href: "/hr/projects", label: "Projects", icon: FolderKanban, desc: "Projects and concurrent assignments." },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Dashboard" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="space-y-8 p-6 sm:p-8">
        {/* KPI bento with deltas */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label="Active headcount"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{activeCount}</span><DeltaBadge value={headcountDelta} /></span>} />
          <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label={`Payroll · ${periods[lastActual].label}`}
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{fmtINR(costAnchor)}</span><DeltaBadge value={costDelta} /></span>} />
          <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label="Attendance rate (MTD)"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{monthly[last].rate}%</span><DeltaBadge value={attRateDelta} /></span>} />
          <StatCard tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} label="Present today" value={presentToday} />
          <StatCard tone="amber" icon={<Clock className="h-4 w-4" />} label="On leave today" value={onLeaveToday} />
          <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label="Attrition this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span><DeltaBadge value={attritionDelta} invert /></span>} />
        </div>

        {/* Pill-driven trend board */}
        <TrendBoard series={series} />

        {/* Utilization + leave burn */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Project utilization" subtitle={`${utilization}% deployed · ${benchCount} on the bench · ${projects.length} active projects`} />
            <CardBody><BarList rows={projectBars} empty="No active projects." /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Leave burn (this year)" subtitle="Days taken vs total annual quota" />
            <CardBody className="space-y-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Casual leave</span>
                  <span className="nums text-slate-700">{casualYear} / {totalCasualQuota} <span className="text-slate-400">({casualBurn}%)</span></span>
                </div>
                <ProgressBar value={casualBurn} tone="amber" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Sick leave</span>
                  <span className="nums text-slate-700">{sickYear} / {totalSickQuota} <span className="text-slate-400">({sickBurn}%)</span></span>
                </div>
                <ProgressBar value={sickBurn} tone="brand" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Composition */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader title="By location" subtitle="Active" /><CardBody><BarList rows={locationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By designation" subtitle="Active" /><CardBody><BarList rows={designationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By category" subtitle="Active" /><CardBody><BarList rows={categoryBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By tenure" subtitle="Active" /><CardBody><BarList rows={tenureBars} empty="No data yet." /></CardBody></Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href} className="group block rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100"><Icon className="h-5 w-5" /></div>
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</div>
            </Link>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400">“Projected” values are least-squares trend extrapolations, not guarantees · {netPayrollMonth ? `${fmtINR(netPayrollMonth)} processed this month` : "no payroll processed yet this month"}</p>
      </div>
    </>
  );
}
```

- [ ] **Step 2b: Replace the analytics page with a redirect**

Replace `src/app/(erp)/hr/analytics/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Analytics was merged into the HR dashboard (/hr). Keep this route as a redirect
// so existing links/bookmarks still land on the combined page.
export default async function HrAnalyticsRedirect() {
  await requirePageRole(HR_VIEW);
  redirect("/hr");
}
```

- [ ] **Step 3: Drop the Analytics nav item**

In `src/lib/nav.tsx`, in the `HR` `NavSection` items (lines 64-74), remove the Analytics entry (line 71) so the list reads Dashboard / Employees / Assets / Attendance / Projects / Payout / Manpower Planning (soon) / Recruitment (soon):

```tsx
const HR: NavSection = {
  heading: "Human Resources",
  items: [
    { label: "Dashboard", href: "/hr", icon: LayoutDashboard },
    { label: "Employees", href: "/hr/employees", icon: Users },
    { label: "Assets", href: "/hr/assets", icon: Boxes },
    { label: "Attendance", href: "/hr/attendance", icon: CalendarClock },
    { label: "Projects", href: "/hr/projects", icon: FolderKanban },
    { label: "Payout", href: "/hr/payout", icon: BadgeIndianRupee },
    { label: "Manpower Planning", icon: UserRound, soon: true },
    { label: "Recruitment", icon: Briefcase, soon: true },
  ],
};
```

If `ClipboardList` becomes unused in `nav.tsx` after this removal, leave the import — it is still used by other sections (SCM/Project). Confirm with `npm run lint` (no-unused-vars).

- [ ] **Step 4: Build & lint**

Run: `npm run build` then `npm run lint`
Expected: PASS. `npm run build` clears the `.next` type cache for the deleted analytics content; if a stale-cache error references the old analytics page, run `rm -rf .next` and rebuild (per CLAUDE.md).

- [ ] **Step 5: Manual smoke (optional)**

Visit `/hr`: KPI bento + a "Trends" card with metric pills (Payroll/Headcount/Attendance/Leave/Projects) and a 6/12-month range toggle; switching pills swaps the chart with no reload. `/hr/analytics` redirects to `/hr`. The sidebar no longer shows a separate "Analytics" item.

- [ ] **Step 6: Commit**

```bash
git add src/components/hr/TrendBoard.tsx "src/app/(erp)/hr/page.tsx" "src/app/(erp)/hr/analytics/page.tsx" src/lib/nav.tsx
git commit -m "feat(hr): merge dashboard + analytics into one pill-driven page"
```

---

### Task 13: Final verification & spec sync

**Files:**
- Modify (if needed): `CLAUDE.md` (HR route list — only if it enumerates `/hr/analytics` as a standalone page)

- [ ] **Step 1: Full clean build + lint**

Run: `rm -rf .next && npm run build && npm run lint`
Expected: both PASS with no errors or warnings introduced by this work.

- [ ] **Step 2: Grep for dangling references**

Run: `git grep -n "Sparkles\|autofill" -- src/components/hr/AttendanceGrid.tsx` → expect no matches.
Run: `git grep -n "hr/analytics" -- src/lib/nav.tsx src/app` → expect only the redirect file and any intentional links.

- [ ] **Step 3: Sync CLAUDE.md if it lists analytics as a separate page**

`CLAUDE.md` describes HR pages as `/hr/{employees,assets,attendance,payout,projects,analytics}`. Update that list to reflect analytics now living on `/hr` (the dashboard), e.g. `/hr/{employees,assets,attendance,payout,projects}` with a note that analytics merged into `/hr`. Make the minimal edit.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: HR analytics merged into the dashboard"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-30-hr-module-enhancements-design.md`):
- D1 employee form sectioning → Task 8. Detail tabs → Task 11. ✓
- D2 asset Position/Mail/Location from employee → Task 9. ✓
- D3 asset edit/delete/return UI → Task 9. ✓
- D4 remove attendance autofill → Task 7. ✓
- D5 month picker on attendance + payout → Task 6. ✓
- D6 payslip LTA/Special Allowance + company header + bank IFSC/ESIC + surfaced fields → Tasks 1,2,3,4,5,8. ✓
- D7 merge dashboard+analytics, redirect, nav → Task 12. ✓
- D8 Segmented pill + pill-wise TrendBoard (metric + range) → Tasks 10,12. ✓
- D9 sticky section nav on long pages → Task 11 (employee detail) + Task 7 (attendance jump-pills). ✓
- Schema additive migration + computePayrollTotals → Task 1. ✓
- UI/UX polish → folded across Tasks 7–12 (sections, pills, picker). ✓

**2. Placeholder scan:** No "TBD/TODO/implement later" in steps. The only placeholders are the *data values* in `src/lib/company.ts` (Task 2), which the spec explicitly flags as user-supplied; the code is complete and compiles.

**3. Type consistency:** `computePayrollTotals` param type (Task 1) matches the `PayrollRow`/`RowState` shape used by `PayrollEditor` (Task 5) and the payroll route's parsed `d` (schema gains `lta`/`specialAllowance` in Task 1). `PayrollRow` gains `lta`/`specialAllowance` (Task 5) which the payout page mapping supplies (Task 4). `TrendSeries` (Task 12 in `TrendBoard.tsx`) is imported by the page in Task 12 and matches the `series` object built there. `Segmented<T>`/`SegOption<T>` (Task 10) match `TrendBoard`'s `Segmented<Metric>`/`Segmented<Range>` usage. `AssetEmployee`/`AssetValues` (Task 9 `AssetForm`) are imported by `AssetRowActions` and supplied by the assets page query. `MonthPicker` props (`year`,`month`,`basePath`) match both header call sites.

**Note on cross-task build gates:** Task 1 deliberately leaves the build red (payroll callers lack the new fields) until Tasks 4–5 land. If your execution flow requires a green gate at every task boundary, implement Tasks 1, 4, 5 as a single unit (and Task 3 can follow), then proceed. All other tasks are independently green.
