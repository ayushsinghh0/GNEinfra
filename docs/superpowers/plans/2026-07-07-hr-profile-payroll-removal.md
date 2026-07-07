# HR Profile Slimming + Payroll Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Employee.band` grade field, replace the employee-hub Payroll tab with a full-detail Compensation tab, strip all pay data from the profile Overview, and delete the payroll module's UI/API/code while leaving every `PayrollRecord` row in the database.

**Architecture:** One additive Prisma migration (`band`). The hub swaps its Payroll tab for a read-only Compensation page fed by the existing `getEmployee` cache loader. Payroll pages/APIs/components/libs are deleted outright (git history is the archive); the HR dashboard's payroll KPI/series are replaced or removed. Spec: `docs/superpowers/specs/2026-07-07-hr-profile-payroll-removal-design.md`.

**Tech Stack:** Next.js 16 App Router (RSC), Prisma + Postgres, Zod, Tailwind ("Soft Wave" system).

## Global Constraints

- **No test runner exists in this repo.** The verification gates are `npm run build` (full type-check) and `npm run lint` (CLAUDE.md). Per-task, use `npx tsc --noEmit` as the fast gate; run the full build+lint in the final task.
- ⚠️ **NEVER run `npm run build` while `npm run dev` is running** — they share `.next` and wedge the dev server. Check no dev server is up first.
- **Migrations are additive.** Never reset/squash; production Neon holds live data. The migration in Task 1 is hand-authored offline (repo-documented procedure) so it works without a reachable DB.
- **Do NOT drop the `PayrollRecord` model/table or Employee compensation columns.** Data stays.
- **Managers are read-only**: the new Compensation tab gates on `HR_VIEW` (read); nothing new is mutable.
- Design system: compose `DetailSection`/`KeyValue`/`StatCard` primitives from `src/components/ui.tsx`; no new styles, no new dependencies, light mode only.
- Commit after every task with the exact message given. Do not stage `src/app/(print)/finance/invoices/[id]/approval-note/print/page.tsx` (an unrelated pre-existing local modification) — stage only the files each task names.

---

### Task 1: `Employee.band` — schema, migration, validation, API

**Files:**
- Modify: `prisma/schema.prisma:294` (Employee model)
- Create: `prisma/migrations/20260707000000_add_employee_band/migration.sql`
- Modify: `src/lib/hr-validation.ts:45` (employeeSchema)
- Modify: `src/app/api/hr/employees/route.ts:31` (POST create data)
- Modify: `src/app/api/hr/employees/[id]/route.ts:35` (PATCH update data)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `Employee.band: string | null` on the Prisma client (used by Tasks 2–4); `employeeSchema` accepts optional `band` string ≤ 40 chars (empty string allowed, coerced to `null` in the APIs).

- [ ] **Step 1: Add `band` to the Prisma schema**

In `prisma/schema.prisma`, the Employee model currently reads:

```prisma
model Employee {
  id               String         @id @default(cuid())
  empId            String         @unique
  name             String
  designation      String
  empCategory      String?
```

Insert `band` after `designation`:

```prisma
model Employee {
  id               String         @id @default(cuid())
  empId            String         @unique
  name             String
  designation      String
  band             String?
  empCategory      String?
```

- [ ] **Step 2: Author the additive migration offline**

