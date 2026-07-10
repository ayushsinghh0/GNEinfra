# HR Feedback Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the client-feedback round on the HR module per `docs/superpowers/specs/2026-07-10-hr-feedback-round-design.md`: compact manpower dashboard, `Employee.department`, bank/statutory back on the employee form + profile, I-Card & leave-details removal, payroll↔CTC reconciliation, attendance header compaction + export column split, and a generalized asset register.

**Architecture:** Next.js 16 App Router RSC pages + `/api/hr/*` route handlers, Prisma/Postgres, Zod validation in `src/lib/hr-validation.ts`. Two additive Prisma migrations. All UI composes existing primitives (`StatCard`, `Card`, `BarList`, `EntityLink`, `DataTable`, `KeyValue`/`DetailSection`).

**Tech Stack:** Next.js 16, Prisma, Zod, ExcelJS, Tailwind (Soft Wave design system).

## Global Constraints

- **No test runner exists.** Per-task gate: `npx tsc --noEmit` and `npm run lint`. Final task runs `npm run build`. ⚠️ NEVER run `npm run build` while `npm run dev` is running (wedges `.next`).
- **Migrations are additive only** — never reset/squash; author SQL by hand into `prisma/migrations/<ts>_<name>/migration.sql` if no local DB is reachable, then `npx prisma generate` (works offline).
- **RBAC pattern:** every page calls `requirePageRole()`, every API calls `getCurrentUser()` + role-set check; HR_VIEW reads, HR_WRITE mutates; guards reject `mustChangePassword`. Managers are read-only.
- **Money is integer rupees.** Tabular figures via `.nums` on codes/money/dates.
- **DataTable rule:** any hideable column MUST set `cardLabel`; cells with their own links wrap content in `relative z-10`.
- **Light mode only; no chart/animation libraries; atmosphere only in chrome.**
- Commit after each task with the trailer:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Migration #1 — `Employee.department` + presets + "Outsourced" category

**Files:**
- Modify: `prisma/schema.prisma` (Employee model, ~line 296)
- Create: `prisma/migrations/20260710120000_employee_department/migration.sql`
- Modify: `src/lib/hr-validation.ts:3` (EMP_CATEGORIES) and add DEPARTMENTS

**Interfaces:**
- Produces: `Employee.department: string | null` (Prisma), `DEPARTMENTS: readonly string[]` and updated `EMP_CATEGORIES` exported from `@/lib/hr-validation`. Later tasks import `DEPARTMENTS` for form/filter dropdowns.

- [ ] **Step 1: Add the column to the Prisma schema**

In `prisma/schema.prisma`, in `model Employee`, directly below `empCategory      String?` add:

```prisma
  department       String?
```

- [ ] **Step 2: Author the migration SQL**

Create `prisma/migrations/20260710120000_employee_department/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "department" TEXT;
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Add the presets to hr-validation**

In `src/lib/hr-validation.ts`, replace line 3:

```ts
export const EMP_CATEGORIES = ["On-Roll", "Contract", "Outsourced", "Intern", "Consultant"] as const;

// Preset departments for Employee.department (a UI convenience — the stored
// value stays a free string via the form's "Other…" input, so custom/legacy
// values keep working).
export const DEPARTMENTS = [
  "Business Development",
  "Supply Chain",
  "Projects",
  "Engineering & Design",
  "Finance & Accounts",
  "HR & Admin",
  "Operations & Maintenance",
] as const;
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → no errors. Run: `npm run lint` → no new warnings.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260710120000_employee_department src/lib/hr-validation.ts
git commit -m "feat(hr): Employee.department column + department/category presets"
```

---

### Task 2: Employee schema + form + APIs — bank/statutory in, I-Card + leave out, department in

**Files:**
- Modify: `src/lib/hr-validation.ts` (employeeSchema, ~lines 68-97)
- Modify: `src/components/hr/EmployeeForm.tsx`
- Modify: `src/app/api/hr/employees/route.ts` (POST)
- Modify: `src/app/api/hr/employees/[id]/route.ts` (PATCH)
- Modify: `src/app/(erp)/hr/employees/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `DEPARTMENTS` from Task 1.
- Produces: `employeeSchema` WITHOUT `iCardNo`/`casualLeaveQuota`/`sickLeaveQuota`, WITH `department`, `bankAccountNo`, `bankName`, `ifsc`, `panNo`, `uan`, `esicNo` (all optional trimmed strings). POST/PATCH `/api/hr/employees` accept and persist exactly these.

- [ ] **Step 1: Rework `employeeSchema` in `src/lib/hr-validation.ts`**

Delete the `quota` preprocess helper (lines 68-72, now unused) and replace the whole `employeeSchema` object with:

```ts
export const employeeSchema = z.object({
  empId: z.string().trim().min(1, "EMP ID is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(200),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  band: z.string().trim().max(40).optional().or(z.literal("")),
  empCategory: z.string().trim().min(1, "Emp Category is required").max(60),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  dateOfJoining: z.string().min(1, "Date of Joining is required"),
  location: z.string().trim().min(1, "Location is required").max(120),
  payrollType: z.string().trim().max(60).optional().or(z.literal("")),
  mailId: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  emergencyNumber: z.string().trim().max(20).optional().or(z.literal("")),
  bloodGroup: z.string().trim().max(8).optional().or(z.literal("")),
  dob: optDate,
  offerLetterDate: optDate,
  leavingDate: optDate,
  // Bank + statutory live on BOTH this form and /hr/payroll (same columns —
  // last write wins). Pay structure (CTC/salary/deductions) stays payroll-only.
  bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  ifsc: z.string().trim().max(11).optional().or(z.literal("")),
  panNo: z.string().trim().max(10).optional().or(z.literal("")),
  uan: z.string().trim().max(20).optional().or(z.literal("")),
  esicNo: z.string().trim().max(20).optional().or(z.literal("")),
  // Family / next-of-kin members — saved as a full replace of the set.
  familyMembers: z.array(familyMemberSchema).max(20).optional(),
});
```

(`iCardNo` and both leave quotas are gone; leave quota DB columns keep their default of 12 on create.)

- [ ] **Step 2: Rework `EmployeeForm.tsx`**

a) Import `DEPARTMENTS`:

```ts
import { EMP_CATEGORIES, FAMILY_RELATIONS, EMPLOYEE_POSITIONS, DEPARTMENTS } from "@/lib/hr-validation";
```

b) Replace the `EMPTY` constant:

```ts
const EMPTY: Values = {
  empId: "", name: "", designation: "", band: "", empCategory: "On-Roll", department: "",
  location: "", dateOfJoining: "", payrollType: "", mailId: "", emergencyNumber: "",
  bloodGroup: "", dob: "", offerLetterDate: "", leavingDate: "",
  bankAccountNo: "", bankName: "", ifsc: "", panNo: "", uan: "", esicNo: "",
};
```

