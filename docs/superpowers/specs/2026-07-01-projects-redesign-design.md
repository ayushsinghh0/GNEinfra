# Projects Redesign — Design Spec

**Date:** 2026-07-01
**Branch:** `multi-role-erp`
**Area:** HR module — `/hr/projects` (list) and `/hr/projects/[id]` (detail)
**Status:** Approved (brainstorming) — pending spec review

## Problem

The Projects list (`/hr/projects`) is a 7-column `table-fixed` with `min-w-[760px]` inside
`overflow-x-auto`. On normal/narrow widths it **overflows horizontally** and reads as a flat
spreadsheet — no overview, no sense of team size, no quick filtering. The detail page is a
details card plus a `min-w-[600px]` assignments table with the same overflow problem and no
team/timeline visualization.

Goal: a **top-notch, single-screen** Projects experience that fits any width (no horizontal
scroll, minimal vertical scroll), surfaces the **employee-to-project mapping** richly, and uses
the existing Soft-Wave design system (pills, stat tiles, cards, progress bars).

## Constraints & principles

- **Purely presentational + data-derived. NO database migration.** Everything is computed from
  existing fields (`Project`, `ProjectAssignment`, `Employee`). Safe against production Neon.
- **No new dependencies.** Compose existing primitives only: `Segmented`, `StatCard`, `Card`,
  `Chip`, `ProgressBar`, `PageHeader`, `EmptyState`. Bespoke SVG/CSS only — no chart/animation libs.
- **Soft-Wave guardrails:** light-mode only; brand atmosphere stays in chrome, never behind
  cards/data; all motion gated on `prefers-reduced-motion`; `.nums` on codes/dates/%/counts;
  16px inputs; 44px tap targets; `:focus-visible` rings.
- **RBAC unchanged:** `HR_VIEW` to read, `HR_WRITE` to mutate; managers stay read-only
  (`canWrite` hides the assign/remove/add controls). No new API routes.

## Data model (existing — unchanged)

- `Project { id, name, code, client?, status: ACTIVE|ON_HOLD|COMPLETED, startDate?, endDate?,
  assignments[], createdAt, updatedAt }`
- `ProjectAssignment { id, employeeId, projectId, roleOnProject?, allocationPct?, startDate,
  endDate?, employee{ id, empId, name } }`

## Derived values (new helper: `src/lib/hr-projects.ts`)

### `projectTimeline(status, startDate, endDate, now): { pct: number | null; label: string; tone }`
- `status === "COMPLETED"` → `{ pct: 100, label: "Completed", tone: "slate" }`
- missing `startDate` or `endDate` → `{ pct: null, label: "No timeline", tone: "slate" }`
- `now < startDate` → `{ pct: 0, label: "Not started", tone }`
- `now > endDate` → `{ pct: 100, label: "Overdue" if ACTIVE else "Ended", tone: "amber" }`
- otherwise `pct = clamp(round((now - start) / (end - start) * 100), 0, 100)`,
  `label: "{pct}% elapsed"`, tone `brand` (ACTIVE) / `amber` (ON_HOLD)
- A `null` pct renders a neutral, empty bar with the label — never a misleading fill.

### `projectStats(projects)` (list page)
From the already-fetched project list (each with its assignments):
- `total` = projects.length
- `active` = count where status === ACTIVE
- `peopleAssigned` = distinct `employeeId` across **all** assignments (one person on N projects
  counts once)
- `avgTeam` = round(totalAssignments / max(1, total))

### `assignmentStats(assignments)` (detail page)
- `teamSize` = assignments.length
- `totalAllocation` = sum of `allocationPct` where present (`"{n}%"`)
- `durationDays` = (endDate − startDate) in days, else `null` → "—"
- `roleCount` = distinct non-null `roleOnProject`

## New primitives (`src/components/ui.tsx`)

### `Avatar({ name, size }: { name: string; size?: "sm" | "md" })`
- Initials: first letter of the first two whitespace-separated words, uppercased (`"Ravi Kumar"
  → "RK"`; single word → first letter). Empty → "?".