Create `prisma/migrations/20260707000000_add_employee_band/migration.sql` (folder name matters — matches the repo's hand-timestamped style, e.g. `20260706000000_company_profile`):

```sql
-- Employee pay-grade band (e.g. "B1", "L2") — replaces on-profile CTC display
ALTER TABLE "Employee" ADD COLUMN "band" TEXT;
```

- [ ] **Step 3: Regenerate the Prisma client (offline-safe)**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client` — `Employee` type now has `band: string | null`.

If a local dev DB is reachable (docker compose Postgres on 5433), also apply it: `npx prisma migrate deploy`. If no DB is reachable, skip — `generate` alone keeps the build green; production applies it via `redeploy.sh`'s `migrate deploy`.

- [ ] **Step 4: Add `band` to `employeeSchema`**

In `src/lib/hr-validation.ts`, after the `designation` line:

```ts
  designation: z.string().trim().min(1, "Designation is required").max(120),
```

add:

```ts
  band: z.string().trim().max(40).optional().or(z.literal("")),
```

- [ ] **Step 5: Map `band` in the create API**

In `src/app/api/hr/employees/route.ts` POST, the `prisma.employee.create` data block starts:

```ts
        empId: d.empId, name: d.name, designation: d.designation, empCategory: d.empCategory,
```

change to:

```ts
        empId: d.empId, name: d.name, designation: d.designation, band: d.band || null,
        empCategory: d.empCategory,
```

- [ ] **Step 6: Map `band` in the update API**

In `src/app/api/hr/employees/[id]/route.ts` PATCH, apply the identical change to the `prisma.employee.update` data block (same first line as Step 5).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260707000000_add_employee_band/migration.sql src/lib/hr-validation.ts "src/app/api/hr/employees/route.ts" "src/app/api/hr/employees/[id]/route.ts"
git commit -m "feat(hr): add Employee.band grade field (schema, validation, API)"
```

---

### Task 2: Band in the employee form + Excel export

**Files:**
- Modify: `src/components/hr/EmployeeForm.tsx:22-29,160-173`
- Modify: `src/app/(erp)/hr/employees/[id]/edit/page.tsx:31-59`
- Modify: `src/lib/hr-excel.ts:38-112` (`buildEmployeesWorkbook`)

**Interfaces:**
- Consumes: `employeeSchema.band` + API mapping from Task 1.
- Produces: form field key `band` (string, `""` when unset); Excel "Band" column between "Designation" and "Emp Category".

- [ ] **Step 1: Add `band` to the form's EMPTY seed**

In `src/components/hr/EmployeeForm.tsx`, change:

```ts
const EMPTY: Values = {
  empId: "", name: "", designation: "", empCategory: "On-Roll", location: "",
```

to:

```ts
const EMPTY: Values = {
  empId: "", name: "", designation: "", band: "", empCategory: "On-Roll", location: "",
```

- [ ] **Step 2: Render the Band input in Identity & Role**

In the same file, inside `<Section title="Identity & Role">`, after `{Txt("designation", "Designation", true)}` add:

```tsx
        {Txt("band", "Band")}
```

(Optional field — no `req`, matching the schema.)

- [ ] **Step 3: Seed `band` on the edit page**

In `src/app/(erp)/hr/employees/[id]/edit/page.tsx`, in the `initial` object after `designation: emp.designation,` add:

```ts
    band: emp.band ?? "",
```

- [ ] **Step 4: Add the Band column to the employees workbook**

In `src/lib/hr-excel.ts` `buildEmployeesWorkbook`:
- In `headers`, insert `"Band",` between `"Designation",` and `"Emp Category",`.
- In `ws.columns`, insert `{ width: 10 },  // Band` between the Designation and Emp Category width entries.
- In the `ws.addRow([...])` per-employee array, insert `emp.band ?? "",` between `emp.designation,` and `emp.empCategory ?? "",`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/hr/EmployeeForm.tsx "src/app/(erp)/hr/employees/[id]/edit/page.tsx" src/lib/hr-excel.ts
git commit -m "feat(hr): band editable in employee form and exported to Excel"
```

---

### Task 3: Compensation tab replaces the Payroll tab

**Files:**
- Create: `src/app/(erp)/hr/employees/[id]/(hub)/compensation/page.tsx`
- Modify: `src/components/hr/EmployeeTabs.tsx:17`
- Modify (full replace): `src/app/(erp)/hr/employees/[id]/(hub)/payroll/page.tsx`

**Interfaces:**
- Consumes: `getEmployee` from `(hub)/_data.ts` (unchanged here); `emp.band` from Task 1.
- Produces: route `/hr/employees/[id]/compensation` (Task 4's SnapshotStrip chip links here); `/hr/employees/[id]/payroll` becomes a redirect to it.

- [ ] **Step 1: Create the Compensation tab page**

Create `src/app/(erp)/hr/employees/[id]/(hub)/compensation/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wallet, Landmark, IdCard } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { KeyValue, DetailSection } from "@/components/ui";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