c) Below the `designationOther` state, add the parallel department state:

```ts
  // Department mirrors the designation dropdown+Other pattern.
  const deptPresets: readonly string[] = DEPARTMENTS;
  const [departmentOther, setDepartmentOther] = useState<boolean>(
    () => !!v.department && !deptPresets.includes(v.department)
  );
```

d) In the "Identity & Role" `<Section>`: delete the line `{Txt("iCardNo", "I-Card No")}` and, directly after the Emp Category `<Field>`, insert:

```tsx
        <Field label="Department" htmlFor="department">
          <Select
            id="department"
            value={departmentOther ? "__OTHER__" : v.department}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__OTHER__") {
                setDepartmentOther(true);
                setV((s) => ({ ...s, department: "" }));
              } else {
                setDepartmentOther(false);
                setV((s) => ({ ...s, department: val }));
              }
            }}
          >
            <option value="">Select department…</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="__OTHER__">Other…</option>
          </Select>
          {departmentOther && (
            <Input className="mt-2" value={v.department} onChange={set("department")} placeholder="Enter department" aria-label="Custom department" />
          )}
        </Field>
```

e) Replace the whole "Leave" `<Section>` (including its preceding comment about pay living on the payroll page) with:

```tsx
      {/* Pay structure (CTC/salary/deductions) lives on /hr/payroll — salary is
          decided later. Bank + statutory ARE captured here (client requirement)
          and stay editable on the payroll page too (same columns). */}
      <Section title="Bank & statutory">
        {Txt("bankAccountNo", "Bank A/C No")}
        {Txt("bankName", "Bank Name")}
        {Txt("ifsc", "IFSC")}
        {Txt("panNo", "PAN No")}
        {Txt("uan", "UAN (PF)")}
        {Txt("esicNo", "ESIC No")}
      </Section>
```

- [ ] **Step 3: Update the POST route** (`src/app/api/hr/employees/route.ts`)

In the `prisma.employee.create` data object: delete the `iCardNo: d.iCardNo || null,` fragment and the `casualLeaveQuota: d.casualLeaveQuota,` / `sickLeaveQuota: d.sickLeaveQuota,` lines; after `empCategory: d.empCategory,` add `department: d.department || null,`; replace the `// Pay / bank / statutory are set later…` comment with:

```ts
        bankAccountNo: d.bankAccountNo || null, bankName: d.bankName || null, ifsc: d.ifsc || null,
        panNo: d.panNo || null, uan: d.uan || null, esicNo: d.esicNo || null,
        // Pay structure (CTC/salary/deductions) is set later on /hr/payroll, not here.
```

- [ ] **Step 4: Update the PATCH route** (`src/app/api/hr/employees/[id]/route.ts`)

Same edits as Step 3 in the `prisma.employee.update` data object (delete iCardNo + quota lines, add `department` + the six bank/statutory lines, adjust the comment the same way).

- [ ] **Step 5: Update the edit page initial values** (`src/app/(erp)/hr/employees/[id]/edit/page.tsx`)

In `initial`: delete `iCardNo`, `casualLeaveQuota`, `sickLeaveQuota` lines; after `empCategory` add `department: emp.department ?? "",`; before the closing brace add:

```ts
    bankAccountNo: emp.bankAccountNo ?? "",
    bankName: emp.bankName ?? "",
    ifsc: emp.ifsc ?? "",
    panNo: emp.panNo ?? "",
    uan: emp.uan ?? "",
    esicNo: emp.esicNo ?? "",
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → no errors (this catches every leftover `d.iCardNo`/`d.casualLeaveQuota` reference). Run: `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hr-validation.ts src/components/hr/EmployeeForm.tsx src/app/api/hr/employees src/app/(erp)/hr/employees/[id]/edit/page.tsx
git commit -m "feat(hr): bank & statutory on employee form, department dropdown; drop I-Card + leave quotas"
```

---

### Task 3: Profile Overview + hub chrome — bank section, department row, leave removal

**Files:**
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/page.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/layout.tsx`
- Modify: `src/components/hr/SnapshotStrip.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/attendance/page.tsx`
- Modify: `src/lib/hr-leave.ts`

**Interfaces:**
- Consumes: `Employee.department` (Task 1), bank columns (existing).
- Produces: `SnapshotStrip` props narrowed to `{ id, tenureLabel, assetsCount, activeProjects, band }`. `hr-leave.ts` exports ONLY `attendanceYearSummary` after this task.

- [ ] **Step 1: Overview page** (`(hub)/page.tsx`)

a) In the *Identity & Role* `KeyValue` items: replace `{ label: "I-Card No", value: emp.iCardNo, mono: true },` with nothing, and after `{ label: "Category", value: emp.empCategory },` add `{ label: "Department", value: emp.department },`.

b) Add `Landmark` to the lucide import, and insert a third `DetailSection` inside the FIRST `grid grid-cols-1 gap-6 lg:grid-cols-2` div, after the *Contact & Personal* section:

```tsx
        <DetailSection title="Bank & statutory" icon={<Landmark className="h-4 w-4 text-slate-400" />}>
          <KeyValue
            items={[
              { label: "Bank A/C No", value: emp.bankAccountNo, mono: true },
              { label: "Bank Name", value: emp.bankName },
              { label: "IFSC", value: emp.ifsc, mono: true },
              { label: "PAN No", value: emp.panNo, mono: true },
              { label: "UAN (PF)", value: emp.uan, mono: true },
              { label: "ESIC No", value: emp.esicNo, mono: true },
            ]}
          />
        </DetailSection>
```

- [ ] **Step 2: Hub layout** (`(hub)/layout.tsx`)

Delete the import `import { leaveBalances } from "@/lib/hr-leave";`, delete the two lines computing `year` and `balances`, and remove `casualRemaining={balances.casualRemaining}` / `sickRemaining={balances.sickRemaining}` from the `<SnapshotStrip>` call.

- [ ] **Step 3: SnapshotStrip** (`src/components/hr/SnapshotStrip.tsx`)

Remove `casualRemaining` and `sickRemaining` from the prop list and type, and delete the two `<SnapshotChip href={…/attendance}>CL/SL … left</SnapshotChip>` chips.

- [ ] **Step 4: Hub attendance tab** (`(hub)/attendance/page.tsx`)

a) Change the hr-leave import to `import { attendanceYearSummary } from "@/lib/hr-leave";`
b) In the `Promise.all`, drop the `leaveBalances(...)` entry and its `balances` binding: `const [records, summary] = await Promise.all([...]);`
c) Delete the entire `<DetailSection title="Leave Balances">…</DetailSection>` block and unwrap the remaining *Year Summary* section from the now-single-child `grid lg:grid-cols-2` div (the `DetailSection title={`${year} Summary`}` becomes a direct child of the outer `space-y-6` div).

