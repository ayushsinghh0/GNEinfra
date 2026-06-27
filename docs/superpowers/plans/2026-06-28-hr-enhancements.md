# HR Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-project allocation, leave/sick balances, a premium print-to-PDF salary slip, a comprehensive employee page, and richer analytics to the existing HR module.

**Architecture:** Additive Prisma (a `SICK` enum value, Employee quota/bank/PAN/UAN columns, `Project` + `ProjectAssignment`). New `/hr/projects` surface; the employee detail page becomes the one comprehensive view; the payslip print page is redesigned. Pure helpers `amountInWords` (Indian words) and `leaveBalances` (computed). Same RBAC: HR manages, manager read-only (UI + API), money is integer rupees.

**Tech Stack:** Next.js 16 (App Router, async params, `force-dynamic`), React 19, Prisma 6, Zod, Tailwind v4 "Soft Wave" (`ui.tsx`/`chrome.tsx`/`Charts.tsx`), `tsx` for dev checks. No new runtime dependencies.

## Global Constraints

- **Next.js 16:** async `cookies()`; route params `{ params }: { params: Promise<{ id: string }> }` then `await params`; data pages `export const dynamic = "force-dynamic"`.
- **No test runner.** Gate = `npm run build` + `npm run lint`, plus `npx tsx` checks for pure helpers. `rm -rf .next` on stale-cache errors. DB apply + browser/curl DEFERRED to Neon deploy (Docker down locally).
- **Migrations additive, authored OFFLINE** via `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`. A NEW migration (don't re-touch the reviewed `hr_module` migration). `prisma generate` offline.
- **Security (don't regress):** every page/route self-guards with `getCurrentUser()` + `user.mustChangePassword` + role-set, `status: user ? 403 : 401`. GET/pages `HR_VIEW = [HR,MANAGER,ADMIN,SUPERADMIN]`; mutations `HR_WRITE = [HR,ADMIN,SUPERADMIN]` (MANAGER excluded). Manager read-only enforced in BOTH UI (`canWrite = HR_WRITE.includes(viewer.role)` gates controls) AND API. `P2002`→409, `P2025`→404.
- **Money = integer rupees** end-to-end; payslip totals already recomputed server-side (`computePayrollTotals`).
- **Leave balances:** flat annual quota per employee (`casualLeaveQuota`/`sickLeaveQuota`, default 12); taken = count of that calendar year's `LEAVE`/`SICK` attendance (UTC window `[Y-01-01, (Y+1)-01-01)`); remaining = `max(0, quota − taken)`. No carry-forward.
- **Active assignment** = `ProjectAssignment.endDate` is null OR `≥ today` (UTC). "Bench" = ACTIVE employees with zero active assignments.
- **Paid days (slip):** `lopDays = absent + 0.5 × half`; `paidDays = daysInMonth − lopDays` (informational; earnings are NOT auto-prorated).
- **Design system:** compose `ui.tsx`/`chrome.tsx`/`Charts.tsx`; light mode; atmosphere only in chrome; `.nums` on money/dates; the salary slip + grid are plain/print-clean; no chart/PDF libraries.
- **Spec:** `docs/superpowers/specs/2026-06-28-hr-enhancements-design.md`.

---

## File Structure

**New files**
- `src/lib/number-to-words.ts` — `amountInWords(rupees)`.
- `src/lib/hr-leave.ts` — `leaveBalances(...)`, `attendanceYearSummary(...)`.
- `src/components/hr/ProjectForm.tsx`, `src/components/hr/AssignProjectForm.tsx`.
- `src/app/(erp)/hr/projects/page.tsx`, `src/app/(erp)/hr/projects/[id]/page.tsx`.
- `src/app/api/hr/projects/route.ts`, `.../projects/[id]/route.ts`, `.../assignments/route.ts`, `.../assignments/[id]/route.ts`.

**Modified** — `prisma/schema.prisma`; `src/lib/hr-validation.ts`; `src/lib/nav.tsx`; `src/components/hr/AttendanceGrid.tsx`; `src/components/hr/EmployeeForm.tsx`; `src/app/api/hr/employees/route.ts` + `.../[id]/route.ts`; `src/app/(erp)/hr/employees/[id]/page.tsx` + `.../[id]/edit/page.tsx`; `src/app/(print)/hr/payout/[id]/print/page.tsx`; `src/app/(erp)/hr/analytics/page.tsx`.

---

## Task 1: Data model — SICK, Employee fields, Project, ProjectAssignment

**Files:** Modify `prisma/schema.prisma`

**Interfaces — Produces:** `AttendanceStatus.SICK`; Employee columns `casualLeaveQuota Int @default(12)`, `sickLeaveQuota Int @default(12)`, `bankAccountNo String?`, `uan String?`, `panNo String?`, relation `projectAssignments`; enum `ProjectStatus { ACTIVE ON_HOLD COMPLETED }`; models `Project`, `ProjectAssignment`.

- [ ] **Step 1: Edit `prisma/schema.prisma`.**
  - In `enum AttendanceStatus { ... }`, add `SICK` (place it after `LEAVE`): the values become `PRESENT ABSENT LEAVE SICK HALF_DAY HOLIDAY WEEK_OFF` (one per line).
  - In `model Employee { ... }`, add these fields (near the salary-structure block) and the back-relation:
    ```prisma
    casualLeaveQuota Int     @default(12)
    sickLeaveQuota   Int     @default(12)
    bankAccountNo    String?
    uan              String?
    panNo            String?
    projectAssignments ProjectAssignment[]
    ```
  - Append the new enum + models:
    ```prisma
    enum ProjectStatus { ACTIVE ON_HOLD COMPLETED }

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
      allocationPct Int?
      startDate     DateTime
      endDate       DateTime?
      createdAt     DateTime  @default(now())
      @@unique([employeeId, projectId])
      @@index([employeeId])
      @@index([projectId])
    }
    ```

- [ ] **Step 2: Author the migration OFFLINE** (Docker down; new migration, do NOT touch `hr_module`):
  ```bash
  cd /d/GNE/ERP
  OLD=$(mktemp); git show HEAD:prisma/schema.prisma > "$OLD"
  TS=$(date +%Y%m%d%H%M%S)
  mkdir -p "prisma/migrations/${TS}_hr_enhancements"
  npx prisma migrate diff --from-schema-datamodel "$OLD" --to-schema-datamodel prisma/schema.prisma --script > "prisma/migrations/${TS}_hr_enhancements/migration.sql"
  rm -f "$OLD"
  ```
  Open `migration.sql` and confirm it is additive only: `ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK'`; `CREATE TYPE "ProjectStatus"`; `ALTER TABLE "Employee" ADD COLUMN` (the 5 columns; the two Int columns `NOT NULL DEFAULT 12`); `CREATE TABLE "Project"` + `"ProjectAssignment"` with their indexes + FKs (ProjectAssignment FKs `ON DELETE CASCADE`). No `DROP`, no changes to other tables. Strip any leading Prisma advisory text.
  > Deploy note (record in the report, not a build concern): `ALTER TYPE … ADD VALUE` is fine on Neon (PG 15/16) because the new value is not *used* within the same migration.

- [ ] **Step 3: Generate + verify.**
  ```bash
  npx prisma validate && npx prisma generate && npm run build && npm run lint
  ```

- [ ] **Step 4: Commit.**
  ```bash
  git add prisma/schema.prisma prisma/migrations
  git commit -m "feat(hr): SICK status, leave quotas, Project + ProjectAssignment models"
  ```

---

## Task 2: Validation, helpers, SICK grid, nav

**Files:** Modify `src/lib/hr-validation.ts`, `src/components/hr/AttendanceGrid.tsx`, `src/lib/nav.tsx`; Create `src/lib/number-to-words.ts`, `src/lib/hr-leave.ts`

**Interfaces — Produces:** `ATTENDANCE_STATUSES` incl. `"SICK"`; `PROJECT_STATUSES`; extended `employeeSchema`; `projectSchema`, `assignmentSchema`; `amountInWords(rupees: number): string`; `leaveBalances(employeeId, year, casualQuota, sickQuota)` and `attendanceYearSummary(employeeId, year)`.

- [ ] **Step 1: Extend `src/lib/hr-validation.ts`.**
  - Change `ATTENDANCE_STATUSES` to include SICK after LEAVE:
    ```ts
    export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LEAVE", "SICK", "HALF_DAY", "HOLIDAY", "WEEK_OFF"] as const;
    ```
  - Add a quota preprocessor + `PROJECT_STATUSES`, and extend `employeeSchema` with the new fields:
    ```ts
    export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;

    // Annual leave quota: "" / null / undefined → 12; else a non-negative integer.
    const quota = z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 12 : v),
      z.coerce.number().int("Whole days only").min(0).max(366)
    );
    ```
    Inside `employeeSchema`, add (after `conveyance: money,`):
    ```ts
      casualLeaveQuota: quota,
      sickLeaveQuota: quota,
      bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
      uan: z.string().trim().max(20).optional().or(z.literal("")),
      panNo: z.string().trim().max(10).optional().or(z.literal("")),
    ```
  - Append the two new schemas:
    ```ts
    export const projectSchema = z.object({
      name: z.string().trim().min(1, "Name is required").max(160),
      code: z.string().trim().min(1, "Code is required").max(40),
      client: z.string().trim().max(160).optional().or(z.literal("")),
      status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
      startDate: optDate,
      endDate: optDate,
    });

    export const assignmentSchema = z.object({
      employeeId: z.string().min(1, "Employee is required"),
      projectId: z.string().min(1, "Project is required"),
      roleOnProject: z.string().trim().max(120).optional().or(z.literal("")),
      allocationPct: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : v),
        z.coerce.number().int().min(0).max(100).optional()
      ),
      startDate: z.string().min(1, "Start date is required"),
      endDate: optDate,
    });
    ```
    (`optDate` already exists in this file.)

- [ ] **Step 2: Add SICK to `src/components/hr/AttendanceGrid.tsx`.**
  - In `CODE`, add `SICK: "S",`; in `COLOR`, add `SICK: "bg-orange-100 text-orange-700",`. (Both are `Record<AttendanceStatusValue, string>`, so the build REQUIRES the SICK key once the enum has SICK.)
  - Update the help text string `Click a cell to cycle: P → A → L → ½ → H → W → blank.` to `Click a cell to cycle: P → A → L → S → ½ → H → W → blank.`

- [ ] **Step 3: Add the "Projects" nav item in `src/lib/nav.tsx`.** In the `HR` `NavSection`, insert after the "Attendance" item:
    ```ts
    { label: "Projects", href: "/hr/projects", icon: FolderKanban },
    ```
  Add `FolderKanban` to the `lucide-react` import at the top. If `npm run build` reports `FolderKanban` is not exported by the installed lucide version, use `HardHat` instead (already imported) and drop the `FolderKanban` import.

- [ ] **Step 4: Create `src/lib/number-to-words.ts`.**
  ```ts
  const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ONES[n];
    const t = Math.floor(n / 10), o = n % 10;
    return TENS[t] + (o ? " " + ONES[o] : "");
  }
  function threeDigits(n: number): string {
    const h = Math.floor(n / 100), r = n % 100;
    const parts: string[] = [];
    if (h) parts.push(ONES[h] + " Hundred");
    if (r) parts.push(twoDigits(r));
    return parts.join(" ");
  }

  // Indian numbering (crore / lakh / thousand / hundred). e.g. 123456 →
  // "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only".
  export function amountInWords(rupees: number): string {
    if (!Number.isFinite(rupees) || rupees < 0) return "Rupees Zero Only";
    let n = Math.floor(rupees);
    if (n === 0) return "Rupees Zero Only";
    if (n > 9_999_999_999) return "Rupees (amount too large) Only";
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const hundred = n;
    const parts: string[] = [];
    if (crore) parts.push(threeDigits(crore) + " Crore");
    if (lakh) parts.push(twoDigits(lakh) + " Lakh");
    if (thousand) parts.push(twoDigits(thousand) + " Thousand");
    if (hundred) parts.push(threeDigits(hundred));
    return "Rupees " + parts.join(" ") + " Only";
  }
  ```

- [ ] **Step 5: Create `src/lib/hr-leave.ts`.**
  ```ts
  import { prisma } from "@/lib/prisma";
  import type { AttendanceStatus } from "@prisma/client";

  // Calendar-year leave balances for one employee. taken = that year's LEAVE/SICK days.
  export async function leaveBalances(
    employeeId: string, year: number, casualQuota: number, sickQuota: number
  ) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const [casualTaken, sickTaken] = await Promise.all([
      prisma.attendanceRecord.count({ where: { employeeId, status: "LEAVE", date: { gte: start, lt: end } } }),
      prisma.attendanceRecord.count({ where: { employeeId, status: "SICK", date: { gte: start, lt: end } } }),
    ]);
    return {
      casualQuota, casualTaken, casualRemaining: Math.max(0, casualQuota - casualTaken),
      sickQuota, sickTaken, sickRemaining: Math.max(0, sickQuota - sickTaken),
    };
  }

  // Count per status for one employee across a calendar year.
  export async function attendanceYearSummary(employeeId: string, year: number) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const groups = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { employeeId, date: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const summary: Record<AttendanceStatus, number> = {
      PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0, HALF_DAY: 0, HOLIDAY: 0, WEEK_OFF: 0,
    };
    for (const g of groups) summary[g.status] = g._count._all;
    return summary;
  }
  ```

- [ ] **Step 6: Verify + commit.**
  ```bash
  npx tsx -e "import('./src/lib/number-to-words.ts').then(m => { console.log(m.amountInWords(123456)); console.log(m.amountInWords(0)); console.log(m.amountInWords(10000000)); })"
  # Expect: "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only" / "Rupees Zero Only" / "Rupees One Crore Only"
  npm run build && npm run lint
  git add src/lib/hr-validation.ts src/components/hr/AttendanceGrid.tsx src/lib/nav.tsx src/lib/number-to-words.ts src/lib/hr-leave.ts
  git commit -m "feat(hr): SICK + project/assignment schemas, leave + amount-in-words helpers, nav"
  ```

---

## Task 3: Employee new fields — form + routes

**Files:** Modify `src/components/hr/EmployeeForm.tsx`, `src/app/api/hr/employees/route.ts`, `src/app/api/hr/employees/[id]/route.ts`, `src/app/(erp)/hr/employees/[id]/edit/page.tsx`

**Interfaces — Consumes:** the extended `employeeSchema`.

- [ ] **Step 1: `EmployeeForm.tsx`** — add the five new fields. In the `EMPTY` object add: `casualLeaveQuota: "12", sickLeaveQuota: "12", bankAccountNo: "", uan: "", panNo: ""`. In the field grid add (using the existing `Txt` helper): `{Txt("casualLeaveQuota", "Casual Leave Quota", false, "number")}`, `{Txt("sickLeaveQuota", "Sick Leave Quota", false, "number")}`, `{Txt("bankAccountNo", "Bank A/C No")}`, `{Txt("panNo", "PAN No")}`, `{Txt("uan", "UAN (PF)")}`.

- [ ] **Step 2: Map the new fields in the employee POST and PATCH routes.** In BOTH `src/app/api/hr/employees/route.ts` (create `data`) and `src/app/api/hr/employees/[id]/route.ts` (update `data`), add to the `prisma.employee.create/update` data object:
  ```ts
        casualLeaveQuota: d.casualLeaveQuota,
        sickLeaveQuota: d.sickLeaveQuota,
        bankAccountNo: d.bankAccountNo || null,
        uan: d.uan || null,
        panNo: d.panNo || null,
  ```
  (`d.casualLeaveQuota`/`d.sickLeaveQuota` are already numbers via the `quota` preprocessor — they default to 12.)

- [ ] **Step 3: Edit page initial values.** In `src/app/(erp)/hr/employees/[id]/edit/page.tsx`, add to the `initial` object passed to `<EmployeeForm>`: `casualLeaveQuota: String(emp.casualLeaveQuota), sickLeaveQuota: String(emp.sickLeaveQuota), bankAccountNo: emp.bankAccountNo ?? "", uan: emp.uan ?? "", panNo: emp.panNo ?? ""`. (Read the file first to match its existing `toMoneyStr`/`?? ""` conventions.)

- [ ] **Step 4: Verify + commit.**
  ```bash
  npm run build && npm run lint
  git add src/components/hr/EmployeeForm.tsx src/app/api/hr/employees "src/app/(erp)/hr/employees/[id]/edit"
  git commit -m "feat(hr): employee leave-quota + bank/PAN/UAN fields"
  ```

---

## Task 4: Projects surface — API + list/add-edit + detail

**Files:** Create `src/app/api/hr/projects/route.ts`, `src/app/api/hr/projects/[id]/route.ts`, `src/components/hr/ProjectForm.tsx`, `src/app/(erp)/hr/projects/page.tsx`, `src/app/(erp)/hr/projects/[id]/page.tsx`

**Interfaces — Consumes:** `projectSchema`, `PROJECT_STATUSES`, `HR_VIEW`/`HR_WRITE`. **Produces:** `GET/POST /api/hr/projects`, `PATCH/DELETE /api/hr/projects/[id]`.

- [ ] **Step 1: `src/app/api/hr/projects/route.ts`.**
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { Prisma } from "@prisma/client";
  import { prisma } from "@/lib/prisma";
  import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
  import { projectSchema } from "@/lib/hr-validation";

  function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

  export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
    }
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { assignments: true } } },
    });
    return NextResponse.json({ projects });
  }

  export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
    }
    const parsed = projectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;
    try {
      const project = await prisma.project.create({
        data: {
          name: d.name, code: d.code, client: d.client || null, status: d.status,
          startDate: toDate(d.startDate), endDate: toDate(d.endDate),
        },
      });
      return NextResponse.json({ ok: true, project });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "A project with that code already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not create the project." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: `src/app/api/hr/projects/[id]/route.ts`** — `PATCH` (reuse `projectSchema`, same field mapping, P2002→409, P2025→404) and `DELETE` (P2025→404), both `HR_WRITE`-guarded. Mirror the employees `[id]` route's guard + error shape exactly (the file with the `P2025`→404 / `catch (e)` pattern). PATCH `data`: `{ name, code, client: d.client||null, status: d.status, startDate: toDate(d.startDate), endDate: toDate(d.endDate) }`.

- [ ] **Step 3: `src/components/hr/ProjectForm.tsx`** (client; create + edit) — fields: Name (req), Code (req), Client, Status (`Select` over `PROJECT_STATUSES`), Start date, End date. POSTs to `/api/hr/projects` (create) or PATCHes `/api/hr/projects/${id}` (edit); on success `router.push("/hr/projects")` + `router.refresh()`. Mirror the structure of `src/components/hr/EmployeeForm.tsx` (the `Values`/`set`/`submit` pattern + error banner).

- [ ] **Step 4: `src/app/(erp)/hr/projects/page.tsx`** — `const viewer = await requirePageRole(HR_VIEW)`; `canWrite = HR_WRITE.includes(viewer.role)`; `force-dynamic`. Load `prisma.project.findMany({ orderBy:{createdAt:"desc"}, include:{ _count:{ select:{ assignments:true } } } })`. Render `PageHeader title="Projects"` (with an "Add project" link to `/hr/projects/new` shown only when `canWrite`) + a table (Code `.nums` · Name (link → `/hr/projects/[id]`) · Client · Status `Chip` · Assigned `_count.assignments` · Start `fmtDateOnly`). `EmptyState` when none. Also create `src/app/(erp)/hr/projects/new/page.tsx` (`requirePageRole(HR_WRITE)` + `<ProjectForm />`) and `.../[id]/edit/page.tsx` (`requirePageRole(HR_WRITE)`, load project, `<ProjectForm id initial={...}>` with dates → `YYYY-MM-DD`). Mirror the employees list/new/edit pages.

- [ ] **Step 5: `src/app/(erp)/hr/projects/[id]/page.tsx`** — `const viewer = await requirePageRole(HR_VIEW)`; `canWrite`. Load the project + `assignments: { include: { employee: { select: { id:true, empId:true, name:true } } } }`. Show project details + an "Edit" link (canWrite) + a table of assigned employees (empId · name (link → `/hr/employees/[id]`) · role · allocation% · start/end). `notFound()` if missing.

- [ ] **Step 6: Verify + commit.**
  ```bash
  npm run build && npm run lint
  git add src/app/api/hr/projects "src/app/(erp)/hr/projects" src/components/hr/ProjectForm.tsx
  git commit -m "feat(hr): project master — list, add/edit, detail + API"
  ```

---

## Task 5: Assignments API + comprehensive employee page

**Files:** Create `src/app/api/hr/assignments/route.ts`, `src/app/api/hr/assignments/[id]/route.ts`, `src/components/hr/AssignProjectForm.tsx`; Modify `src/app/(erp)/hr/employees/[id]/page.tsx`

**Interfaces — Consumes:** `assignmentSchema`, `leaveBalances`, `attendanceYearSummary`, `HR_VIEW`/`HR_WRITE`. **Produces:** `POST /api/hr/assignments`, `DELETE /api/hr/assignments/[id]`.

- [ ] **Step 1: `src/app/api/hr/assignments/route.ts`** — `POST` (`HR_WRITE`): validate `assignmentSchema`; build `startDate`/`endDate` via `toDate`; create. `@@unique([employeeId, projectId])` → on `P2002` return 409 "Already assigned to this project." Full handler:
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { Prisma } from "@prisma/client";
  import { prisma } from "@/lib/prisma";
  import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
  import { assignmentSchema } from "@/lib/hr-validation";

  function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

  export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
    }
    const parsed = assignmentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;
    try {
      const assignment = await prisma.projectAssignment.create({
        data: {
          employeeId: d.employeeId, projectId: d.projectId,
          roleOnProject: d.roleOnProject || null, allocationPct: d.allocationPct ?? null,
          startDate: toDate(d.startDate)!, endDate: toDate(d.endDate),
        },
      });
      return NextResponse.json({ ok: true, assignment });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "This employee is already assigned to that project." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not create the assignment." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: `src/app/api/hr/assignments/[id]/route.ts`** — `DELETE` (`HR_WRITE`, `await params`, P2025→404). Mirror the employees `[id]` DELETE guard + error shape.

- [ ] **Step 3: `src/components/hr/AssignProjectForm.tsx`** (client) — props `{ employeeId: string; projects: { id: string; name: string; code: string }[] }`. Fields: Project `Select` (from `projects`), Role, Allocation % (`number`), Start date (`date`, required), End date (`date`). POSTs `{ employeeId, projectId, roleOnProject, allocationPct, startDate, endDate }` to `/api/hr/assignments`; on success `router.refresh()`. Compact inline form; error banner like `EmployeeForm`.

- [ ] **Step 4: Overhaul `src/app/(erp)/hr/employees/[id]/page.tsx`.** Read the current file first (it already loads `assets`, `payrolls take:3`, `attendance take:10`). Change the query to ALSO load `projectAssignments: { include: { project: true }, orderBy: { startDate: "desc" } }`, change `payrolls` to ALL (drop `take: 3`, keep ordering), and (for the assign form) load `const projects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id:true, name:true, code:true }, orderBy: { name:"asc" } })`. Compute `const year = new Date().getUTCFullYear()` then `const balances = await leaveBalances(emp.id, year, emp.casualLeaveQuota, emp.sickLeaveQuota)` and `const summary = await attendanceYearSummary(emp.id, year)` (import both from `@/lib/hr-leave`). Then add these sections (keep the existing Details/Compensation/Assets cards):
  - **Projects** card: list `emp.projectAssignments` (project name · code · role · `allocationPct`% · start–end via `fmtDateOnly`, "Ongoing" when no end); a remove control per row (a tiny client button calling `DELETE /api/hr/assignments/[id]` then refresh) shown only when `canWrite`; and `{canWrite && <AssignProjectForm employeeId={emp.id} projects={projects} />}`.
  - **Attendance summary & leave balances** card: the `summary` counts (Present/Absent/Leave/Sick/Half-day/Holiday/Week-off) as small stat chips, plus a balances block — Casual: `casualTaken`/`casualQuota` (remaining `casualRemaining`); Sick likewise. Also add bank/PAN/UAN rows to the Details card (`emp.bankAccountNo`, `emp.panNo`, `emp.uan`).
  - **Payslips**: rename "Recent Payslips" → "Payslips", iterate ALL `emp.payrolls`, and make each row link to its slip: wrap in `<Link href={`/hr/payout/${p.id}/print`}>` (or add a "Slip" link).
  Keep the existing guard (`requirePageRole(HR_VIEW)` + `canWrite`).

- [ ] **Step 5: Verify + commit.**
  ```bash
  npm run build && npm run lint
  git add src/app/api/hr/assignments src/components/hr/AssignProjectForm.tsx "src/app/(erp)/hr/employees/[id]/page.tsx"
  git commit -m "feat(hr): project assignments + comprehensive employee page"
  ```

---

## Task 6: Premium salary slip redesign

**Files:** Modify `src/app/(print)/hr/payout/[id]/print/page.tsx`

**Interfaces — Consumes:** `amountInWords`, `fmtINR`, `fmtDateOnly`, `MONTHS`, `prisma`.

- [ ] **Step 1: Rewrite the payslip page.** Keep the standalone guard (`getCurrentUser` + `mustChangePassword` + `HR_VIEW` + `notFound`) and `PrintBar backHref="/hr/payout"`. Load the record `include: { employee: true }`. Additionally compute **paid days** from that month's attendance:
  ```ts
  const monthStart = new Date(Date.UTC(record.periodYear, record.periodMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(record.periodYear, record.periodMonth, 1));
  const daysInMonth = new Date(Date.UTC(record.periodYear, record.periodMonth, 0)).getUTCDate();
  const att = await prisma.attendanceRecord.groupBy({
    by: ["status"], where: { employeeId: record.employeeId, date: { gte: monthStart, lt: monthEnd } }, _count: { _all: true },
  });
  const cnt = (s: string) => att.find((a) => a.status === s)?._count._all ?? 0;
  const lopDays = cnt("ABSENT") + 0.5 * cnt("HALF_DAY");
  const paidDays = daysInMonth - lopDays;
  ```
  Render a premium A4 slip:
  - **Letterhead** with the real logo: `import Image from "next/image"` and `<Image src="/brand/gne-infra.png" alt="GNE Infra" width={120} height={34} className="h-9 w-auto" />`, "Salary Slip" title, "Human Resources · Payroll".
  - **Employee block** (two columns): Name, EMP ID, Designation, Date of Joining (`fmtDateOnly`); and — **only when present** — Bank A/C (`emp.bankAccountNo`), PAN (`emp.panNo`), UAN (`emp.uan`). Period "Salary Slip — {MONTHS[m-1]} {year}".
  - **Days row:** Days in Month / Paid Days / LOP Days (`.nums`).
  - **Earnings** and **Deductions** as two side-by-side tables (the 7 earnings → Total Earnings; the 4 deductions → Total Ded) using `fmtINR`.
  - **Net Pay** banner = `fmtINR(record.payableAmount)`, with `amountInWords(record.payableAmount)` beneath it.
  - Remarks (if any); a "This is a system-generated salary slip and does not require a signature." note + footer.
  - Add print CSS: wrap the page so it prints A4-clean (`print:px-0 print:py-0`, `break-inside-avoid` on the cards) — extend the existing print classes already in the file.

- [ ] **Step 2: Verify + commit.**
  ```bash
  npm run build && npm run lint
  git add "src/app/(print)/hr/payout/[id]/print/page.tsx"
  git commit -m "feat(hr): premium salary slip — letterhead, paid days, amount in words"
  ```

---

## Task 7: Analytics — project allocation + leave summary

**Files:** Modify `src/app/(erp)/hr/analytics/page.tsx`

**Interfaces — Consumes:** `prisma`, existing analytics structure, `fmtINR`.

- [ ] **Step 1: Add two sections to the analytics page.** Read the current file first (it already guards `HR_VIEW` + `force-dynamic`, computes headcount/attendance/payroll/assets, and renders `StatCard`s + `AreaChart` + brand bar lists). Add:
  - **Project allocation:** `const today = new Date(); const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));` then count active assignments per project:
    ```ts
    const projects = await prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, _count: { select: { assignments: { where: { OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] } } } } },
      orderBy: { name: "asc" },
    });
    const assignedEmployeeIds = await prisma.projectAssignment.findMany({
      where: { OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] }, select: { employeeId: true }, distinct: ["employeeId"],
    });
    const benchCount = activeCount - assignedEmployeeIds.length; // activeCount already computed on the page
    ```
    Render a "Project allocation" card: a `StatCard` for "On the bench" (`benchCount`) + a brand bar list of headcount per project (`p._count.assignments`), reusing the existing bar-list markup pattern on the page.
  - **Leave summary:** count this month's and this year's LEAVE + SICK:
    ```ts
    const yStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const mStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const [leaveYear, sickYear, leaveMonth, sickMonth] = await Promise.all([
      prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart } } }),
      prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart } } }),
      prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: mStart } } }),
      prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: mStart } } }),
    ]);
    ```
    Render a "Leave summary" `StatCard` row: Leaves (this month) / Sick (this month) / Leaves (this year) / Sick (this year).
  Compose with the existing `StatCard` + bar-list primitives already imported on the page; do not add a chart library or the vendor-colored `Donut`.

- [ ] **Step 2: Verify + commit.**
  ```bash
  npm run build && npm run lint
  git add "src/app/(erp)/hr/analytics"
  git commit -m "feat(hr): analytics — project allocation + leave summary"
  ```

---

## Self-Review (completed during planning)

**Spec coverage** — §3 data model → T1; §4 leave balances → T2 (`hr-leave`) + consumed T5; §5 surfaces: Projects → T4, project assignment + comprehensive employee page → T5, attendance SICK → T2 (grid), salary slip → T6, analytics → T7; §6 paid-days → T6; §7 amount-in-words → T2 (`number-to-words`); §8 validation/nav/new-routes → T2 (schemas/nav) + T3/T4/T5 (routes); employee bank/PAN/UAN + quotas → T1 (schema) + T2 (validation) + T3 (form/routes) + shown T5/T6.

**Placeholder scan** — no "TBD/TODO". The mirror-an-existing-file steps (project list/new/edit pages, ProjectForm, AssignProjectForm, the employee-page section markup) name the exact pattern file, the exact fields/columns, and the exact guard; logic-bearing files (schemas, helpers, all API routes, salary-slip computation, analytics queries) have complete code.

**Type consistency** — `ATTENDANCE_STATUSES` (+SICK) feeds `AttendanceStatusValue`, which forces the `CODE`/`COLOR` `Record` keys in T2 (build-enforced); `amountInWords`, `leaveBalances`, `attendanceYearSummary`, `projectSchema`, `assignmentSchema`, `PROJECT_STATUSES`, `quota` are defined once (T1-T2) and consumed by name in T3-T7. Every API route uses the identical `getCurrentUser` + `mustChangePassword` + role-set + `status: user ? 403 : 401` guard and `P2002`→409 / `P2025`→404. Prisma composite-unique selector for assignments is `employeeId_projectId`.

**Known intermediate states** — the "Projects" nav link (T2) resolves once T4 lands; string hrefs don't break the build (same as prior rounds).