// See (hub)/page.tsx's generateMetadata comment — same per-tab title fix.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = await getEmployee(id);
  return { title: emp ? `${emp.name} · Compensation` : "Employee" };
}

export default async function EmployeeCompensationTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <DetailSection title="Pay Structure" icon={<Wallet className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "Band", value: emp.band },
            { label: "Total CTC", value: fmtINR(emp.totalCtc) },
            { label: "Salary", value: fmtINR(emp.salary) },
            { label: "LTA", value: fmtINR(emp.lta) },
            { label: "Special Allowance", value: fmtINR(emp.specialAllowance) },
            { label: "Conveyance", value: fmtINR(emp.conveyance) },
          ]}
        />
        {emp.totalCtc != null && (
          <p className="nums mt-2.5 px-1 text-xs text-slate-400">
            Monthly gross ≈ {fmtINR(Math.round(emp.totalCtc / 12))}
          </p>
        )}
      </DetailSection>

      <DetailSection title="Bank Details" icon={<Landmark className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "Bank A/C No", value: emp.bankAccountNo, mono: true, copy: true },
            { label: "Bank Name", value: emp.bankName },
            { label: "IFSC", value: emp.ifsc, mono: true, copy: true },
          ]}
        />
      </DetailSection>

      <DetailSection title="Statutory IDs" icon={<IdCard className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "PAN", value: emp.panNo, mono: true, copy: true },
            { label: "UAN (PF)", value: emp.uan, mono: true, copy: true },
            { label: "ESIC No", value: emp.esicNo, mono: true, copy: true },
          ]}
        />
      </DetailSection>
    </div>
  );
}
```

- [ ] **Step 2: Swap the tab in EmployeeTabs**

In `src/components/hr/EmployeeTabs.tsx`, change:

```ts
    { label: "Payroll", href: `${base}/payroll`, exact: false },
```

to:

```ts
    { label: "Compensation", href: `${base}/compensation`, exact: false },
```

- [ ] **Step 3: Turn the old Payroll tab into a redirect**

Replace the ENTIRE contents of `src/app/(erp)/hr/employees/[id]/(hub)/payroll/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

// The Payroll tab was retired with the payroll module (2026-07 ERP change
// request); pay details live on the Compensation tab. Kept as a redirect so
// old bookmarks and deep links don't 404.
export default async function LegacyPayrollTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/hr/employees/${id}/compensation`);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(erp)/hr/employees/[id]/(hub)/compensation/page.tsx" src/components/hr/EmployeeTabs.tsx "src/app/(erp)/hr/employees/[id]/(hub)/payroll/page.tsx"
git commit -m "feat(hr): Compensation tab with full pay/bank/statutory detail replaces Payroll tab"
```

---

### Task 4: Slim the Overview + Band chip in the hub header

**Files:**
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/page.tsx`
- Modify: `src/components/hr/SnapshotStrip.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/layout.tsx`

**Interfaces:**
- Consumes: `/hr/employees/[id]/compensation` route (Task 3); `emp.band` (Task 1).
- Produces: `SnapshotStrip` prop change — `lastPay: string | null` is REPLACED by `band: string | null`. Overview no longer references `emp.payrolls` (unblocks Task 5's `_data.ts` change).

- [ ] **Step 1: Overview — add Band, remove all pay sections and the Payslips card**

In `src/app/(erp)/hr/employees/[id]/(hub)/page.tsx`:

1. Replace the imports block's first three app-imports lines:

```tsx
import { ChevronRight, Laptop, FolderKanban, BadgeIndianRupee, IdCard, Contact, Wallet, Landmark } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR, fmtDateOnly } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
```

with:

```tsx
import { ChevronRight, Laptop, FolderKanban, IdCard, Contact } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
```

2. In the *Identity & Role* `KeyValue` items, after `{ label: "Designation", value: emp.designation },` add:

```tsx
              { label: "Band", value: emp.band },