- [ ] **Step 5: Delete `leaveBalances`** from `src/lib/hr-leave.ts` (keep `attendanceYearSummary`). Update the file's top comment to say it holds the year-summary helper.

- [ ] **Step 6: Verify** — `npx tsc --noEmit` (catches any other `leaveBalances` caller) + `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/app/(erp)/hr/employees src/components/hr/SnapshotStrip.tsx src/lib/hr-leave.ts
git commit -m "feat(hr): bank & statutory on profile, department row; remove I-Card + leave details from profile"
```

---

### Task 4: Employees list + Excel export — department filter/column, reconciled pay columns

**Files:**
- Modify: `src/lib/hr-filters.ts`
- Modify: `src/app/(erp)/hr/employees/page.tsx`
- Modify: `src/components/hr/EmployeeSearch.tsx`
- Modify: `src/app/api/hr/employees/export/route.ts`
- Modify: `src/lib/hr-excel.ts` (buildEmployeesWorkbook)

**Interfaces:**
- Consumes: `DEPARTMENTS` (Task 1), `Employee.department`.
- Produces: `ParsedListParams.department?: string`; `buildQuery` serializes `department`; `/hr/employees?department=…` filters the list AND the export (dashboard Task 10 links here).

- [ ] **Step 1: hr-filters** — add `department?: string;` to `ParsedListParams` (after `category`), add `department: trimmedOrUndefined(sp.department),` to `parseListParams`, and `setIfPresent("department", patch.department);` to `buildQuery` (after the category line).

- [ ] **Step 2: Employees page** (`src/app/(erp)/hr/employees/page.tsx`)

a) searchParams type + destructure gain `department?: string` / `department`.
b) After the category `where` block add:

```ts
  if (department && department.trim()) {
    where.department = department.trim();
  }
```

c) `filterNote`: `const filterNote = category ? `Category: ${category.trim()}` : department ? `Department: ${department.trim()}` : location ? `Location: ${location.trim()}` : null;`
d) `hasFilters` gains `|| (department && department.trim())` (inside the `Boolean(...)`).
e) `exportHref` becomes `buildQuery("/api/hr/employees/export", { q, status, category, department, location });`
f) Add a Department column after the `designation` column:

```ts
    {
      key: "department",
      header: "Department",
      priority: "lg",
      cardLabel: "Department",
      cell: (e) => e.department ?? "—",
    },
```

- [ ] **Step 3: EmployeeSearch** (`src/components/hr/EmployeeSearch.tsx`) — add a department dropdown

a) Import `DEPARTMENTS`: `import { DEPARTMENTS } from "@/lib/hr-validation";`
b) Track it like status:

```ts
  const urlDepartment = params.get("department") ?? "";
  const [department, setDepartment] = useState(urlDepartment);
```

c) Extend the resync key: `const [seen, setSeen] = useState(`${urlQ}|${urlStatus}|${urlDepartment}`);` and the following `if` to compare/re-set all three (`setDepartment(urlDepartment);`).
d) Change `apply` to `apply(nextQ: string, nextStatus: string, nextDepartment: string)` and build with it:

```ts
    const href = buildQuery("/hr/employees", {
      q: nextQ || undefined,
      status: nextStatus || undefined,
      department: nextDepartment || undefined,
      category,
      location,
    });
```

(delete the old `params.get("department")`-less behavior — `category`/`location` passthrough stays). Update the three call sites: `onQChange` → `apply(v, status, department)`, `onSubmit` → `apply(q, status, department)`, status onChange → `apply(q, e.target.value, department)`.
e) Add the select after the status `<Select>`:

```tsx
      <Select
        value={department}
        disabled={isPending}
        aria-label="Filter by department"
        onChange={(e) => {
          setDepartment(e.target.value);
          apply(q, status, e.target.value);
        }}
        className="sm:w-56"
      >
        <option value="">All departments</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </Select>
```

- [ ] **Step 4: Export route** (`src/app/api/hr/employees/export/route.ts`) — mirror the list filter: after the category block add

```ts
  const department = sp.get("department");
  if (department && department.trim()) {
    where.department = department.trim();
  }
```

- [ ] **Step 5: Rework `buildEmployeesWorkbook`** in `src/lib/hr-excel.ts`

Replace `headers`, `ws.columns` and the row-push block with:

```ts
  const headers = [
    "S.No",
    "EMP ID",
    "Name",
    "Designation",
    "Band",
    "Department",
    "Emp Category",
    "Payroll Type",
    "Location",
    "Mail Id",
    "Emergency Number",
    "Blood Group",
    "DOB",
    "Date of Joining",
    "Offer Letter Date",
    "Leaving Date",
    "Status",
    "Total CTC",
    "Monthly Gross",
    "Annualised Gross (×12)",
    "Salary",
    "LTA",
    "Special Allowance",
    "Conveyance",
  ];

  ws.columns = [
    { width: 6 },   // S.No
    { width: 14 },  // EMP ID
    { width: 28 },  // Name
    { width: 22 },  // Designation
    { width: 10 },  // Band
    { width: 22 },  // Department
    { width: 16 },  // Emp Category
    { width: 14 },  // Payroll Type
    { width: 16 },  // Location
    { width: 28 },  // Mail Id
    { width: 18 },  // Emergency Number
    { width: 13 },  // Blood Group
    { width: 14 },  // DOB
    { width: 16 },  // Date of Joining
    { width: 18 },  // Offer Letter Date
    { width: 14 },  // Leaving Date
    { width: 10 },  // Status
    { width: 12 },  // Total CTC
    { width: 14 },  // Monthly Gross
    { width: 20 },  // Annualised Gross
    { width: 10 },  // Salary
    { width: 10 },  // LTA
    { width: 18 },  // Special Allowance
    { width: 13 },  // Conveyance
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  employees.forEach((emp, idx) => {
    // Monthly gross mirrors /hr/payroll's live summary; ×12 sits next to the
    // annual Total CTC so the two are directly comparable in the sheet.
    const gross =
      (emp.salary ?? 0) + (emp.lta ?? 0) + (emp.specialAllowance ?? 0) + (emp.conveyance ?? 0);
    ws.addRow([
      idx + 1,
      emp.empId,
      emp.name,
      emp.designation,
      emp.band ?? "",
      emp.department ?? "",
      emp.empCategory ?? "",
      emp.payrollType ?? "",
      emp.location ?? "",
      emp.mailId ?? "",
      emp.emergencyNumber ?? "",
      emp.bloodGroup ?? "",
      fmtDate(emp.dob),
      fmtDate(emp.dateOfJoining),
      fmtDate(emp.offerLetterDate),
      fmtDate(emp.leavingDate),
      emp.status,
      emp.totalCtc ?? "",
      gross || "",
      gross ? gross * 12 : "",
      emp.salary ?? "",
      emp.lta ?? "",
      emp.specialAllowance ?? "",
      emp.conveyance ?? "",
    ]);
  });
```