- Color: deterministic — sum char codes of `name` mod a fixed palette of brand-tinted tones
  (`brand`, `amber`, `blue`, `emerald`, `slate`, `violet`), rendered `bg-{tone}-100
  text-{tone}-700 ring-1 ring-{tone}-200/60`. Palette uses **static class strings** (Tailwind
  can't see interpolated classes) via a `Record<tone, string>` map.
- Sizes: `sm` = `h-7 w-7 text-[11px]`, `md` = `h-9 w-9 text-xs`. Circular, `font-medium`,
  `grid place-items-center`, `select-none`.

### `AvatarStack({ names, max, size }: { names: string[]; max?: number; size?: "sm" | "md" })`
- Overlapping cluster (`-space-x-2`), each avatar with a `ring-2 ring-white` to separate.
- `max` default 5; if `names.length > max`, render the first `max` then a `+N` counter chip
  styled like an avatar (`bg-slate-100 text-slate-500`).
- `names.length === 0` → renders nothing (caller shows "No team yet").

## List page — `/hr/projects/page.tsx` (RSC)

Reads `searchParams: { status?, q? }`. Validates `status` ∈ {ACTIVE, ON_HOLD, COMPLETED};
invalid/absent → all. Fetches **all** projects once (ordered `createdAt desc`) with
`assignments: { include: { employee: { select: { id, empId, name } } } }`. Filtering for the
grid (status + case-insensitive `q` over name/code/client) and pill counts are computed in JS
from that single fetch — the project set is small.

Layout (inside the standard `<PageHeader>` + `p-8 space-y-6` shell; "+ Add project" stays in the
header for `canWrite`):

1. **Stat tiles** — `grid grid-cols-2 lg:grid-cols-4 gap-4`: Total · Active · People assigned ·
   Avg team size (`StatCard`, tones brand/emerald/blue/amber, relevant lucide icons).
2. **Filter bar** (`ProjectFilters`, client) — `Segmented` status pills
   **All · Active · On Hold · Completed**, each label carrying its live count (e.g. "Active 7"),
   plus a debounced search input (name / code / client). Updates `?status=` / `?q=` and re-syncs
   from the URL (mirrors `EmployeeSearch`). Pills sit in chrome (a `Card` body or bare row), never
   behind data.
3. **Card grid** — `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5` (no fixed min-width →
   never overflows). Each **project card** (`ProjectCard`):
   - top row: `code` (mono `.nums`) + status `Chip` (existing `statusChipCls` tones)
   - name (link → `/hr/projects/{id}`, brand hover) + client (muted, "—" if none)
   - timeline: `start → end` dates (`.nums`) + `ProgressBar` from `projectTimeline` + its label
   - footer: `AvatarStack` of assignment employee names (max 5) + "**N people**" headcount; if 0,
     a muted "No team yet". `lift` on hover.
   - Whole card is `Card`-based; the title link is the primary affordance.
4. **Empty states:** no projects at all → existing `EmptyState`. Projects exist but the filter
   matches none → a lighter inline "No projects match these filters" with a clear-filters link.

### `ProjectFilters` (`src/components/hr/ProjectFilters.tsx`, client)
Mirrors `EmployeeSearch`'s URL-sync pattern but uses `Segmented` for status. Props: `counts`
(`{ all, ACTIVE, ON_HOLD, COMPLETED }`) so pills show counts. Debounce search ~300ms; status
change applies immediately. Pushes to `/hr/projects?{status,q}`.

### `ProjectCard` (`src/components/hr/ProjectCard.tsx`, server component)
Pure presentational; receives a typed project-with-assignments + the computed timeline. Extracted
for readability (keeps the page RSC lean).

## Detail page — `/hr/projects/[id]/page.tsx` (RSC)

Same data fetch as today (project + assignments + employee), plus `assignableEmployees` for
`canWrite`. Layout:

1. **Header card** — project name/code already in `PageHeader` (Back + Edit retained). A summary
   `Card`: status `Chip`, client, the **timeline ProgressBar** + label, and the date range.
2. **Stat tiles** — `grid grid-cols-2 lg:grid-cols-4 gap-4`: Team size · Total allocation ·
   Duration (days) · Roles (`StatCard`).
3. **Team composition** (replaces the `min-w-[600px]` table) — a `Card` titled "Team"
   (`{n} assigned`). Each assignment is a **responsive row** (`flex flex-wrap` / grid that stacks
   on narrow widths, never horizontal-scrolls):
   - `Avatar` (employee name) + name (link → `/hr/employees/{id}`) + `empId` (mono)
   - role `Chip` (or "—")
   - allocation: `ProgressBar value={allocationPct}` + "{n}%" (or "—")
   - `start → end` dates (`.nums`)
   - `RemoveAssignmentButton` (only `canWrite`)
   Empty → "No employees assigned yet."
   `AssignEmployeeForm` retained (unchanged behavior) below the list for `canWrite`.

Extracted helper component `ProjectTeamRow` (server) if the page gets long; otherwise inline.

## Files

**Created**
- `src/lib/hr-projects.ts` — `projectTimeline`, `projectStats`, `assignmentStats`, shared types.
- `src/components/hr/ProjectFilters.tsx` — client status pills + search.
- `src/components/hr/ProjectCard.tsx` — list card (server).

**Modified**
- `src/components/ui.tsx` — add `Avatar`, `AvatarStack`.
- `src/app/(erp)/hr/projects/page.tsx` — stat tiles + filters + card grid.
- `src/app/(erp)/hr/projects/[id]/page.tsx` — summary + stat tiles + responsive team list.

**Untouched:** Prisma schema/migrations, all `/api/*` routes, `ProjectForm`,
`AssignEmployeeForm`, `RemoveAssignmentButton` (behavior), RBAC sets.

## Non-goals (YAGNI)

- No `percentComplete`/budget/photo fields (no migration).
- No new API endpoints, no Gantt/calendar, no DnD, no per-project analytics forecast.
- No changes to create/edit project forms or assignment mutation logic.

## Verification

- `npm run build` (full type-check) — must pass.
- `npm run lint` — must pass.
- Manual: list at desktop + narrow widths (no horizontal scroll); pills filter + counts correct;
  search filters; card avatars/headcount correct; detail summary, stat tiles, responsive team
  rows, assign/remove still work; manager (read-only) sees no mutate controls; empty/zero-date
  projects render the neutral timeline state.
- Edge cases: project with no dates, no client, no assignments; assignment with null
  role/allocation; long names (truncation); many assignees (+N counter).