```

3. Delete the entire `<DetailSection title="Compensation" …>…</DetailSection>` block (Total CTC / Salary / LTA / Special Allowance / Conveyance + the monthly-gross `<p>`).

4. Delete the entire `<DetailSection title="Statutory & Leave" …>…</DetailSection>` block (Bank A/C No / Bank Name / IFSC / PAN / UAN / ESIC No).

5. Delete the entire `<DetailSection title="Payslips" …>…</DetailSection>` block (the `emp.payrolls` empty-state/list card at the bottom).

6. Change the bottom row's grid wrapper from:

```tsx
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
```

to:

```tsx
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
```

(The top grid keeps `lg:grid-cols-2` with its two remaining sections.)

- [ ] **Step 2: SnapshotStrip — Band chip replaces the last-pay chip**

In `src/components/hr/SnapshotStrip.tsx`:

1. In the destructured props and the type, replace `lastPay,` / `lastPay: string | null;` with `band,` / `band: string | null;`.
2. Replace the last chip:

```tsx
      <SnapshotChip href={`${base}/payroll`}>
        {lastPay ? <span className="nums">Last pay {lastPay}</span> : "No payslips"}
      </SnapshotChip>
```

with:

```tsx
      <SnapshotChip href={`${base}/compensation`}>
        {band ? <span>Band {band}</span> : "Compensation"}
      </SnapshotChip>
```

- [ ] **Step 3: Hub layout — stop deriving last pay, pass band**

In `src/app/(erp)/hr/employees/[id]/(hub)/layout.tsx`:

1. Remove the import `import { MONTHS } from "@/lib/hr-validation";` (its only consumer here is the block removed next).
2. Delete:

```tsx
  const latestPayroll = emp.payrolls[0];
  const lastPay = latestPayroll
    ? `${MONTHS[latestPayroll.periodMonth - 1].slice(0, 3)} ${latestPayroll.periodYear}`
    : null;
```

3. In the `<SnapshotStrip …/>` element, replace `lastPay={lastPay}` with `band={emp.band}`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(erp)/hr/employees/[id]/(hub)/page.tsx" src/components/hr/SnapshotStrip.tsx "src/app/(erp)/hr/employees/[id]/(hub)/layout.tsx"
git commit -m "feat(hr): profile Overview drops pay data; Band shown in identity + header chip"
```

---

### Task 5: Delete the payroll module (code only — DB untouched)

**Files:**
- Delete: `src/app/(erp)/hr/payout/page.tsx`, `src/app/(erp)/hr/payout/loading.tsx`
- Delete: `src/app/(print)/hr/payout/[id]/print/page.tsx` (remove the now-empty `(print)/hr` tree)
- Delete: `src/app/api/hr/payroll/route.ts`, `src/app/api/hr/payroll/batch/route.ts`, `src/app/api/hr/payroll/export/route.ts`, `src/app/api/hr/payroll/[id]/route.ts` (remove the `api/hr/payroll` dir)
- Delete: `src/components/hr/PayrollEditor.tsx`, `src/components/hr/PayoutViewPills.tsx`
- Delete: `src/lib/hr-lop.ts`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/_data.ts:13`
- Modify: `src/lib/nav.tsx:71,78-79,113`
- Modify: `src/components/CommandPalette.tsx` (remove the generate-payslip action + its machinery)
- Modify: `src/lib/hr-validation.ts` (remove payroll schemas + `computePayrollTotals` + `money0`)
- Modify: `src/lib/hr-excel.ts` (remove `buildPayrollWorkbook`)
- Modify: `src/lib/hr-status.ts:90-93`
- Modify: `src/lib/hr-filters.ts:1-3` (comment only)
- Modify: `prisma/seed-demo.ts` (remove payroll seeding)

**Interfaces:**
- Consumes: Tasks 3–4 must be done first (they removed the last non-payroll consumers of `emp.payrolls`, the `/payroll` tab content, and the Overview payslip links).
- Produces: no payroll code anywhere; `getEmployee` no longer includes `payrolls`; `EmployeeWithRelations` shrinks accordingly. `PayrollRecord` stays in `prisma/schema.prisma` — do NOT touch the schema in this task.

- [ ] **Step 1: Delete the payroll files**

```bash
git rm -r "src/app/(erp)/hr/payout" "src/app/(print)/hr" "src/app/api/hr/payroll" src/components/hr/PayrollEditor.tsx src/components/hr/PayoutViewPills.tsx src/lib/hr-lop.ts
```

(`(print)/hr` contains only `payout/[id]/print/page.tsx`; the vendor + finance print routes live in separate subtrees and are untouched.)

- [ ] **Step 2: Drop `payrolls` from the hub loader**

In `src/app/(erp)/hr/employees/[id]/(hub)/_data.ts`, delete the line:

```ts
      payrolls: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] },