(The "I-Card" header/width/value are gone.)

- [ ] **Step 6: Verify** — `npx tsc --noEmit` + `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hr-filters.ts src/lib/hr-excel.ts src/components/hr/EmployeeSearch.tsx "src/app/(erp)/hr/employees/page.tsx" src/app/api/hr/employees/export/route.ts
git commit -m "feat(hr): department filter/column on employees list; export gains Department + reconciled gross, drops I-Card"
```

---

### Task 5: Payroll ↔ CTC hints — editor delta + list chip

**Files:**
- Modify: `src/components/hr/PayrollForm.tsx`
- Modify: `src/app/(erp)/hr/payroll/page.tsx`

**Interfaces:**
- Consumes: existing `monthlyNet()` in payroll/page.tsx; `fmtINR` from `@/lib/format`.
- Produces: none (pure UI).

- [ ] **Step 1: Delta hint in PayrollForm**

Below the existing `const net = gross - deductions;` add:

```ts
  // Non-blocking reconciliation hint: the annual CTC and the monthly breakup
  // are entered independently — surface the delta so HR fixes it at entry time.
  const ctc = n("totalCtc");
  const annualised = gross * 12;
  const ctcMismatch = ctc > 0 && gross > 0 && annualised !== ctc;
```

Directly AFTER the closing `</div>` of the "Live take-home summary" block, add:

```tsx
      {ctcMismatch && (
        <p role="status" className="nums flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            12 × monthly gross ({fmtINR(annualised)}) differs from Total CTC ({fmtINR(ctc)}) by{" "}
            <span className="font-semibold">{fmtINR(Math.abs(ctc - annualised))}</span>.
          </span>
        </p>
      )}
```

- [ ] **Step 2: Mismatch chip on the payroll list** (`src/app/(erp)/hr/payroll/page.tsx`)

Replace the `ctc` column definition with:

```ts
    {
      key: "ctc",
      header: "CTC",
      align: "right",
      cardLabel: "CTC",
      cell: (e) => {
        const { gross } = monthlyNet(e);
        const mismatch = e.totalCtc != null && e.totalCtc > 0 && gross > 0 && gross * 12 !== e.totalCtc;
        return (
          <span className="inline-flex items-center gap-1.5">
            {mismatch && (
              <span
                title="12 × monthly gross does not equal Total CTC — fix the breakup on this employee's payroll page"
                className="whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
              >
                breakup ≠ CTC
              </span>
            )}
            <span className="nums">{fmtINR(e.totalCtc)}</span>
          </span>
        );
      },
    },
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` + `npm run lint`.

- [ ] **Step 4: Commit**

```bash
git add src/components/hr/PayrollForm.tsx "src/app/(erp)/hr/payroll/page.tsx"
git commit -m "feat(hr): payroll breakup vs CTC reconciliation hints (editor delta + list chip)"
```

---

### Task 6: Attendance export — split EMP ID / Name columns

**Files:**
- Modify: `src/lib/hr-excel.ts` (buildAttendanceWorkbook)

**Interfaces:** none beyond the existing function signature.

- [ ] **Step 1: Split the identity column**

In `buildAttendanceWorkbook` replace:

```ts
  const headers = [
    "Employee",
    ...
  ];
  ws.columns = [
    { width: 34 },
    ...
```

with:

```ts
  const headers = [
    "EMP ID",
    "Employee Name",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    "P",
    "L",
    "A",
  ];

  ws.columns = [
    { width: 12 },
    { width: 26 },
    ...Array.from({ length: daysInMonth }, () => ({ width: 5 })),
    { width: 5 },
    { width: 5 },
    { width: 5 },
  ];
```

and change the row push to:

```ts
    ws.addRow([emp.empId, emp.name, ...dayCells, P, L, A]);
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` + `npm run lint`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr-excel.ts
git commit -m "feat(hr): attendance export splits EMP ID and Employee Name into separate columns"
```

---

### Task 7: Attendance header compaction

**Files:**
- Modify: `src/components/hr/AttendanceGrid.tsx`

**Interfaces:**
- Preserve UNCHANGED: drag-to-paint handlers (`cellDown`/`cellEnter`/`fillDay`), the `POST /api/hr/attendance {year,month,entries,clears}` save contract, the URL-driven `?grid=` toggle, and the component's props.

- [ ] **Step 1: Imports**

In the lucide import replace `CalendarCheck2` with `Info` (keep `Eraser, Search, Users`). Remove `StatCard, ProgressBar`? — **keep `ProgressBar`** (used by the calendar summary panel); remove only `StatCard` from the `@/components/ui` import.

- [ ] **Step 2: Replace the stat strip + toolbar + pills with ONE compact card**

Delete everything from the comment `{/* Stat strip — person-framed …` through the closing `)}` of the filter-pills conditional — i.e. the two `singleEmp ? (...) : (...)` StatCard grids, the old toolbar card, and the standalone sticky pills bar. In its place, inside the same top-level `<div className="space-y-5">` (change that to `space-y-4`), insert:

```tsx
      {/* Compact header: tallies + view/search on one line, brush palette on the
          next, employee pills below — all in ONE card so the grid gets the
          vertical space back (client feedback: more rows on a single screen). */}
      <div className="space-y-2.5 rounded-2xl bg-white p-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="nums flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs font-medium text-slate-600">
            {singleEmp ? (
              <>
                <span><span className="font-semibold text-emerald-700">{scopedTally.present}</span> present</span>
                <span><span className="font-semibold text-rose-600">{scopedTally.absent}</span> absent</span>
                <span><span className="font-semibold text-amber-600">{scopedTally.leaveSick}</span> leave + sick</span>
                <span><span className="font-semibold text-slate-500">{scopedTally.unmarked}</span> unmarked</span>
              </>
            ) : (
              <>
                <span><span className="font-semibold text-slate-900">{employees.length}</span> employees</span>
                <span><span className="font-semibold text-emerald-700">{totals.present}</span> present</span>
                <span><span className="font-semibold text-rose-600">{totals.absent}</span> absent</span>
                <span><span className="font-semibold text-slate-500">{totals.unmarked}</span> unmarked</span>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Attendance view"
              size="sm"
              value={view}
              onChange={changeView}
              options={[
                { value: "calendar", label: "Calendar" },
                { value: "table", label: "Table" },
              ]}
            />
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="h-9 w-40 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
              />
            </div>
            {canWrite && (
              <span title={hint} className="grid h-9 w-9 cursor-help place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                <Info className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{hint}</span>
              </span>
            )}
          </div>
        </div>

        {canWrite ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Attendance status brush">
            {BRUSHES.map((b) => {
              const active = brush === b;
              const isErase = b === "ERASE";
              const meta = b === "ERASE" ? null : STATUS[b];
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrush(b)}
                  aria-pressed={active}
                  title={isErase ? "Erase" : `${meta!.label} (${meta!.code})`}
                  className={cn(
                    "press inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {isErase ? (
                    <Eraser className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <span className={cn("grid h-4 w-4 place-items-center rounded text-[10px] font-bold text-white", meta!.swatch)}>{meta!.code}</span>
                  )}
                  <span>{isErase ? "Erase" : meta!.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2" aria-label="Attendance status legend">
            {ATTENDANCE_STATUSES.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS[s].swatch)} aria-hidden="true" />
                {STATUS[s].label}
              </span>
            ))}
          </div>
        )}

        {(pillEmployees.length > 1 || selectedEmp) && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-0.5">
            <button
              type="button"
              onClick={() => setSelectedEmp(null)}
              aria-pressed={selectedEmp === null}
              className={cn(
                "press shrink-0 rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                selectedEmp === null
                  ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              )}
            >
              All <span className="nums">{employees.length}</span>
            </button>
            {pillEmployees.map((emp) => {
              const active = selectedEmp === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedEmp(active ? null : emp.id)}
                  title={emp.name}
                  aria-pressed={active}
                  className={cn(
                    "press shrink-0 rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                    active
                      ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  )}
                >
                  <span className="nums text-slate-400">{emp.empId}</span> {emp.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>
```

and define `hint` just above the `return`:

```ts
  const hint = `Pick a status, then click or drag across days to mark it. Click a cell again to clear it.${view === "table" ? " Click a day column header to fill that day for every employee shown." : ""}`;
```

(The brush palette / legend / pills markup is byte-identical to today's — only its container moved; the four StatCards and the always-visible hint paragraph are gone.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` + `npm run lint`. If a dev server is available, load `/hr/attendance?grid=table` and confirm: one compact header card, painting + day-header fill + save all still work, and the ⓘ tooltip shows the instructions.

- [ ] **Step 4: Commit**

```bash
git add src/components/hr/AttendanceGrid.tsx
git commit -m "feat(hr): compact attendance header — inline tallies, merged toolbar, hint behind tooltip"
```

---

### Task 8: Migration #2 — asset register columns + presets + schema

**Files:**
- Modify: `prisma/schema.prisma` (EmployeeAsset model)
- Create: `prisma/migrations/20260710130000_asset_register_fields/migration.sql`
- Modify: `src/lib/hr-validation.ts` (ASSET_TYPES/ASSET_CONDITIONS + assetSchema)

**Interfaces:**
- Produces: `EmployeeAsset.{assetType,assetTag,condition,purchaseValue,purchaseDate,remarks}`; `ASSET_TYPES`, `ASSET_CONDITIONS` exports; `assetSchema` accepting the new fields plus `allocatedAt` (ISO date string). Task 9 consumes all of these.

- [ ] **Step 1: Schema** — in `model EmployeeAsset`, after `oemName    String?` add:

```prisma
  assetType     String?
  assetTag      String?
  condition     String?
  purchaseValue Int?
  purchaseDate  DateTime?
  remarks       String?
```

- [ ] **Step 2: Migration SQL** — create `prisma/migrations/20260710130000_asset_register_fields/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "EmployeeAsset" ADD COLUMN     "assetType" TEXT,
ADD COLUMN     "assetTag" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "purchaseValue" INTEGER,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "remarks" TEXT;

-- Backfill assetType from the legacy issued-item booleans (deterministic, additive)
UPDATE "EmployeeAsset" SET "assetType" = 'Laptop'  WHERE "assetType" IS NULL AND "hasLaptop" = true;
UPDATE "EmployeeAsset" SET "assetType" = 'ID Card' WHERE "assetType" IS NULL AND "idCard" = true;
```

- [ ] **Step 3: Regenerate** — `npx prisma generate` → success.

- [ ] **Step 4: Presets + schema in hr-validation.ts**

Above `assetSchema` add:

```ts
export const ASSET_TYPES = [
  "Laptop", "Desktop", "Monitor", "Phone", "SIM", "ID Card", "Vehicle", "Tool", "Furniture", "Other",
] as const;
export const ASSET_CONDITIONS = ["New", "Good", "Fair", "Damaged"] as const;
```

Replace `assetSchema` with:

```ts
export const assetSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  assetType: z.string().trim().max(40).optional().or(z.literal("")),
  hasLaptop: z.coerce.boolean().optional(),
  lpSerialNo: z.string().trim().max(80).optional().or(z.literal("")),
  makeModel: z.string().trim().max(120).optional().or(z.literal("")),
  lpCategory: z.string().trim().max(60).optional().or(z.literal("")),
  oemName: z.string().trim().max(80).optional().or(z.literal("")),
  assetTag: z.string().trim().max(60).optional().or(z.literal("")),
  condition: z.string().trim().max(20).optional().or(z.literal("")),
  purchaseValue: money,
  purchaseDate: optDate,
  allocatedAt: optDate,
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  laptopBag: z.coerce.boolean().optional(),
  mouse: z.coerce.boolean().optional(),
  charger: z.coerce.boolean().optional(),
  idCard: z.coerce.boolean().optional(),
});
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit` + `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260710130000_asset_register_fields src/lib/hr-validation.ts
git commit -m "feat(hr): asset register columns (type/tag/condition/value/date/remarks) + presets"
```

---

### Task 9: Asset UI + APIs — form, routes, table, hub views

**Files:**
- Modify: `src/components/hr/AssetForm.tsx`
- Modify: `src/app/api/hr/assets/route.ts`, `src/app/api/hr/assets/[id]/route.ts`
- Modify: `src/app/(erp)/hr/assets/page.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/assets/page.tsx`
- Modify: `src/app/(erp)/hr/employees/[id]/(hub)/page.tsx` (asset snippet only)

**Interfaces:**
- Consumes: `ASSET_TYPES`, `ASSET_CONDITIONS`, extended `assetSchema` (Task 8).
- Produces: `AssetValues` (AssetForm export) gains `assetType, assetTag, condition, purchaseValue, purchaseDate, allocatedAt, remarks` — ALL string fields on the client. `AssetRowActions` consumes `AssetValues & { id: string }` unchanged in shape-name.

- [ ] **Step 1: AssetForm**

a) Import presets: `import { ASSET_TYPES, ASSET_CONDITIONS } from "@/lib/hr-validation";`
b) Extend the exported type + EMPTY:

```ts
export type AssetValues = {
  employeeId: string;
  hasLaptop: boolean; laptopBag: boolean; mouse: boolean; charger: boolean; idCard: boolean;
  assetType: string; lpSerialNo: string; makeModel: string; lpCategory: string; oemName: string;
  assetTag: string; condition: string; purchaseValue: string; purchaseDate: string;
  allocatedAt: string; remarks: string;
  returnedAt?: string;
};

const EMPTY: AssetValues = {
  employeeId: "",
  hasLaptop: false, laptopBag: false, mouse: false, charger: false, idCard: false,
  assetType: "", lpSerialNo: "", makeModel: "", lpCategory: "", oemName: "",
  assetTag: "", condition: "", purchaseValue: "", purchaseDate: "",
  allocatedAt: "", remarks: "", returnedAt: "",
};
```

c) Replace the field grid (from `<Field label="LP Serial No"…` through the `returnedAt` Field) with:

```tsx
        <Field label="Asset Type" htmlFor="assetType">
          <Select id="assetType" value={v.assetType} onChange={setStr("assetType")}>
            <option value="">Select type…</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Make / Model" htmlFor="makeModel">
          <Input id="makeModel" value={v.makeModel} onChange={setStr("makeModel")} />
        </Field>
        <Field label="Asset Tag No" htmlFor="assetTag">
          <Input id="assetTag" value={v.assetTag} onChange={setStr("assetTag")} />
        </Field>
        <Field label="Serial No" htmlFor="lpSerialNo">
          <Input id="lpSerialNo" value={v.lpSerialNo} onChange={setStr("lpSerialNo")} />
        </Field>
        <Field label="OEM Name" htmlFor="oemName">
          <Input id="oemName" value={v.oemName} onChange={setStr("oemName")} />
        </Field>
        <Field label="Condition" htmlFor="condition">
          <Select id="condition" value={v.condition} onChange={setStr("condition")}>
            <option value="">Select condition…</option>
            {ASSET_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Purchase Value (₹)" htmlFor="purchaseValue">
          <Input id="purchaseValue" inputMode="numeric" value={v.purchaseValue} onChange={setStr("purchaseValue")} />
        </Field>
        <Field label="Purchase Date" htmlFor="purchaseDate">
          <Input id="purchaseDate" type="date" value={v.purchaseDate} onChange={setStr("purchaseDate")} />
        </Field>
        <Field label="Allocated On" htmlFor="allocatedAt" hint="leave blank for today">
          <Input id="allocatedAt" type="date" value={v.allocatedAt} onChange={setStr("allocatedAt")} />
        </Field>

        {assetId && (
          <Field label="Returned On" htmlFor="returnedAt" hint="leave blank if still allocated">
            <Input id="returnedAt" type="date" value={v.returnedAt ?? ""} onChange={setStr("returnedAt")} />
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field label="Remarks" htmlFor="remarks">
            <Input id="remarks" value={v.remarks} onChange={setStr("remarks")} />
          </Field>
        </div>
```

(The "LP Category" input is gone; the checkbox fieldset legend becomes `Accessories issued`.)

- [ ] **Step 2: POST route** (`src/app/api/hr/assets/route.ts`) — extend the create data:

```ts
      data: {
        employeeId: d.employeeId,
        hasLaptop: !!d.hasLaptop, laptopBag: !!d.laptopBag, mouse: !!d.mouse,
        charger: !!d.charger, idCard: !!d.idCard,
        assetType: d.assetType || null, lpSerialNo: d.lpSerialNo || null,
        makeModel: d.makeModel || null, lpCategory: d.lpCategory || null,
        oemName: d.oemName || null, assetTag: d.assetTag || null,
        condition: d.condition || null,
        purchaseValue: d.purchaseValue ?? null,
        purchaseDate: toDate(d.purchaseDate),
        // undefined → let the column default (now()) apply
        allocatedAt: toDate(d.allocatedAt) ?? undefined,
        remarks: d.remarks || null,
      },
```

Add the `toDate` helper at the top of the file (copy from `assets/[id]/route.ts`):

```ts
function toDate(s?: string) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}
```

- [ ] **Step 3: PATCH route** (`src/app/api/hr/assets/[id]/route.ts`) — extend the update data with the same new lines, EXCEPT `allocatedAt` must not be nulled on blank (column is non-nullable):

```ts
        assetType: d.assetType || null, assetTag: d.assetTag || null,
        condition: d.condition || null,
        purchaseValue: d.purchaseValue ?? null,
        purchaseDate: toDate(d.purchaseDate),
        allocatedAt: toDate(d.allocatedAt) ?? undefined,
        remarks: d.remarks || null,
```

- [ ] **Step 4: Assets page** (`src/app/(erp)/hr/assets/page.tsx`)

a) Search OR gains tag + type:

```ts
    assetWhere.OR = [
      { lpSerialNo: { contains: q, mode: "insensitive" } },
      { assetTag: { contains: q, mode: "insensitive" } },
      { assetType: { contains: q, mode: "insensitive" } },
      { makeModel: { contains: q, mode: "insensitive" } },
      { oemName: { contains: q, mode: "insensitive" } },
      { employee: { name: { contains: q, mode: "insensitive" } } },
    ];
```

b) Replace the `items` and `serial` columns with:

```ts
    {
      key: "asset",
      header: "Asset",
      cardLabel: "Asset",
      cell: (a) => {
        const type = a.assetType || (a.hasLaptop ? "Laptop" : a.idCard ? "ID Card" : "Asset");
        return (
          <span className="block min-w-0">
            <span className="block truncate text-sm font-medium text-slate-700">{type}</span>
            {a.makeModel && <span className="block truncate text-xs text-slate-500">{a.makeModel}</span>}
          </span>
        );
      },
    },
    {
      key: "tagSerial",
      header: "Tag / Serial",
      priority: "lg",
      cardLabel: "Tag / Serial",
      cell: (a) => (
        <span className="block min-w-0">
          <span className="nums block truncate font-mono text-xs text-slate-600">{a.assetTag || "—"}</span>
          {a.lpSerialNo && <span className="nums block truncate font-mono text-xs text-slate-400">{a.lpSerialNo}</span>}
        </span>
      ),
    },
    {
      key: "condition",
      header: "Condition",
      priority: "lg",
      cardLabel: "Condition",
      cell: (a) => a.condition ?? "—",
    },
```

c) After the `allocated` column add:

```ts
    {
      key: "value",
      header: "Value",
      priority: "xl",
      align: "right",
      cardLabel: "Value",
      cell: (a) => <span className="nums">{a.purchaseValue != null ? fmtINR(a.purchaseValue) : "—"}</span>,
    },
```

with `import { fmtINR } from "@/lib/format";` merged into the existing format import (`import { fmtDateOnly, fmtINR } from "@/lib/format";`).

d) Extend the `AssetRowActions` asset prop object (inside the actions column) with the new fields:

```ts
            asset={{
              id: a.id,
              employeeId: a.employee.id,
              hasLaptop: a.hasLaptop,
              laptopBag: a.laptopBag,
              mouse: a.mouse,
              charger: a.charger,
              idCard: a.idCard,
              assetType: a.assetType ?? "",
              lpSerialNo: a.lpSerialNo ?? "",
              makeModel: a.makeModel ?? "",
              lpCategory: a.lpCategory ?? "",
              oemName: a.oemName ?? "",
              assetTag: a.assetTag ?? "",
              condition: a.condition ?? "",
              purchaseValue: a.purchaseValue != null ? String(a.purchaseValue) : "",
              purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
              allocatedAt: a.allocatedAt.toISOString().slice(0, 10),
              remarks: a.remarks ?? "",
              returnedAt: a.returnedAt ? a.returnedAt.toISOString().slice(0, 10) : "",
            }}
```

- [ ] **Step 5: Hub asset views**

a) `(hub)/assets/page.tsx` — title + KeyValue:

```tsx
              <DetailSection key={a.id} title={[a.assetType || (a.hasLaptop ? "Laptop" : "Asset"), a.makeModel].filter(Boolean).join(" — ")}>
```

and extend the `KeyValue` items:

```ts
                    items={[
                      { label: "Asset Tag", value: a.assetTag, mono: true },
                      { label: "Serial No", value: a.lpSerialNo, mono: true },
                      { label: "Make / Model", value: a.makeModel },
                      { label: "OEM", value: a.oemName },
                      { label: "Condition", value: a.condition },
                      { label: "Purchase Value", value: a.purchaseValue != null ? fmtINR(a.purchaseValue) : null },
                      { label: "Purchase Date", value: fmtDateOnly(a.purchaseDate) },
                      { label: "Allocated", value: fmtDateOnly(a.allocatedAt) },
                      { label: "Returned", value: fmtDateOnly(a.returnedAt) },
                      { label: "Remarks", value: a.remarks },
                    ]}
```

(import `fmtINR` alongside `fmtDateOnly`; the legacy "Category" row is dropped.)

b) `(hub)/page.tsx` Overview asset snippet — replace the title expression:

```tsx
                  <p className="font-medium text-slate-700">
                    {[a.assetType || (a.hasLaptop ? "Laptop" : "Asset"), a.makeModel].filter(Boolean).join(" — ")}
                  </p>
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit` + `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/components/hr/AssetForm.tsx src/app/api/hr/assets "src/app/(erp)/hr/assets/page.tsx" "src/app/(erp)/hr/employees/[id]/(hub)/assets/page.tsx" "src/app/(erp)/hr/employees/[id]/(hub)/page.tsx"
git commit -m "feat(hr): generalized asset register — type/tag/condition/value/dates/remarks across form, APIs, table, hub"
```

---

### Task 10: Manpower dashboard rework + nav stub removal

**Files:**
- Rewrite: `src/app/(erp)/hr/page.tsx`
- Rewrite: `src/components/hr/DashboardComposition.tsx`
- Delete: `src/components/hr/CompositionBoard.tsx` (only consumer is the rewritten file)
- Modify: `src/lib/nav.tsx` (remove `HR_MANPOWER`)

**Interfaces:**
- Consumes: `buildQuery` (`@/lib/hr-filters`), `StatCard` (`size="sm"`, `href`), `BarList` (`@/components/Charts`, items `{label,value,href}`), `EntityLink`, `Employee.department`.
- Produces: `ManpowerKpis({ todayUTC: Date })`, `DashboardDepartments()`, `DashboardProjects({ today: Date })` (kept), `DashboardNotDeployed({ today: Date })` — all async server components exported from `DashboardComposition.tsx`.

- [ ] **Step 1: Rewrite `src/app/(erp)/hr/page.tsx`** (full file):

```tsx
import { Suspense } from "react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { PageHeader, Skeleton } from "@/components/ui";
import {
  ManpowerKpis,
  DashboardDepartments,
  DashboardProjects,
  DashboardNotDeployed,
} from "@/components/hr/DashboardComposition";

export const dynamic = "force-dynamic";

// Compact single-screen manpower dashboard (client requirement): today's
// headcount KPIs by category, then department-wise / project-wise / not-yet-
// deployed boxes. Each cell streams via its own Suspense boundary.
export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return (
    <>
      <PageHeader
        title="HR Dashboard"
        subtitle="Today's manpower — by category, department and project."
      />
      <div className="space-y-4 p-4 sm:p-6">
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-2xl" />}>
          <ManpowerKpis todayUTC={todayUTC} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardDepartments />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardProjects today={todayUTC} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardNotDeployed today={todayUTC} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `src/components/hr/DashboardComposition.tsx`**

Keep the existing `DashboardProjects` export byte-for-byte EXCEPT the summary label `"Unused (bench)"` becomes `"Not deployed"`. Delete `DashboardHeadcount` and `DashboardWorkforceComposition` (and the `CompositionBoard`/`ProgressBar`/`StatusChip`-only-if-unused imports — `StatusChip` and `fmtDateOnly` ARE still used by `DashboardProjects`; `ProgressBar` and `CompositionBoard` are not). Add these three new cells:

```tsx
import { CalendarCheck, Clock } from "lucide-react";
import { buildQuery } from "@/lib/hr-filters";
import { StatCard, EntityLink } from "@/components/ui";
import { BarList } from "@/components/Charts";

