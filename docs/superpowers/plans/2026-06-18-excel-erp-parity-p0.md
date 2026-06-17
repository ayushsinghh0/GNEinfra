# Excel→ERP Parity — P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Projects fully editable after creation, build the flagship editable Activity-DPR daily grid (with faithful number/`Com`/blank cells), make PO&MRC fully editable with its missing columns, and add workbook round-trip I/O (per-page export, full-project export, upload-to-autofill import) — covering the P0 sheets.

**Architecture:** Extend the existing Next.js 16 (App Router) + Prisma 6 + Postgres app. Establish three reusable patterns: per-row `PATCH`/`DELETE` routes at `…/<collection>/[itemId]`, a bulk grid upsert `PUT …/dpr/grid`, and an `exceljs`-based `src/lib/workbook.ts` round-trip layer. Mirror the just-shipped vendor inline-edit + `PATCH` precedent and the existing `*-excel.ts` import/export helpers.

**Tech Stack:** Next.js 16, React 19 client components, Prisma 6 / Postgres, Zod 3, `exceljs` (already a dependency), Tailwind v4, lucide-react.

## Global Constraints

- **NOT standard Next.js** — read the relevant guide under `node_modules/next/dist/docs/` before route/page work; route params are `Promise`-wrapped and must be `await`ed (see existing routes).
- **No unit-test runner.** Verification gate for every task = `npx tsc --noEmit` + `npm run lint` (both clean); run `npm run build` at module boundaries (tasks marked "build gate"). Plus the named manual check. Do **not** add a test framework.
- **Admin routes** call `await isAdminAuthed()` first → `401 { error: "Unauthorized" }`. **Ownership check:** any `…/[id]/…/[itemId]` route must verify the item's `projectId` equals the route `id`, else `404`.
- **Migrations** are additive + reversible via `npm run db:migrate -- --name <name>`; never hand-edit migration SQL. Dev Postgres is reachable (`DATABASE_URL` set).
- **DPR cells are faithful:** `DprKind { VALUE | COM | NONE }`; only `VALUE` contributes to cumulative/`%`. `COM` = completed marker (renders 100%), `NONE` = explicit no-work.
- **PO&MRC gate fields** (`mdcc`, `signoffBel`, `mahagenco`) are **short status text** (`String?`), not booleans.
- **Excel round-trip is structural parity**, not byte-identical: reproduce sheet names + header text + column order from the source layout; write computed/formula cells (Cumulative, %, etc.) as **values**. Import is keyed by **`gneId`** and upserts per project.
- **Commit hygiene:** plain conventional-commit messages; **NO** `Co-Authored-By` trailer, no mention of Claude/AI.
- Reuse existing helpers — `RecordForm` (supports `method:"PATCH"`), `toDate` (`src/lib/project-schemas.ts`), `activityPct` (`src/lib/projects.ts`), the `*-excel.ts` `cellText`/`cellNum` parsers — do not reinvent them.

---

## Module 1 — Project master full edit

### Task 1: Project schema + edit validation

**Files:**
- Modify: `prisma/schema.prisma` (the `Project` model, ~line 182)
- Modify: `src/lib/validation.ts` (`projectSchemaCreate`, ~line 126; add `projectEditSchema` after it)

**Interfaces:**
- Produces: `Project.district String?`; `projectSchemaCreate` gains `district`, `liveDate`, `completeDate`, `handoverDate` (all optional ISO-date strings); `projectEditSchema` (same shape) + `type ProjectEditInput`.

- [ ] **Step 1: Add `district` to `Project`**

In `prisma/schema.prisma`, in the `Project` model add after `state String?` (the existing line near the top of the model):
```prisma
  district      String? // PO & MRC "District" (e.g. "CH SN")
```

- [ ] **Step 2: Migrate**

Run: `npm run db:migrate -- --name project_district`
Expected: migration created + applied, "Your database is now in sync".

- [ ] **Step 3: Extend the create schema + add the edit schema**

In `src/lib/validation.ts`, inside `projectSchemaCreate` (after `startDate: optionalStr,`) add:
```ts
  district: optionalStr,
  liveDate: optionalStr,
  completeDate: optionalStr,
  handoverDate: optionalStr,
```
Then immediately after `export type ProjectCreateInput = z.infer<typeof projectSchemaCreate>;` add:
```ts
// Editing an existing project — same fields as create (gneId stays editable but
// @unique; a collision is surfaced as 409 by the route).
export const projectEditSchema = projectSchemaCreate;
export type ProjectEditInput = z.infer<typeof projectEditSchema>;
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations src/lib/validation.ts
git commit -m "feat: add Project.district + project edit schema and lifecycle dates"
```

### Task 2: Persist new Project fields on create + add PATCH route

**Files:**
- Modify: `src/app/api/projects/route.ts` (the `create` data block, ~line 33-54)
- Create: `src/app/api/projects/[id]/route.ts`

**Interfaces:**
- Consumes: `projectEditSchema` (Task 1).
- Produces: `PATCH /api/projects/[id]` → `{ ok: true, id }`; 409 on `gneId` collision (`P2002`), 404 on `P2025`.