```

- [ ] **Step 3: Remove Payout from the nav**

In `src/lib/nav.tsx`:
1. Delete the line `const HR_PAYOUT: NavItem = { label: "Payout", href: "/hr/payout", icon: BadgeIndianRupee };`
2. In `const HR: NavSection`, change the items to:

```ts
  items: [
    HR_DASHBOARD, HR_EMPLOYEES, HR_ASSETS, HR_ATTENDANCE,
    HR_PROJECTS, HR_MANPOWER, HR_RECRUITMENT,
  ],
```

3. In `navForRole()`'s HR branch, change `{ heading: "People", items: [HR_EMPLOYEES, HR_ATTENDANCE, HR_PAYOUT] },` to:

```ts
      { heading: "People", items: [HR_EMPLOYEES, HR_ATTENDANCE] },
```

4. `BadgeIndianRupee` is still used by the FINANCE section (`Payment`) — keep its import.

- [ ] **Step 4: Remove the "Generate payslip" palette action**

In `src/components/CommandPalette.tsx`:

1. Imports: drop `BadgeIndianRupee` from the lucide import.
2. `FlatItem`: change the action variant to `| { kind: "action"; id: "new-employee"; label: string; hint: string };`
3. Replace `hrefFor` with (no `lastEmployeeId` param):

```ts
function hrefFor(item: FlatItem): string {
  switch (item.kind) {
    case "employee":
      return `/hr/employees/${item.id}`;
    case "asset":
      return `/hr/employees/${item.employeeId}/assets`;
    case "project":
      return `/hr/projects/${item.id}`;
    case "action":
      return "/hr/employees/new";
  }
}
```

4. Delete the state line `const [lastEmployeeId, setLastEmployeeId] = useState<string | null>(null);`
5. `actions` memo: keep only the new-employee entry:

```ts
        ? [{ kind: "action" as const, id: "new-employee" as const, label: "New employee", hint: "Create an employee record" }]
```

6. Replace `focusRow` (and its stale comment) with:

```ts
  // Highlights `idx` — called from mouse (onHover) and mirrored inline in the
  // keyboard handler's Arrow branches.
  function focusRow(idx: number) {
    setActiveIndex(idx);
  }