/* ── KPI strip: total + today's attendance + per-category headcount ───────── */
export async function ManpowerKpis({ todayUTC }: { todayUTC: Date }) {
  const [byCategory, attToday] = await Promise.all([
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
  ]);
  const total = byCategory.reduce((s, r) => s + r._count._all, 0);
  const cats = [...byCategory].sort((a, b) => b._count._all - a._count._all);
  const n = (s: string) => attToday.find((r) => r.status === s)?._count._all ?? 0;
  const presentToday = n("PRESENT");
  const onLeaveToday = n("LEAVE") + n("SICK");
  // Honesty rule: zero rows today → "—", never an alarming 0.
  const todayHasRows = attToday.reduce((s, r) => s + r._count._all, 0) > 0;
  const y = todayUTC.getUTCFullYear();
  const m = todayUTC.getUTCMonth() + 1;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard size="sm" label="Total manpower" value={total} tone="brand" icon={<Users className="h-4 w-4" />} href="/hr/employees?status=ACTIVE" />
      <StatCard size="sm" label="Present today" value={todayHasRows ? presentToday : "—"} tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} href={`/hr/attendance?year=${y}&month=${m}`} />
      <StatCard size="sm" label="On leave today" value={todayHasRows ? onLeaveToday : "—"} tone="amber" icon={<Clock className="h-4 w-4" />} href={`/hr/attendance?year=${y}&month=${m}`} />
      {cats.map((c) => (
        <StatCard
          key={c.empCategory ?? "uncategorised"}
          size="sm"
          label={c.empCategory ?? "Uncategorised"}
          value={c._count._all}
          tone="slate"
          href={c.empCategory ? buildQuery("/hr/employees", { status: "ACTIVE", category: c.empCategory }) : undefined}
        />
      ))}
    </div>
  );
}

/* ── Manpower by department ────────────────────────────────────────────────── */
export async function DashboardDepartments() {
  const byDept = await prisma.employee.groupBy({
    by: ["department"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  const items = [...byDept]
    .sort((a, b) => b._count._all - a._count._all)
    .map((d) => ({
      label: d.department ?? "Unassigned",
      value: d._count._all,
      href: d.department
        ? buildQuery("/hr/employees", { status: "ACTIVE", department: d.department })
        : undefined,
    }));

  return (
    <Card className="h-full">
      <CardHeader
        title="By department"
        subtitle="Active headcount"
        action={
          <Link
            href="/hr/employees?status=ACTIVE"
            className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
          >
            Employees
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      <CardBody className="px-6 py-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No active employees"
            description="Department headcount appears once employees are on record."
          />
        ) : (
          <BarList items={items} />
        )}
      </CardBody>
    </Card>
  );
}

/* ── Not deployed to any project ───────────────────────────────────────────── */
// ACTIVE employees with no live assignment (start ≤ today, not ended) on an
// ACTIVE project — the actionable "who can be staffed" list.
export async function DashboardNotDeployed({ today }: { today: Date }) {
  const notDeployed = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      projectAssignments: {
        none: {
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          project: { status: "ACTIVE" },
        },
      },
    },
    select: { id: true, empId: true, name: true, designation: true, department: true },
    orderBy: { name: "asc" },
  });

  return (
    <Card className="h-full">
      <CardHeader
        title="Not deployed"
        subtitle={`${notDeployed.length} without a live project`}
      />
      <CardBody className="max-h-96 overflow-y-auto px-6 py-4">
        {notDeployed.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Everyone is deployed"
            description="Every active employee has a live project assignment."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notDeployed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <EntityLink href={`/hr/employees/${e.id}`} name={e.name} code={e.empId} />
                <span className="shrink-0 text-right text-xs text-slate-400">
                  {[e.designation, e.department].filter(Boolean).join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
```

Final import block for the rewritten file (merge, keep only what's used):

```tsx
import Link from "next/link";
import { FolderKanban, Users, ChevronRight, Armchair, CalendarCheck, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody, EmptyState, StatusChip, StatCard, EntityLink, cn } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";
import { buildQuery } from "@/lib/hr-filters";
import { BarList } from "@/components/Charts";
```

- [ ] **Step 3: Delete the orphaned board** — `git rm src/components/hr/CompositionBoard.tsx` (verify first: `grep -r "CompositionBoard" src/` returns only comment mentions in `Charts.tsx`; update or leave those comments — they're prose, not imports).

- [ ] **Step 4: Nav stub** — in `src/lib/nav.tsx` delete line 73 (`const HR_MANPOWER: NavItem = { label: "Manpower Planning", icon: UserRound, soon: true };`) and remove `HR_MANPOWER` from every `items:` array it appears in (grep `HR_MANPOWER`); remove the now-unused `UserRound` lucide import if nothing else uses it.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` + `npm run lint`. If a dev server is available: `/hr` shows KPI strip + three boxes on one screen, department rows deep-link to `/hr/employees?status=ACTIVE&department=…`, sidebar no longer shows "Manpower Planning".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(erp)/hr/page.tsx" src/components/hr/DashboardComposition.tsx src/lib/nav.tsx
git rm src/components/hr/CompositionBoard.tsx
git commit -m "feat(hr): compact manpower dashboard — category KPIs, department/project boxes, not-deployed list"
```

---

### Task 11: Demo seed + full verification gate

**Files:**
- Modify: `prisma/seed-demo.ts`

**Interfaces:** none (dev-only seed).

- [ ] **Step 1: Departments in the demo roster**

Add `department: string;` to the `Emp` type and to each row + create call:

```ts
type Emp = {
  empId: string; name: string; designation: string; empCategory: string; department: string;
  location: string; mailId: string; doj: string; gross: number; left?: string;
};
```

Row values (append `department: "…"` to each): Asha Rao → `"Projects"`, Rahul Verma → `"Engineering & Design"`, Priya Singh → `"Projects"`, Vikram Patel → `"Operations & Maintenance"`, Neha Gupta → `"Finance & Accounts"`, Arjun Reddy → `"Operations & Maintenance"`.

In the `prisma.employee.upsert` create block, after `empCategory: e.empCategory,` add `department: e.department,`.

- [ ] **Step 2: Typed demo assets** — in the asset creation loop's `data`, add `assetType: "Laptop", condition: "Good",`.

- [ ] **Step 3: Full gate**

Ensure no dev server is running, then:
Run: `npm run lint` → passes.
Run: `npm run build` → completes with no type errors (if the build fails referencing deleted routes/components, `rm -rf .next` and rebuild — known stale-cache issue).

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-demo.ts
git commit -m "chore(hr): demo seed gains departments and typed assets"
```

- [ ] **Step 5: Manual verification pass** (dev server + seeded DB, per the spec's Verification section)

1. Add an employee: no I-Card, no leave-quota, no pay fields; Department dropdown + Other works; Bank & statutory section saves.
2. Profile Overview shows Department row + Bank & statutory section; no I-Card; hub header has no CL/SL chips; Attendance tab has no Leave Balances card.
3. `/hr` fits one screen: KPI strip (total/present/leave/category boxes), By department (deep-links), Project details, Not deployed list.
4. `/hr/attendance`: one compact header card; painting/save/day-fill work; XLSX has EMP ID and Employee Name in separate columns.
5. `/hr/payroll/[id]`: enter CTC ≠ 12×gross → amber delta hint; list shows "breakup ≠ CTC" chip.
6. Employees XLSX: Department + Payroll Type + Monthly Gross + Annualised Gross columns, no I-Card.
7. Assets: add/edit with type/tag/condition/value/dates/remarks; legacy rows show backfilled type.