- [ ] **Step 1: Persist the new fields on create**

In `src/app/api/projects/route.ts`, after the existing `let startDate …` block add a date helper for the three lifecycle dates and include the new fields in `prisma.project.create({ data: { … } })`:
```ts
  const toD = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };
```
Add to the `data` object (after `startDate,`):
```ts
        district: d.district,
        liveDate: toD(d.liveDate),
        completeDate: toD(d.completeDate),
        handoverDate: toD(d.handoverDate),
```

- [ ] **Step 2: Create the PATCH route**

Create `src/app/api/projects/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { projectEditSchema } from "@/lib/validation";

// PATCH /api/projects/<id>  (admin only) — edit any project field after creation.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = projectEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const toD = (s?: string) => {
    if (!s) return null;
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  };
  try {
    await prisma.project.update({
      where: { id },
      data: {
        gneId: d.gneId,
        clientName: d.clientName ?? null,
        tenderId: d.tenderId ?? null,
        state: d.state ?? null,
        district: d.district ?? null,
        cluster: d.cluster ?? null,
        plantName: d.plantName ?? null,
        capacityAcMw: d.capacityAcMw ?? null,
        capacityDcMw: d.capacityDcMw ?? null,
        epcScope: d.epcScope ?? null,
        poNumber: d.poNumber ?? null,
        poValueCr: d.poValueCr ?? null,
        subPartner: d.subPartner ?? null,
        vendorId: d.vendorId || null,
        plantAddress: d.plantAddress ?? null,
        clientAddress: d.clientAddress ?? null,
        stage: d.stage,
        startDate: toD(d.startDate),
        liveDate: toD(d.liveDate),
        completeDate: toD(d.completeDate),
        handoverDate: toD(d.handoverDate),
      },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002")
        return NextResponse.json({ error: "A project with that GNE ID already exists." }, { status: 409 });
      if (e.code === "P2025")
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not save the project." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add "src/app/api/projects/route.ts" "src/app/api/projects/[id]/route.ts"
git commit -m "feat: persist project lifecycle dates/district on create; PATCH project route"
```

### Task 3: ProjectForm edit mode + Edit page + new fields

**Files:**
- Modify: `src/components/ProjectForm.tsx`
- Create: `src/app/admin/projects/[id]/edit/page.tsx`
- Modify: `src/app/admin/projects/[id]/page.tsx` (detail header — add an **Edit** link)