```

7. In the ArrowDown and ArrowUp branches, delete the two lines `const item = flatList[next];` and `if (item && item.kind === "employee") setLastEmployeeId(item.id);` (both branches — keep the `setActiveIndex(next);`).
8. In `close()`, delete `setLastEmployeeId(null);`
9. In `selectItem`, change `router.push(hrefFor(item, lastEmployeeId));` to `router.push(hrefFor(item));` and the dependency array from `[router, lastEmployeeId, close]` to `[router, close]`.
10. In the search effect, delete all three `setLastEmployeeId(...)` lines (short-query reset, success handler, catch handler).
11. In the actions render, change the icon expression `icon={a.id === "new-employee" ? <UserPlus className="h-4 w-4" /> : <BadgeIndianRupee className="h-4 w-4" />}` to `icon={<UserPlus className="h-4 w-4" />}`.

- [ ] **Step 5: Remove payroll schemas from hr-validation**

In `src/lib/hr-validation.ts` delete:
- the `money0` preprocessor (its only consumers are removed here),
- `PAYROLL_LINE_KINDS`, `PayrollLineKind`, `payrollLineSchema`, `PayrollExtraLine`,
- `payrollSchema`, `PayrollInput`,
- the `computePayrollTotals` function (verify first: `grep -r computePayrollTotals src/` must show no remaining callers after Step 1's deletions).

Keep `MONTHS`, `money`, `quota`, and everything else.

- [ ] **Step 6: Remove the payroll workbook from hr-excel**

In `src/lib/hr-excel.ts`:
1. Change `import type { Employee, PayrollRecord } from "@prisma/client";` to `import type { Employee } from "@prisma/client";`
2. Delete the entire `// ── 3. Payroll workbook ──…` section: the `PayrollWithEmployee` type and `buildPayrollWorkbook` function (everything from that banner comment to the end of the file).

- [ ] **Step 7: Prune payroll-only status entries**

In `src/lib/hr-status.ts`, replace:

```ts
  // Payroll (client-side states)
  DRAFT: T.slate("Draft"),
  UNSAVED: T.amber("Unsaved"),
  SAVED: T.emerald("Saved"),
```

with:

```ts
  // Draft — used by the Finance invoice workflow (see PENDING_APPROVAL below).
  DRAFT: T.slate("Draft"),
```

(`UNSAVED`/`SAVED` were PayrollEditor-only; `DRAFT` is shared with Finance — the Finance comment lower in the registry says "DRAFT / APPROVED / REJECTED already exist above".)

- [ ] **Step 8: Fix the hr-filters header comment**

In `src/lib/hr-filters.ts`, change the first line of the header comment from `// Pure URL list-filter helpers shared by every HR list page (employees, assets,` / `// attendance, payout, projects).` to `// Pure URL list-filter helpers shared by every HR list page (employees, assets,` / `// attendance, projects).`

- [ ] **Step 9: Remove payroll seeding from the demo seed**

In `prisma/seed-demo.ts`:
1. Delete the `payrollFor(gross, monthIdx)` function.
2. Delete the whole `// 4) payroll — last 6 months for active employees` block through its `console.log(\`  ✓ ${payCount} payslips\`);` line.
3. Delete the `const MONTHS = [1, 2, 3, 4, 5, 6];` const (and its `// last 6 months` comment) IF its only consumer was the deleted block — verify with a grep for `MONTHS` in the file first; if attendance or another section uses it, keep it.

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 — every dangling import surfaces here; fix any missed reference by deleting the referencing dead code, not by resurrecting payroll code.

- [ ] **Step 11: Commit**

```bash
git add -A -- "src/app/(erp)/hr/payout" "src/app/(print)/hr" "src/app/api/hr/payroll" src/components/hr/PayrollEditor.tsx src/components/hr/PayoutViewPills.tsx src/lib/hr-lop.ts "src/app/(erp)/hr/employees/[id]/(hub)/_data.ts" src/lib/nav.tsx src/components/CommandPalette.tsx src/lib/hr-validation.ts src/lib/hr-excel.ts src/lib/hr-status.ts src/lib/hr-filters.ts prisma/seed-demo.ts
git commit -m "feat(hr)!: remove payroll module UI/API/code (PayrollRecord data retained)"
```

(Deliberately enumerated — a bare `git add -A -- src` would sweep in the unrelated pre-existing local modification named in Global Constraints.)

---

### Task 6: HR dashboard + oversight cleanups

**Files:**
- Modify: `src/app/(erp)/hr/page.tsx`
- Modify: `src/components/hr/DashboardTrends.tsx`
- Modify: `src/components/hr/TrendBoard.tsx`
- Modify: `src/app/(erp)/overview/page.tsx:131` (copy only)
- Modify: `src/components/Charts.tsx:185` (comment only)

