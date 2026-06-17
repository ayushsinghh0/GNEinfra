# Excel → ERP parity: full editability of the Project DPR workbook

**Date:** 2026-06-18
**Module:** Phase 2 — Project Management
**Status:** Approved (brainstorm) — P0 detailed, P1/P2 roadmap
**Source workbook:** `1- Project Details & DPR 10-Feb-26.xlsx` (11 sheets)

## Goal

Bring every column of the project workbook into the ERP and make it **editable** in the admin UI, to a top-tier standard. Derived/pivot sheets become read-only computed views. The flagship is an editable, spreadsheet-style **Activity DPR daily grid**.

The ERP must also **round-trip the workbook**: (a) **upload** the `.xlsx` and have a whole project auto-fill from it, (b) **download each page** (sheet) as Excel with all of that page's data, and (c) **download a full project** as a single workbook in the **same sheet/column layout as the source file**.

## Locked decisions (from brainstorm)

1. **Build order:** P0 core first — (1) Project master edit → (2) Activity DPR editable grid → (3) PO & MRC full edit. P1/P2 modules follow in their own spec→plan cycles.
2. **DPR daily cells are faithful:** each cell is a numeric quantity, a `Com` (completed) marker, or blank/no-work. Modeled as a `DprKind { VALUE | COM | NONE }` enum on `DprEntry`; only `VALUE` cells contribute to cumulative/`%`.
3. **PO&MRC gate columns** (MDCC, BEL sign-off, Mahagenco) are **short status text** (e.g. `NO` / `WIP` / `Done`), not booleans — matching the workbook.
4. **Sheet1 (per-plant key equipment)** is **auto-computed read-only** from each project's BOQ, grouped by plant. No editable master, no double data-entry.
5. **Workbook round-trip is structural parity, not byte-identical.** Exports reproduce the source's sheet names, header rows, and column order; computed/formula cells (Cumulative, %, Pending, Balance, staged date formulas) are written as **computed values**, not live formulas. Import is keyed by **`GNE ID`** and **upserts per project** — one upload may create/update one or several projects (the file holds many), so it works whether a workbook carries one project or the whole portfolio.

## Non-goals (this spec)

- Implementing P1/P2 modules in detail — they are captured at roadmap altitude here and will each get their own spec→plan cycle.
- Re-architecting the existing read paths or the Phase-1 vendor flow.
- A canonical Activity/SubActivity catalog (noted as a future hardening; free-text rows stay as-is for now).

---

## Cross-cutting architecture

The ERP is **create-only almost everywhere**: only `boq/[itemId]` has a PATCH today. This initiative establishes three reusable patterns, introduced in P0 and reused by P1/P2:

1. **Per-row edit/delete convention.** For each child collection, a `PATCH` + `DELETE` route at `/api/projects/[id]/<collection>/[itemId]` (admin-guarded, ownership-checked: the row's `projectId` must equal the route's project). The existing generic `RecordForm` already supports `method: "PATCH"`; edit reuses it pre-filled, and a small delete control calls `DELETE`.
2. **Bulk grid upsert.** For the wide date-matrix sheets (DPR now; Block-wise and Milestone later), a `PUT /api/projects/[id]/<thing>/grid` accepting many cells at once `{ cells: [...] }`, applied as a single transaction, last-write-wins on the unique key. Avoids hundreds of per-cell POSTs.
3. **Derived read-only pivots.** Sheets that are computed (Sheet3, S-Sumry, Summary right block, Sheet1) reuse the existing `summary/page.tsx` "plant-as-dynamic-column" server-render pattern — never CRUD.
4. **Workbook round-trip I/O.** A shared `src/lib/workbook.ts` defines, per sheet, the exact column layout (header rows + column order, taken verbatim from the source file's structure — captured in `.git/sdd/xlsx-structure.txt`) plus a row⇄model mapper. Three capabilities build on it, all via the project's existing `exceljs` dependency:
   - **Per-page export** — every editable tab gets a "Download Excel" button hitting `GET /api/projects/[id]/<sheet>/export`, producing that single sheet with all its rows. (BOQ/Materials/Activities already have this; the pattern extends to Project Details, DPR, PO&MRC, Rain, Approvals, PPE, Milestones.)
   - **Full-project export** — `GET /api/projects/[id]/workbook` builds **one workbook with every sheet** in the source layout (Project Details, Summary, Sheet3, S-Sumry Activity, Activity DPR, Block wise, PO & MRC, Rain, App materials, PPE, Sheet1) for that project. Derived sheets are emitted as computed values. This is the "download all the data, same as the source file" deliverable.
   - **Full-workbook import** — `POST /api/projects/import-workbook` accepts an uploaded `.xlsx`, parses every recognised sheet, and **upserts each project found by GNE ID**, auto-creating the `Project` from the Project Details row and populating its activities/DPR cells/blocks/procurement/rain/approvals/PPE/milestones. Reuses each sheet's row-mapper. Reports per-sheet imported/skipped counts and a clear error list. Surfaced on the **New project** page as "Upload workbook".
   Fidelity is bounded by what each sheet's model supports at the time it is built: the importer/exporter cover exactly the sheets whose modules have landed, and grow with them (P0 covers Project Details + Activity DPR + PO&MRC + existing BOQ/Materials/Activities; the full 11-sheet round-trip completes as P1/P2 land).

**Verification gate (whole initiative):** no unit-test runner exists; the gate is `npx tsc --noEmit && npm run lint && npm run build` plus manual checks. Every schema change is an **additive, reversible** Prisma migration (`npm run db:migrate`), per `AGENTS.md`. Commits carry **no** `Co-Authored-By`/AI trailer.

---

## Module roadmap

| # | Module | Pri | Effort | Depends on |
|---|--------|-----|--------|-----------|
| 1 | Project master full edit | P0 | M | — |
| 2 | Activity DPR editable grid ⭐ | P0 | XL | 1 |
| 3 | PO & MRC full edit | P0 | M | 1 |
| 4 | Milestone matrix model + ~140 seed | P1 | XL | 1 |
| 5 | Milestone matrix grid UI | P1 | L | 4 |
| 6 | Blocks manager + Block-wise grid | P1 | L | 2 |
| 7 | Rain log edit | P2 | S | — |
| 8 | App materials edit + column fix | P2 | M | 1 |
| 9 | PPE edit + A/B/C sections | P2 | S | — |
| 10 | Derived read-only pivots (Sheet3, S-Sumry, Summary-right) | P2 | M | 2 |
| 11 | Sheet1 equipment summary (computed) | P2 | M | — |
| 12 | Workbook I/O foundation + per-page export (P0 sheets) | P0 | M | 1,2,3 |
| 13 | Full-workbook import (upload → autofill project) | P0/P1 | L | 12 |
| 14 | Full-project workbook export (source-format) | P1 | L | 12 |

P2 modules 7 and 9 are independent and can be built in parallel later. The round-trip I/O (12–14) is built on the `src/lib/workbook.ts` foundation; per-page export and the importer/exporter **grow to cover each sheet as its module lands** — P0 wires Project Details, Activity DPR, and PO & MRC (alongside the existing BOQ/Materials/Activities I/O); full 11-sheet fidelity completes with P1/P2.

---

## P0 detailed design

### Module 1 — Project master full edit

**Schema** (`prisma/schema.prisma`)
- Add `Project.district String?` (the PO&MRC "District" e.g. "CH SN"; project-level, reused by module 3).
- `liveDate`, `completeDate`, `handoverDate` already exist on `Project` but are absent from the create schema/form — wire them in.

**Validation** (`src/lib/validation.ts`)
- Extend `projectSchemaCreate` with `district`, `liveDate`, `completeDate`, `handoverDate` (all `optionalStr` ISO-date strings, like `startDate`).
- Add `projectEditSchema` = `projectSchemaCreate` (same fields). `gneId` remains editable but `@unique`; a collision returns a clear 409/400 (Prisma `P2002`). Relations use the cuid `projectId`, so editing `gneId` is FK-safe.

**API** — new `PATCH /api/projects/[id]/route.ts` (admin-only, mirrors the vendor `PATCH` pattern just shipped). Parses `projectEditSchema`, maps optional strings to `?? null`, converts the date strings to `Date | null`, updates the project; `P2002` on `gneId` → 409 "GNE ID already in use"; `P2025` → 404.

**UI** — reuse the existing `ProjectForm` in an **edit mode**:
- Add `district`, `liveDate`, `completeDate`, `handoverDate` inputs to `ProjectForm`.
- New page `src/app/admin/projects/[id]/edit/page.tsx` renders `ProjectForm` pre-filled from the project, posting `PATCH` to `/api/projects/[id]`.
- Add an **Edit** button on the project detail header linking to that page.

**Edge cases:** date strings parsed defensively (invalid → null); `gneId` uniqueness surfaced; stage editable via the form's existing select.

### Module 2 — Activity DPR editable grid (flagship)

This is the core of the user's ask: *"like activity dpr I can see and edit all the fields."*

**Schema** (`prisma/schema.prisma`)
- `enum DprKind { VALUE COM NONE }`; add `DprEntry.kind DprKind @default(VALUE)`. `qtyDone` stays `Float` (meaningful only for `VALUE`; `0` for `COM`/`NONE`).
- `ProjectActivity`: add `sortOrder Int @default(0)` (stable Sl.no ordering), `activitySerial Int?` (the "Activity Sl.no" that groups sub-activities under a parent), and `remarks String?` (row-level note; reused by Block-wise).

**Derived-value rule (important):** cumulative done = `sum(qtyDone WHERE kind = VALUE)`. `COM` marks the activity complete on/after that day (renders 100%/done) and `NONE` is an explicit no-work `-`; both are **non-additive**. The existing DPR cap (planned-total guard, shipped 2026-06-18) is updated to sum only `VALUE` entries, and `activityPct`/progress bars/summary rollups treat `COM`/`NONE` as zero-contribution. A `COM` cell forces the activity's displayed completion to 100% regardless of numeric sum.

**API**
- New `PUT /api/projects/[id]/dpr/grid` (admin) — body `{ cells: [{ activityId, date, kind, qtyDone? }] }`. In one transaction: verify every `activityId` belongs to the project; upsert each cell by `@@unique([activityId,date])` (last-write-wins); a cell with `kind:NONE` and no value **deletes** that date's entry. After applying a batch, re-validate each touched activity's `VALUE` sum against `totalQty` (the existing cap) and reject the whole batch with a clear message if any activity would exceed its plan. Returns the updated cells.
- New `PATCH` + `DELETE` at `/api/projects/[id]/activities/[activityId]/route.ts` — edit the fixed columns (`activity`, `subActivity`, `uom`, `totalQty`, `startDate`, `endDate`, `sortOrder`, `activitySerial`, `remarks`) and delete an activity (cascades its `DprEntry` rows).
- Keep the existing single-day `POST /dpr` (used by the "Log day" quick action) — the grid is additive, not a replacement.

**UI** — a new editable grid on the project **Progress** tab (and/or a dedicated full-screen grid):
- Rows = activities, grouped/ordered by `activitySerial` then `sortOrder`. Left **frozen columns**: Activity / Sub-activity / UOM / Total / Cumulative(read-only) / % (read-only).
- Right scrollable band: one **editable cell per date** over a navigable window (e.g. a 2–4 week window with prev/next and jump-to-today; horizontal scroll). MVP bounds the window to keep the DOM light; the full history is reachable by paging — and the page **states the visible window** so nothing is silently hidden.
- Cell interaction: type a number (`VALUE`), a toggle/shortcut to mark `Com`, or clear (`NONE`/delete). Edits batch locally; a single **Save** flushes via `PUT …/dpr/grid` (dirty-cell tracking, optimistic update, error surface). 
- Activity rows get inline **Edit** (fixed fields via `PATCH`, reusing `RecordForm` pre-filled) and **Delete**.
- Reuse the existing per-activity daily-log detail page; add edit/delete there too.

**Edge cases:** cap rejection returns which activity/how much over (reuse the shipped message); concurrent saves are last-write-wins per cell; `Com` after a partial number keeps the recorded number for history but shows complete.

### Module 3 — PO & MRC full edit

**Schema** (`prisma/schema.prisma`)
- `ProcurementItem`: add `deliveryDate DateTime?`, `mdcc String?`, `signoffBel String?`, `mahagenco String?`.
- `Project.district String?` (shared with module 1 — single migration if modules land together).

**Validation** (`src/lib/project-schemas.ts`) — extend `materialSchema` with `deliveryDate`, `mdcc`, `signoffBel`, `mahagenco`, and the **existing-but-unsurfaced** `paymentStatus`.

**API**
- Extend `POST /api/projects/[id]/materials` to accept the new fields + `paymentStatus`.
- New `PATCH` + `DELETE` at `/api/projects/[id]/materials/[itemId]/route.ts` (ownership-checked).
- Extend the Materials Excel import/export/template column list to include the new fields.

**UI** — Materials tab: add per-row **Edit** (pre-filled `RecordForm` → `PATCH`) and **Delete**; surface `paymentStatus`, `receivedDate`, `remarks`, `deliveryDate`, `mdcc`, `signoffBel`, `mahagenco` as columns. Project ID / Project / Tender ID / District render as read-only project context. Extend the existing Materials Excel import/export/template to carry the new columns.

### Module 12 — Workbook I/O foundation + P0 round-trip

**Foundation** — new `src/lib/workbook.ts` holding, per sheet, the source column layout (header text + order, from `.git/sdd/xlsx-structure.txt`) and a `toRows(project)` / `fromRows(rows)` mapper. Date/number/`Com` cell coercion lives here (incl. the Excel 1899-12-30 epoch for time-of-day cells like Rain From/To).

**Per-page export (P0 sheets)** — `GET /api/projects/[id]/project-details/export`, `…/dpr/export`, and extend the existing `…/materials/export`; each tab gets a "Download Excel" button. (BOQ/Materials/Activities already export.)

**Full-workbook import** — `POST /api/projects/import-workbook` (multipart `.xlsx`, admin, size-capped). Parses Project Details → upserts `Project` by `gneId`; then for each recognised P0 sheet (Activity DPR, PO & MRC, plus existing Activities/BOQ/Materials) maps rows to that project (matched by GNE ID / plant) and creates the child rows in a transaction. Returns `{ projects: [{gneId, created|updated}], perSheet: {imported, skipped}, errors: [] }`. Surfaced as **"Upload workbook"** on `/admin/projects/new` (alongside the manual form). Non-recognised sheets are skipped with a noted count, never a hard failure.

**Full-project export (stub in P0, completed in module 14)** — `GET /api/projects/[id]/workbook` assembles every **available** sheet for the project into one workbook in source layout; in P0 it emits the sheets whose mappers exist (Project Details, Activity DPR, PO & MRC, BOQ/Materials/Activities) and grows to all 11 as P1/P2 land.

---

## Consolidated data-model changes

**P0 (this build):**
- `Project`: `+district String?`; create/edit schema gains `district`, `liveDate`, `completeDate`, `handoverDate`.
- `enum DprKind { VALUE COM NONE }`; `DprEntry.kind DprKind @default(VALUE)`.
- `ProjectActivity`: `+sortOrder Int @default(0)`, `+activitySerial Int?`, `+remarks String?`.
- `ProcurementItem`: `+deliveryDate DateTime?`, `+mdcc String?`, `+signoffBel String?`, `+mahagenco String?`.
- New routes: `PATCH /api/projects/[id]`; `PUT /api/projects/[id]/dpr/grid`; `PATCH|DELETE /api/projects/[id]/activities/[activityId]`; `PATCH|DELETE /api/projects/[id]/materials/[itemId]`.
- **I/O:** new `src/lib/workbook.ts`; `GET /api/projects/[id]/project-details/export`, `…/dpr/export` (+ extend `…/materials` export); `GET /api/projects/[id]/workbook` (full-project export, P0 sheets); `POST /api/projects/import-workbook` (upload → upsert projects by GNE ID). No schema change for I/O.

**P1/P2 (later specs):** Milestone extensions (`startDate`/`endDate`/`value`/`unitNo`/`isComputed` + `MilestoneSubDate` child + ~140-item seed catalog); `ProjectBlock` CRUD + block linkage; `MaterialApproval` rename/clarify (`item→equipmentName`, `equipment→capApproved Float`); `SafetyItem` `section`/`category`/`sortOrder`; `WeatherLog` edit/delete; derived pivot pages; Sheet1 computed equipment summary.

## Testing / verification

No unit-test runner. Each task ends with `npx tsc --noEmit && npm run lint`, the build (`npm run build`) at module boundaries, and a named manual check (e.g. edit a project end-to-end; enter and Save a week of DPR cells incl. a `Com`; edit + delete a procurement row). Migrations applied with `npm run db:migrate`.

## Risks (P0-relevant)

- **`Com` vs numeric `qtyDone`:** making cumulative non-additive for `COM`/`NONE` touches every rollup (`activityPct`, progress bars, summary page, the shipped DPR cap). All must filter to `kind = VALUE`. This is the highest-risk change — covered by updating the cap and rollups in the same module.
- **Bulk grid concurrency:** `PUT …/dpr/grid` is last-write-wins on `@@unique([activityId,date])`; the cap re-check runs over the post-batch state inside the transaction.
- **`gneId` edit:** allowed but `@unique`; collisions surfaced as 409. FK-safe (relations use cuid).
- **Grid scope:** a full 900-row × 500-date matrix is too heavy to render at once; MVP bounds the visible date window and pages, and **labels** the window so coverage is never silently truncated.
- **Migration safety:** all P0 changes are additive (new nullable columns + new enum with a default); no data-lossy change in P0 (the `MaterialApproval` rename is deferred to P2 where it needs a backfill).
- **Round-trip fidelity:** the source has merged header bands, live formulas, and Excel-epoch time cells (Rain From/To). Exports reproduce **layout + values**, not formulas; the importer tolerates messy real-world cells (text in number columns, `Com`/`-` markers, blank rows) and reports skips rather than failing the whole upload. The full 11-sheet round-trip is only as complete as the modules that have landed — P0 covers Project Details + Activity DPR + PO&MRC + existing BOQ/Materials/Activities, and the importer/exporter skip-and-count unmodelled sheets until their modules ship.
- **Multi-project upload:** one workbook holds several projects; the importer upserts each by `GNE ID`, so an upload can create/update many projects at once. An accidental re-upload updates in place (idempotent by GNE ID) rather than duplicating.

## Roadmap (post-P0)

Build order continues: Milestone matrix (model+seed, then grid UI), Blocks + Block-wise grid, then the P2 quick wins (Rain, App materials, PPE) — independent ones in parallel — then the derived pivots and the Sheet1 computed summary. Each gets its own spec→plan→implement cycle.