**Interfaces:**
- Consumes: `PATCH /api/projects/[id]` (Task 2), `POST /api/projects` (existing).
- Produces: `ProjectForm` accepting optional `mode`, `initial`, `projectId` props (defaults preserve today's create behavior).

- [ ] **Step 1: Make ProjectForm reusable for edit**

In `src/components/ProjectForm.tsx`:
1. Extend the `EMPTY` constant with the four new keys: `district: ""`, `liveDate: ""`, `completeDate: ""`, `handoverDate: ""`.
2. Change the component signature to accept edit props:
```tsx
export default function ProjectForm({
  vendors,
  mode = "create",
  initial,
  projectId,
}: {
  vendors: Vendor[];
  mode?: "create" | "edit";
  initial?: Partial<typeof EMPTY>;
  projectId?: string;
}) {
```
3. Initialise state from `initial` when editing: `const [form, setForm] = useState({ ...EMPTY, ...(initial ?? {}) });`
4. In `onSubmit`, branch the request:
```tsx
      const res = await fetch(
        mode === "edit" ? `/api/projects/${projectId}` : "/api/projects",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
```
   On success in edit mode, skip the BOM import block and `router.push(\`/admin/projects/${projectId}\`)`. Keep the create-mode BOM flow exactly as-is.
5. Add a **District** input in the Identity section (next to State) and add **Live date / Complete date / Handover date** date inputs in the Commercial section (next to Start date), all wired with `set(...)` like the existing fields.
6. Make the header title/subtitle and submit button label reflect `mode` ("New project" / "Edit project"; "Create project" / "Save changes").

- [ ] **Step 2: Create the edit page**

Create `src/app/admin/projects/[id]/edit/page.tsx` (mirror `new/page.tsx`, but load the project + prefill):
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { PageHeader, btn } from "@/components/ui";
import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

function d(v: Date | null) {
  return v ? v.toISOString().slice(0, 10) : "";
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) return null;
  const { id } = await params;
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) notFound();

  const vendors = await prisma.vendor.findMany({
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  const initial = {
    gneId: p.gneId, clientName: p.clientName ?? "", tenderId: p.tenderId ?? "",
    state: p.state ?? "", district: p.district ?? "", cluster: p.cluster ?? "",
    plantName: p.plantName ?? "",
    capacityAcMw: p.capacityAcMw?.toString() ?? "", capacityDcMw: p.capacityDcMw?.toString() ?? "",
    epcScope: p.epcScope ?? "", poNumber: p.poNumber ?? "", poValueCr: p.poValueCr?.toString() ?? "",
    subPartner: p.subPartner ?? "", vendorId: p.vendorId ?? "", stage: p.stage,
    startDate: d(p.startDate), liveDate: d(p.liveDate), completeDate: d(p.completeDate),
    handoverDate: d(p.handoverDate), plantAddress: p.plantAddress ?? "", clientAddress: p.clientAddress ?? "",
  };

  return (
    <>
      <PageHeader title="Edit project" subtitle={p.gneId}>
        <Link href={`/admin/projects/${id}`} className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </PageHeader>
      <div className="p-8 space-y-6">
        <ProjectForm vendors={vendors} mode="edit" initial={initial} projectId={id} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add an Edit link on the detail page header**

In `src/app/admin/projects/[id]/page.tsx`, find the `PageHeader` actions area (the existing header buttons) and add as the first action:
```tsx
        <Link href={`/admin/projects/${project.id}/edit`} className={btn("secondary", "sm")}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
```
Import `Pencil` from `lucide-react` if not already imported (check the existing import block first; add only if missing).

- [ ] **Step 4: Typecheck + lint + build (build gate)**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Manual check**

`npm run dev` → open a project → **Edit** → change fields incl. live/complete/handover dates + district → Save → values persist on the detail page. Create flow still works (new project + optional BOM).

- [ ] **Step 6: Commit**
```bash
git add src/components/ProjectForm.tsx "src/app/admin/projects/[id]/edit/page.tsx" "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat: editable project form + edit page + lifecycle date/district fields"
```

---

## Module 2 — Activity DPR editable grid (flagship)

### Task 4: DPR/activity schema (kind enum + ordering + remarks)

**Files:**
- Modify: `prisma/schema.prisma` (`DprEntry` ~line 295, `ProjectActivity` ~line 275)

**Interfaces:**
- Produces: `enum DprKind { VALUE COM NONE }`; `DprEntry.kind DprKind @default(VALUE)`; `ProjectActivity.sortOrder Int @default(0)`, `ProjectActivity.activitySerial Int?`, `ProjectActivity.remarks String?`.

- [ ] **Step 1: Edit schema**

Add the enum near the other enums:
```prisma
enum DprKind {
  VALUE // a numeric quantity done that day
  COM   // activity completed on/after this day (non-additive)
  NONE  // explicit no-work marker (non-additive)
}
```
In `DprEntry`, add after `qtyDone Float`:
```prisma
  kind    DprKind @default(VALUE)
```
In `ProjectActivity`, add after `endDate DateTime?`:
```prisma
  activitySerial Int?    // "Activity Sl.no" grouping parent
  sortOrder      Int     @default(0)
  remarks        String?
```

- [ ] **Step 2: Migrate**

Run: `npm run db:migrate -- --name dpr_kind_activity_order`
Expected: applied; existing `DprEntry` rows default to `kind = VALUE`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (Prisma client regenerated by migrate).

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: DprKind enum + DprEntry.kind; activity ordering + remarks"
```

### Task 5: VALUE-only progress helpers + update rollups + cap

**Files:**
- Modify: `src/lib/projects.ts` (add helpers)
- Modify: `src/app/api/projects/[id]/dpr/route.ts` (cap → VALUE-only; accept `kind`)
- Modify: `src/app/admin/projects/[id]/activities/[activityId]/page.tsx` (done calc)
- Modify: `src/app/admin/projects/[id]/page.tsx` (progress-tab `done` calc, ~line 669)
- Modify: `src/app/admin/projects/summary/page.tsx` (any `qtyDone` sum)

**Interfaces:**
- Produces: `valueDone(entries: { qtyDone: number; kind: string }[]): number` and `isCompleted(entries: { kind: string }[]): boolean` in `src/lib/projects.ts`.

- [ ] **Step 1: Add helpers**

In `src/lib/projects.ts` add:
```ts
// Cumulative done counts only VALUE entries; COM/NONE are non-additive markers.
export function valueDone(entries: { qtyDone: number; kind: string }[]): number {
  return entries.reduce((s, e) => s + (e.kind === "VALUE" ? e.qtyDone : 0), 0);
}
// An activity is complete if any day is marked COM.
export function isCompleted(entries: { kind: string }[]): boolean {
  return entries.some((e) => e.kind === "COM");
}
```

- [ ] **Step 2: Update every cumulative sum to use `valueDone`**

In each consumer that currently does `entries.reduce((s,e)=>s+e.qtyDone,0)`, import and use `valueDone(activity.entries)` instead, and where a `%` is shown, force 100% when `isCompleted(entries)`:
- `activities/[activityId]/page.tsx` line ~66: `const done = valueDone(activity.entries);` then `const pct = isCompleted(activity.entries) ? 100 : activityPct(done, activity.totalQty);`
- `projects/[id]/page.tsx` line ~669: `const done = valueDone(a.entries);` and `const pct = isCompleted(a.entries) ? 100 : activityPct(done, a.totalQty);`
- `summary/page.tsx`: wherever it sums `qtyDone` per activity, switch to `valueDone`.

(Grep `qtyDone` across `src/app/admin` to find all sums; convert each.)

- [ ] **Step 3: Cap counts only VALUE entries**

In `src/app/api/projects/[id]/dpr/route.ts`, the cap aggregate (added 2026-06-18) currently sums all `qtyDone`. Change the aggregate `where` to count only VALUE entries:
```ts
    const agg = await prisma.dprEntry.aggregate({
      where: { activityId: d.activityId, date: { not: date }, kind: "VALUE" },
      _sum: { qtyDone: true },
    });
```
And accept an optional `kind` from the body so this single-day route can also write a `COM`/`NONE` cell. Extend `dprEntrySchema` (Task done inline here) so `kind` is optional `z.enum(["VALUE","COM","NONE"]).default("VALUE")`, and pass `kind: d.kind` into the upsert `create`/`update`. The cap check only runs when `d.kind === "VALUE"`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. Manually reason: progress bars still render; a COM entry shows 100%.

- [ ] **Step 5: Commit**
```bash
git add src/lib/projects.ts "src/app/api/projects/[id]/dpr/route.ts" "src/app/admin/projects/[id]/activities/[activityId]/page.tsx" "src/app/admin/projects/[id]/page.tsx" src/app/admin/projects/summary/page.tsx src/lib/project-schemas.ts
git commit -m "feat: VALUE-only cumulative progress (COM/NONE non-additive) across rollups + cap"
```

### Task 6: Bulk DPR grid endpoint + activity PATCH/DELETE

**Files:**
- Create: `src/app/api/projects/[id]/dpr/grid/route.ts`
- Create: `src/app/api/projects/[id]/activities/[activityId]/route.ts`
- Modify: `src/lib/project-schemas.ts` (add `dprGridSchema`, extend `activitySchema` with the new fields)

**Interfaces:**
- Consumes: `valueDone` not needed server-side; uses `prisma`, `toDate`.
- Produces: `PUT /api/projects/[id]/dpr/grid` body `{ cells: [{ activityId, date, kind, qtyDone? }] }` → `{ ok: true }` or 400 with cap message; `PATCH`/`DELETE /api/projects/[id]/activities/[activityId]`.

- [ ] **Step 1: Schemas**

In `src/lib/project-schemas.ts` add:
```ts
export const dprGridSchema = z.object({
  cells: z
    .array(
      z.object({
        activityId: z.string().min(1),
        date: z.string().min(1),
        kind: z.enum(["VALUE", "COM", "NONE"]).default("VALUE"),
        qtyDone: z.coerce.number().refine((n) => Number.isFinite(n), "Quantity required").optional(),
      })
    )
    .min(1, "No cells to save")
    .max(2000, "Too many cells in one save"),
});
```
Extend `activitySchema` with the new editable fields:
```ts
  activitySerial: num,
  sortOrder: num,
  remarks: str,
```

- [ ] **Step 2: Bulk grid route**

Create `src/app/api/projects/[id]/dpr/grid/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { dprGridSchema, toDate } from "@/lib/project-schemas";

// PUT /api/projects/[id]/dpr/grid (admin) — bulk upsert/delete daily cells.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = dprGridSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const cells = parsed.data.cells;

  // All referenced activities must belong to this project.
  const ids = [...new Set(cells.map((c) => c.activityId))];
  const acts = await prisma.projectActivity.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true, totalQty: true, uom: true },
  });
  const byId = new Map(acts.map((a) => [a.id, a]));
  for (const c of cells) {
    const a = byId.get(c.activityId);
    if (!a || a.projectId !== id) {
      return NextResponse.json({ error: "An activity does not belong to this project" }, { status: 404 });
    }
  }

  // Normalise dates; reject unparseable.
  const norm = cells.map((c) => ({ ...c, d: toDate(c.date) }));
  if (norm.some((c) => !c.d)) {
    return NextResponse.json({ error: "Invalid date in one of the cells" }, { status: 400 });
  }

  // Cap re-check per activity: existing VALUE sum (excluding the dates in this
  // batch) + the batch's VALUE qty must not exceed totalQty.
  for (const a of acts) {
    if (a.totalQty == null || a.totalQty <= 0) continue;
    const batch = norm.filter((c) => c.activityId === a.id);
    const batchDates = batch.map((c) => c.d as Date);
    const agg = await prisma.dprEntry.aggregate({
      where: { activityId: a.id, kind: "VALUE", date: { notIn: batchDates } },
      _sum: { qtyDone: true },
    });
    const others = agg._sum.qtyDone ?? 0;
    const batchValue = batch.reduce((s, c) => s + (c.kind === "VALUE" ? (c.qtyDone ?? 0) : 0), 0);
    if (others + batchValue > a.totalQty + 1e-6) {
      const remaining = Math.max(0, a.totalQty - others);
      const uom = a.uom ? ` ${a.uom}` : "";
      const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString("en-IN");
      return NextResponse.json(
        { error: `One activity would exceed its planned ${fmt(a.totalQty)}${uom}; at most ${fmt(remaining)}${uom} more can be logged.` },
        { status: 400 }
      );
    }
  }

  // Apply in one transaction. A NONE cell with no value deletes that date's entry.
  await prisma.$transaction(
    norm.map((c) => {
      const date = c.d as Date;
      if (c.kind === "NONE" && (c.qtyDone == null)) {
        return prisma.dprEntry.deleteMany({ where: { activityId: c.activityId, date } });
      }
      const qty = c.kind === "VALUE" ? (c.qtyDone ?? 0) : 0;
      return prisma.dprEntry.upsert({
        where: { activityId_date: { activityId: c.activityId, date } },
        update: { qtyDone: qty, kind: c.kind },
        create: { activityId: c.activityId, date, qtyDone: qty, kind: c.kind },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Activity PATCH/DELETE route**

Create `src/app/api/projects/[id]/activities/[activityId]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { activitySchema, toDate } from "@/lib/project-schemas";

async function owned(id: string, activityId: string) {
  const a = await prisma.projectActivity.findUnique({ where: { id: activityId }, select: { projectId: true } });
  return !!a && a.projectId === id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, activityId } = await params;
  if (!(await owned(id, activityId))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  await prisma.projectActivity.update({
    where: { id: activityId },
    data: {
      activity: d.activity, subActivity: d.subActivity, uom: d.uom, totalQty: d.totalQty,
      startDate: toDate(d.startDate), endDate: toDate(d.endDate),
      activitySerial: d.activitySerial, sortOrder: d.sortOrder ?? 0, remarks: d.remarks,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, activityId } = await params;
  if (!(await owned(id, activityId))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  await prisma.projectActivity.delete({ where: { id: activityId } }); // DprEntry cascades
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add "src/app/api/projects/[id]/dpr/grid/route.ts" "src/app/api/projects/[id]/activities/[activityId]/route.ts" src/lib/project-schemas.ts
git commit -m "feat: bulk DPR grid upsert endpoint + activity PATCH/DELETE"
```

### Task 7: DPR editable grid UI

**Files:**
- Create: `src/components/DprGrid.tsx`
- Create: `src/app/admin/projects/[id]/dpr/page.tsx` (a dedicated full-width grid page)
- Modify: `src/app/admin/projects/[id]/page.tsx` (Progress tab — add a "DPR grid" link to the new page; add activity Edit/Delete via `RecordForm`)

**Interfaces:**
- Consumes: `PUT /api/projects/[id]/dpr/grid`, `PATCH|DELETE /api/projects/[id]/activities/[activityId]` (Task 6).
- Produces: `DprGrid` client component.

**Behavior contract (build to this; produce top-tier, accessible code):**
- Server page loads the project's activities (ordered `activitySerial` then `sortOrder` then `createdAt`) each with their `entries` (id, date, qtyDone, kind), and passes them to `<DprGrid projectId activities dateWindow />`.
- The grid renders a table: **frozen left columns** (Activity / Sub-activity / UOM / Total / Cumulative / %) using `valueDone`/`isCompleted` for the read-only Cumulative & %; then **one editable cell per date** across a **bounded, navigable window** (default: last 21 days ending today; prev/next-week buttons and a "jump to today"/date-range picker). The visible window is **labelled** ("Showing 2026-05-28 → 2026-06-18") so coverage is never silently hidden.
- Each date cell is an input: empty = no entry; a number = `VALUE`; a button/keystroke toggles **`Com`** (cell shows "Com", non-editable until toggled back); clearing a previously-set cell marks it for delete (`NONE` with no value).
- Local dirty-cell tracking; a single **Save** button flushes all changed cells to `PUT …/dpr/grid` as `{ cells: [...] }`. On success `router.refresh()`; on error (e.g. cap exceeded) show the server message inline and keep edits.
- Activity rows expose inline **Edit** (a `RecordForm method="PATCH"` endpoint `/api/projects/[id]/activities/[activityId]` pre-filled with activity, subActivity, uom, totalQty, startDate, endDate, activitySerial, sortOrder, remarks) and **Delete** (confirm → `DELETE`).
- Horizontal scroll for the date band; sticky header row of dates; tabular-nums; keyboard left/right/up/down between cells is a nice-to-have.

**Skeleton (flesh out to the full contract):**
```tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, btn } from "@/components/ui";
import { valueDone, isCompleted } from "@/lib/projects";

type Entry = { date: string; qtyDone: number; kind: "VALUE" | "COM" | "NONE" };
type Activity = {
  id: string; activity: string; subActivity: string | null; uom: string | null;
  totalQty: number | null; entries: Entry[];
};
type CellEdit = { activityId: string; date: string; kind: "VALUE" | "COM" | "NONE"; qtyDone?: number };

export default function DprGrid({
  projectId, activities, dates,
}: { projectId: string; activities: Activity[]; dates: string[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, CellEdit>>({}); // key `${activityId}|${date}`
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // index existing entries for O(1) cell lookup …
  // setCell(activityId, date, raw) parses "" -> delete(NONE), "com" -> COM, number -> VALUE …
  async function save() {
    setSaving(true); setError(null);
    try {
      const cells = Object.values(edits);
      if (!cells.length) return;
      const res = await fetch(`/api/projects/${projectId}/dpr/grid`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setEdits({}); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }
  // render frozen columns + date grid per the contract …
  return null; // replace with the full grid markup
}
```

- [ ] **Step 1: Build `DprGrid.tsx`** to the full contract above (top-tier, responsive horizontal-scroll grid, dirty tracking, Com toggle, Save, inline activity Edit/Delete).
- [ ] **Step 2: Create the grid page** `src/app/admin/projects/[id]/dpr/page.tsx` (admin-guarded; loads activities + entries; computes the default 21-day window ending today; passes serialized `dates: string[]` and activities to `<DprGrid>`).
- [ ] **Step 3: Link from the Progress tab** — in `projects/[id]/page.tsx` Progress tab header add a `Link` `href={\`/admin/projects/${project.id}/dpr\`}` styled `btn("primary","sm")` labelled "DPR grid", and add per-activity Edit/Delete controls.
- [ ] **Step 4: Typecheck + lint + build (build gate)**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Manual check**

Open `/admin/projects/<id>/dpr` → enter numbers across several dates for an activity, mark one day **Com**, clear one → **Save** → reload shows persisted values; Cumulative/% reflect VALUE-only; a Com row shows 100%; entering over the planned total is rejected with the cap message.

- [ ] **Step 6: Commit**
```bash
git add src/components/DprGrid.tsx "src/app/admin/projects/[id]/dpr/page.tsx" "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat: editable Activity DPR daily grid (number/Com/blank) + activity edit/delete"
```

---

## Module 3 — PO & MRC full edit

### Task 8: ProcurementItem schema + validation

**Files:**
- Modify: `prisma/schema.prisma` (`ProcurementItem` ~line 331)
- Modify: `src/lib/project-schemas.ts` (`materialSchema`)

**Interfaces:**
- Produces: `ProcurementItem.deliveryDate DateTime?`, `mdcc String?`, `signoffBel String?`, `mahagenco String?`; `materialSchema` gains `deliveryDate`, `mdcc`, `signoffBel`, `mahagenco`, `paymentStatus`.

- [ ] **Step 1: Schema**

In `ProcurementItem` add after `receivedDate DateTime?`:
```prisma
  deliveryDate DateTime?
  mdcc         String? // MDCC gate (NO/WIP/Done text)
  signoffBel   String? // BEL sign-off (NO/WIP/Done)
  mahagenco    String? // Mahagenco approval (NO/WIP/Done)
```

- [ ] **Step 2: Migrate** — `npm run db:migrate -- --name procurement_gates` (additive).

- [ ] **Step 3: Validation** — in `materialSchema` add `deliveryDate: str`, `mdcc: str`, `signoffBel: str`, `mahagenco: str`, and `paymentStatus: str` (the field exists on the model but was never in the schema).

- [ ] **Step 4: Typecheck + lint** — `npx tsc --noEmit && npm run lint` → PASS.

- [ ] **Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations src/lib/project-schemas.ts
git commit -m "feat: PO&MRC gate fields (deliveryDate/mdcc/signoffBel/mahagenco) + paymentStatus in schema"
```

### Task 9: Materials create/edit/delete routes + new fields

**Files:**
- Modify: `src/app/api/projects/[id]/materials/route.ts` (persist new fields)
- Create: `src/app/api/projects/[id]/materials/[itemId]/route.ts` (PATCH + DELETE)

**Interfaces:**
- Produces: `PATCH|DELETE /api/projects/[id]/materials/[itemId]`; POST now persists `deliveryDate`, `mdcc`, `signoffBel`, `mahagenco`, `paymentStatus`.

- [ ] **Step 1: Persist new fields in POST** — in `materials/route.ts` add to the `procurementItem.create` data: `paymentStatus: d.paymentStatus, deliveryDate: toDate(d.deliveryDate), mdcc: d.mdcc, signoffBel: d.signoffBel, mahagenco: d.mahagenco,`.

- [ ] **Step 2: PATCH/DELETE route** — create `materials/[itemId]/route.ts` mirroring Task 6's activity route pattern (ownership check by `procurementItem.findUnique → projectId === id`), `PATCH` re-parses `materialSchema` and updates all fields (incl. the new ones, dates via `toDate`), `DELETE` removes the row.

- [ ] **Step 3: Typecheck + lint** → PASS.

- [ ] **Step 4: Commit**
```bash
git add "src/app/api/projects/[id]/materials/route.ts" "src/app/api/projects/[id]/materials/[itemId]/route.ts"
git commit -m "feat: PO&MRC persist gate fields + PATCH/DELETE material route"
```

### Task 10: Materials UI (new columns + edit/delete) + Excel I/O columns

**Files:**
- Modify: `src/app/admin/projects/[id]/page.tsx` (Materials tab — RecordForm fields + table columns + edit/delete)
- Modify: `src/lib/materials-excel.ts` (add the new columns to build + parse)

**Interfaces:**
- Consumes: Task 9 routes; the `RecordForm` `FieldDef` config + the export route (Task 12 reuses this).

- [ ] **Step 1: Add new fields to the Materials "Add" RecordForm** in the Materials tab: `deliveryDate` (date), `mdcc`, `signoffBel`, `mahagenco`, `paymentStatus` (text), matching the existing field list pattern.
- [ ] **Step 2: Surface columns in the materials table** — add table cells for `paymentStatus`, `receivedDate`, `deliveryDate`, `mdcc`, `signoffBel`, `mahagenco`, `remarks` (some captured-but-hidden today).
- [ ] **Step 3: Per-row Edit/Delete** — add an Edit (`RecordForm method="PATCH"` endpoint `/api/projects/[id]/materials/[itemId]`, pre-filled) and Delete (confirm → `DELETE`) control per row, mirroring the activity pattern from Task 7.
- [ ] **Step 4: Extend `materials-excel.ts`** — add the new headers (`Delivery date`, `MDCC`, `BEL sign-off`, `Mahagenco`, `Payment`) to the `COLS`/build mapping and the parser's column finder so export and import round-trip the new fields.
- [ ] **Step 5: Typecheck + lint + build (build gate)** → all PASS.
- [ ] **Step 6: Manual check** — add a material with the gate fields, edit it, delete one; export Materials xlsx and confirm the new columns appear with values.
- [ ] **Step 7: Commit**
```bash
git add "src/app/admin/projects/[id]/page.tsx" src/lib/materials-excel.ts
git commit -m "feat: PO&MRC editable UI (new columns, edit/delete) + Excel I/O columns"
```

---

## Module 12 — Workbook round-trip I/O (P0 sheets)

### Task 11: `workbook.ts` foundation + per-page export for Project Details & DPR

**Files:**
- Create: `src/lib/workbook.ts`
- Create: `src/app/api/projects/[id]/project-details/export/route.ts`
- Create: `src/app/api/projects/[id]/dpr/export/route.ts`
- Modify: project detail page (add "Download Excel" buttons on the relevant tabs)

**Interfaces:**
- Produces: `buildProjectDetailsSheet(ws, projects)`, `buildDprSheet(ws, project)` (or standalone `buildProjectDetailsWorkbook`/`buildDprWorkbook` returning `ExcelJS.Buffer`) in `src/lib/workbook.ts`, using the **source header layout** from `.git/sdd/xlsx-structure.txt`.

- [ ] **Step 1: Build `workbook.ts`** with `exceljs`, mirroring `src/lib/materials-excel.ts` style. Define the exact header arrays for **Project Details** (`Sl.no, Activties, Description, GNE ID, Client name, Tender, State, Cluster Name, Station / Plant Name, Capacity ( MW) AC, Capacity ( MW) DC, PO number, PO Value ( Cr), Sub Partner, PO, start date, live date, complete date, handover date, , Plant Address, BEL Address`) and **Activity DPR** (`Sl.no, GNE ID, Station / Plant Name, Capacity ( MW), Sub Partner, Activity Sl.no, Activity, Sub Activity, Start date, End date, Unit, Total, Cumulative, Completion, <one column per date>`), reading the dates from the project's DprEntry set. `Com` cells emit the literal `"Com"`; numeric `VALUE` cells emit the number; absent = blank. Cumulative/Completion are computed values (`valueDone`/`activityPct`). Export `buildProjectDetailsWorkbook(projects)` and `buildDprWorkbook(project)` returning `Promise<ExcelJS.Buffer>`.
- [ ] **Step 2: Export routes** — create the two `GET …/export` routes mirroring `materials/export/route.ts` (admin, load project(+activities/entries), build buffer, return with the xlsx `Content-Type` + `Content-Disposition` filename `ProjectDetails-<gneId>.xlsx` / `DPR-<gneId>.xlsx`).
- [ ] **Step 3: Buttons** — add "Download Excel" `<a>` (styled `btn("secondary","sm")`) on the Overview tab (Project Details) and the Progress/DPR tab pointing at the export routes (`download` attr).
- [ ] **Step 4: Typecheck + lint** → PASS.
- [ ] **Step 5: Manual check** — download both; open in Excel; headers + data match the source layout; a `Com` day shows "Com".
- [ ] **Step 6: Commit**
```bash
git add src/lib/workbook.ts "src/app/api/projects/[id]/project-details/export/route.ts" "src/app/api/projects/[id]/dpr/export/route.ts" "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat: workbook.ts foundation + Project Details & DPR per-page Excel export"
```

### Task 12: Full-project workbook export

**Files:**
- Create: `src/app/api/projects/[id]/workbook/route.ts`
- Modify: `src/lib/workbook.ts` (add `buildFullProjectWorkbook(project)` assembling all available sheets into ONE workbook)
- Modify: project detail page header (a "Download full workbook" button)

**Interfaces:**
- Consumes: the sheet builders from Task 11 + the existing `buildMaterialsWorkbook`/BOQ/activities builders (reuse their row mappers, or add `addMaterialsSheet(wb, …)` helpers in `workbook.ts`).
- Produces: `GET /api/projects/[id]/workbook` → one `.xlsx` named `Project-<gneId>.xlsx` with sheets: Project Details, Activity DPR, PO & MRC (+ BOQ/Materials/Activities where present). Each derived/computed cell is a value.

- [ ] **Step 1: `buildFullProjectWorkbook`** — one `ExcelJS.Workbook`, add a worksheet per available P0 sheet in source order using the builders/mappers (Project Details row for this project; the DPR grid; PO & MRC rows). Sheets whose data is empty still get their header row.
- [ ] **Step 2: Route** — `GET …/workbook` (admin, load project with `materials`, `activities.entries`, `boqItems` as needed), build, return the buffer.
- [ ] **Step 3: Button** — "Download full workbook" in the project header.
- [ ] **Step 4: Typecheck + lint + build (build gate)** → PASS.
- [ ] **Step 5: Manual check** — download; the workbook has the P0 sheets with the project's data in source layout.
- [ ] **Step 6: Commit**
```bash
git add "src/app/api/projects/[id]/workbook/route.ts" src/lib/workbook.ts "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat: full-project workbook export (P0 sheets, source layout)"
```

### Task 13: Full-workbook import (upload → autofill projects)

**Files:**
- Create: `src/app/api/projects/import-workbook/route.ts`
- Modify: `src/lib/workbook.ts` (add `parseWorkbook(buffer)` → per-sheet parsed rows keyed by GNE ID)
- Modify: `src/components/ProjectForm.tsx` OR `src/app/admin/projects/new/page.tsx` (add an "Upload workbook" control)

**Interfaces:**
- Consumes: the per-sheet parsers (reuse `parseActivitiesWorkbook`/`parseMaterialsWorkbook` patterns; add Project Details + DPR parsers in `workbook.ts`).
- Produces: `POST /api/projects/import-workbook` (multipart `file`) → `{ ok, projects: [{gneId, created|updated}], perSheet: {...counts}, errors: [] }`.

- [ ] **Step 1: `parseWorkbook`** — read every recognised sheet; from **Project Details** produce one record per row keyed by `gneId` with all Project fields; from **Activity DPR** produce activities (+ per-date `VALUE`/`COM` cells) grouped by `GNE ID`; from **PO & MRC** produce procurement rows by `Project ID`(gneId). Tolerate messy cells (text in number columns, `Com`/`-`, blank rows) using the existing `cellText`/`cellNum` helpers; count `skipped`.
- [ ] **Step 2: Import route** — for each Project Details record: `upsert` the `Project` by `gneId` (create if absent, update fields if present). Then create its activities + DPR entries (kind from `Com`) and procurement rows in a transaction per project. Size-cap the upload (5 MB like the activities importer) and admin-guard. Return the per-project + per-sheet counts and a non-fatal `errors[]`. Unrecognised sheets are skipped with a count.
- [ ] **Step 3: UI** — on `/admin/projects/new`, add an **"Upload workbook"** file input + button that POSTs to `/api/projects/import-workbook` and shows the result summary (created/updated projects + counts), then links to the imported project(s).
- [ ] **Step 4: Typecheck + lint + build (build gate)** → PASS.
- [ ] **Step 5: Manual check** — upload `1- Project Details & DPR 10-Feb-26.xlsx`; confirm projects are created/updated by GNE ID and their Activity-DPR + PO&MRC data populate; re-uploading updates in place (no duplicates).
- [ ] **Step 6: Commit**
```bash
git add "src/app/api/projects/import-workbook/route.ts" src/lib/workbook.ts src/components/ProjectForm.tsx "src/app/admin/projects/new/page.tsx"
git commit -m "feat: upload workbook to auto-fill projects (Project Details + DPR + PO&MRC)"
```

---

## Self-Review notes (author)

- **Spec coverage:** Module 1 → Tasks 1-3; Module 2 → Tasks 4-7; Module 3 → Tasks 8-10; Module 12 I/O → Tasks 11-13 (per-page export, full-project export, upload-import). Locked decisions all reflected: DprKind faithful cells (T4-T7), status-text gates (T8), Sheet1 not in P0 (correctly deferred), import keyed by gneId (T13).
- **Type consistency:** `valueDone`/`isCompleted` defined in T5, used in T5/T7/T11. `dprGridSchema.cells[].{activityId,date,kind,qtyDone?}` defined T6, consumed by T7 (`PUT`) and produced by T13 parse. `projectEditSchema` T1 → route T2 → form T3. `materialSchema` new fields T8 → routes T9 → UI/Excel T10 → import T13.
- **No placeholders:** the only non-literal is the `DprGrid` body (T7), given as a rigorous behavior contract + skeleton because a full top-tier grid is a large component; every data/route/lib task carries complete code.
- **Build gates** at the end of each module (T3, T7, T10, T12, T13) run `npm run build`.

## Risks carried from the spec
- `Com`/VALUE-only rollups touch multiple files (T5) — the grep-all-`qtyDone` step is the safeguard.
- Bulk grid concurrency is last-write-wins with the cap re-checked over post-batch state inside the transaction (T6).
- Round-trip fidelity is structural (layout + values), not formulas; importer skips-and-counts messy/unmodelled rows rather than failing (T13).