**Interfaces:**
- Consumes: nothing new; independent of Task 5's deletions (these files query `prisma.payrollRecord` directly, which still exists — this task removes those queries).
- Produces: `TrendSeries` type SHRINKS to `{ headcount, attendance, leave }` — `DashboardTrends` and `TrendBoard` must change together in this task.

- [ ] **Step 1: HR dashboard page — replace the Payroll KPI with Assets-in-use, drop payroll footer/link/copy**

In `src/app/(erp)/hr/page.tsx`:

1. Imports — replace:

```tsx
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, BadgeIndianRupee, ChevronRight } from "lucide-react";
```

with:

```tsx
import { Users, Boxes, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, ChevronRight } from "lucide-react";
```

and remove the now-unused imports `import { fmtINR } from "@/lib/format";` and change `import { getPeriods, periodKey, monthlyAttendanceStats } from "@/lib/hr-dashboard";` to `import { getPeriods, monthlyAttendanceStats } from "@/lib/hr-dashboard";`

2. In the `Promise.all` destructuring, rename `payrollGroups,` to `assetsInUse,` and replace the payroll groupBy query (the `// Batched across all 12 periods…` comment plus the `prisma.payrollRecord.groupBy({...})` call) with:

```ts
    prisma.employeeAsset.count({ where: { returnedAt: null } }),
```

3. Delete the whole payroll computation block — from the comment `// Payroll → anchor on last non-zero month…` through `const showPayrollDelta = !payrollAnchorOngoing && costDelta !== null;` (13 lines).

4. In `quickLinks`, replace `{ href: "/hr/payout", label: "Payout", icon: BadgeIndianRupee },` with:

```ts
    { href: "/hr/assets", label: "Assets", icon: Boxes },
```

5. Hero copy: change `subtitle="Workforce, payroll and attendance — with trend projections."` to `subtitle="Workforce and attendance — with trend projections."`

6. Replace the entire Payroll `<StatCard …tone="emerald" icon={<Wallet…>…/>` tile (the second tile in the 2×2 cluster) with:

```tsx
              <StatCard className="flex flex-col justify-between" tone="emerald" icon={<Boxes className="h-4 w-4" />} label="Assets in use"
                href="/hr/assets"
                value={<span>{assetsInUse}</span>} />
```

7. Replace the footer line:

```tsx
        <p className="text-center text-[11px] text-slate-400">&quot;Projected&quot; values are least-squares trend extrapolations, not guarantees · {netPayrollMonth ? `${fmtINR(netPayrollMonth)} processed ${isCurrentRefMonth ? "this month" : `in ${cur.label} ${refYear}`}` : `no payroll processed ${isCurrentRefMonth ? "yet this month" : `in ${cur.label} ${refYear}`}`}</p>
```

with:

```tsx
        <p className="text-center text-[11px] text-slate-400">&quot;Projected&quot; values are least-squares trend extrapolations, not guarantees</p>
```

8. Comment hygiene (same file): in the reference-month comment change `(MonthPicker, mirrors attendance/payout)` to `(MonthPicker, mirrors attendance)` and `the payroll / attrition / headcount-at-month-end KPIs` to `the attrition / headcount-at-month-end KPIs`; in the Row-1A comment change `Headcount/payroll/attendance-rate/attrition re-anchor` to `Headcount/attendance-rate/attrition re-anchor`.

- [ ] **Step 2: DashboardTrends — drop the payroll series**

In `src/components/hr/DashboardTrends.tsx`:

1. Delete the payroll block (the comment `// Payroll series (12) → anchor on last non-zero month, forecast the rest.` and everything through the `payrollPoints` array literal's closing `];` — including `payrollSeries`, `lastActual`, `payrollActuals`, `fLabels`, `payrollForecast`).
2. Change the series assembly line to:

```ts
  const series: TrendSeries = { headcount: headcountPoints, attendance: attendancePoints, leave: leavePoints };
```

3. Update the header comment's `12x monthly aggregate/groupBy loops for payroll, headcount, attendance and leave` to `12x monthly aggregate loops for headcount, attendance and leave`.
4. `prisma` is still imported for the headcount counts; `linearForecast` is still used by headcount — keep both imports.

- [ ] **Step 3: TrendBoard — remove the payroll metric**

In `src/components/hr/TrendBoard.tsx`:

1. Remove `Wallet` from the lucide import and delete `import { fmtINR } from "@/lib/format";`
2. `TrendSeries`: delete the `payroll: Point[];` line (keep the comment shape of the others).
3. `type Metric`: change to `type Metric = "headcount" | "attendance" | "leave";`
4. `METRICS`: delete the payroll entry (the array then starts with headcount).
5. `SUBTITLE`: delete the `payroll:` line.
6. Default metric: change `useState<Metric>("payroll")` to `useState<Metric>("headcount")`.
7. Delete the `const payroll = useMemo(…)` line.
8. `sparkData`: delete the `payroll: actualValues(series.payroll),` line.
9. `currentValue`: delete the `payroll: fmtINR(sparkData.payroll.at(-1) ?? 0),` line.
10. `showLegend`: change to `const showLegend = metric === "headcount";` and update its comment to say headcount is the only forecast-capable series.
11. Render: delete the line `{metric === "payroll" && <ForecastArea data={payroll} idPrefix="tb-pay" />}`.

- [ ] **Step 4: Copy/comment touch-ups elsewhere**

1. `src/app/(erp)/overview/page.tsx`: change the HR card desc `"Employee master, attendance, payroll and project staffing."` to `"Employee master, attendance and project staffing."`
2. `src/components/Charts.tsx`: change the comment `— payroll/headcount series run up to` to `— the headcount series runs up to`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(erp)/hr/page.tsx" src/components/hr/DashboardTrends.tsx src/components/hr/TrendBoard.tsx "src/app/(erp)/overview/page.tsx" src/components/Charts.tsx
git commit -m "feat(hr): dashboard drops payroll KPI/trend; assets-in-use tile replaces it"
```

---

### Task 7: Full verification gate

**Files:** none created/modified (fixes only if the gates fail).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: green `npm run build` + `npm run lint`; manual route checklist passed.

- [ ] **Step 1: Confirm no dev server is running** (a concurrent build wedges `.next` — CLAUDE.md). If one is running, stop it first.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiles with 0 type errors. Route list must NOT contain `/hr/payout` or `/api/hr/payroll*`; MUST contain `/hr/employees/[id]/compensation`. If the build fails referencing routes that no longer exist, delete `.next` and rebuild (stale type cache).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exit 0 (no unused-import/var errors — Tasks 4–6 removed every orphaned import; fix any stragglers by removing the dead reference).

- [ ] **Step 4: Manual pass (needs a reachable dev DB — skip gracefully if none, noting it in the report)**

With `npm run dev`:
1. `/hr/employees/<id>` — Overview shows Band under Designation; NO Compensation/Statutory sections; bottom row = Assets + Projects only.
2. Tabs read Overview / Attendance / Assets / Projects / Compensation; the Compensation tab shows Pay Structure + Bank Details + Statutory IDs.
3. `/hr/employees/<id>/payroll` redirects to `…/compensation`.
4. Edit form: Band field in Identity & Role saves and round-trips.
5. Header chip shows `Band <value>` (or "Compensation") and links to the tab.
6. `/hr` dashboard: Assets-in-use tile (links `/hr/assets`); Trends defaults to Headcount with no Payroll pill; footer has no payroll sentence.
7. Sidebar (HR role and ADMIN): no Payout entry. Cmd-K: only "New employee" quick action.
8. `/hr/payout` → branded 404.

- [ ] **Step 5: Report**

State plainly what passed, what was skipped (e.g. manual pass without a DB), and any deviations from the plan.
