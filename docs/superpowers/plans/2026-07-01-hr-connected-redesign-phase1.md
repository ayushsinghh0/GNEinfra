# HR "Connected" Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill horizontal scrolling and broken cross-linking across the HR module by adding 6 shared primitives, then rebuilding the employee page into a linked 360 hub, converting attendance to a calendar heatmap, making all lists responsive, and making the dashboard clickable.

**Architecture:** Foundation-first. Add reusable primitives to `src/components/ui.tsx` + a status registry and a filter helper in `src/lib/`, so consistency is structural. Then each HR page composes those primitives. The employee page becomes a Next.js App Router **route-tab hub** (`/hr/employees/[id]/{overview,attendance,assets,projects,payroll}`) with a persistent identity header; list pages (attendance/assets/payout/projects) gain an `employeeId` filter so the hub can deep-link into them. Data model is unchanged (relations already exist).

**Tech Stack:** Next.js 16 (App Router, async `params`/`searchParams`), React 19, TypeScript, Tailwind v4, Prisma 6, lucide-react. No new dependencies. Bespoke SVG only.

## Global Constraints

- **No test runner exists.** Per `CLAUDE.md` the verification gates are `npm run lint` + `npm run build` (full type-check) + runtime smoke. This plan's "test" steps use that loop: quick type-check `npx tsc --noEmit`, then `npm run lint`, then smoke the route in `npm run dev` on seeded data (`npm run db:seed:demo`), then `npm run build` before commit. If `.next` type-cache goes stale referencing a removed route, `rm -rf .next` and rebuild.
- **Soft-Wave guardrails:** light-mode only; brand atmosphere (glow/gradient/grain/dots/waves) only in chrome (heroes/headers/empty states), **never behind data tables or form fields**; motion gated on `prefers-reduced-motion`; bespoke SVG only — **no chart/animation/table libraries**; `.nums` on codes/money/dates/%/counts; 16px inputs; 44px tap targets; `:focus-visible` rings; Sora (`font-display`) for headings only, Plus Jakarta Sans body, Geist Mono for codes/IDs.
- **RBAC unchanged, re-verified per route:** every HR page/route `requirePageRole(HR_VIEW)`; `canWrite = HR_WRITE.includes(viewer.role)` gates all mutations in UI **and** every mutating API; **managers are read-only**; guards reject `mustChangePassword`. New routes do the same.
- **Money is integer rupees;** payslip totals server-computed via `computePayrollTotals` (untouched in Phase 1).
- **Migrations:** Phase 1 needs **none** (all relations exist). Do not touch `prisma/schema.prisma`.
- **URL filter convention:** `?q=&status=&category=&location=&month=&sort=&page=` + scoped `?employeeId=`. RSC pages read `searchParams`, drive Prisma `where`; controls push URLs.
- **Preserve the live URL** `/hr/employees/[id]` — it becomes the Overview index route of the hub; verify all inbound links still resolve.

---

## File Structure

**New files**
- `src/lib/hr-status.ts` — status→tone registry (all HR + vendor enums).
- `src/lib/hr-filters.ts` — parse/serialize the URL filter convention.
- `src/components/DataTable.tsx` — generic responsive table (column-priority + card fallback + RowLink + states + sort) and `TableScroll` (sticky/scroll-shadow shell for the rare wide grid).
- `src/components/hr/AttendanceCalendar.tsx` — 7-column month calendar heatmap (single + small-multiples).
- `src/app/(erp)/hr/layout.tsx` — HR shell (breadcrumbs).
- `src/app/(erp)/hr/employees/[id]/layout.tsx` — profile hub shell (header + snapshot + tabs).
- `src/components/hr/ProfileHeader.tsx`, `src/components/hr/SnapshotStrip.tsx`, `src/components/hr/EmployeeTabs.tsx` — hub chrome.
- `src/app/(erp)/hr/employees/[id]/attendance/page.tsx`, `.../assets/page.tsx`, `.../projects/page.tsx`, `.../payroll/page.tsx` — hub tabs.

**Modified files**
- `src/components/ui.tsx` — add `StatusChip`, `EntityLink`, `Breadcrumbs`, `KeyValue`, `DetailSection`, `ErrorState`; extend `StatCard` (href), `PageHeader` (breadcrumb slot).
- `src/app/globals.css` — sticky-offset CSS variables.
- `src/app/(erp)/layout.tsx` — remove `overflow-x-hidden`.
- `src/lib/nav.tsx` — group HR nav; add Analytics.
- `src/components/Sidebar.tsx` — generic active-state.
- `src/app/(erp)/hr/employees/[id]/page.tsx` — becomes Overview tab (KeyValue sections + linked related summaries).
- `src/app/(erp)/hr/{attendance,assets,payout,projects}/page.tsx` — add `employeeId` filter + "Filtered to X" chip.
- `src/components/hr/AttendanceGrid.tsx` — heatmap default, metric/tone/tally fixes, EntityLink names.
- `src/app/(erp)/hr/employees/page.tsx`, `assets/page.tsx`, `projects/page.tsx` — adopt `DataTable`.
- `src/app/(erp)/hr/page.tsx`, `src/components/hr/{CompositionBoard,TrendBoard}.tsx`, `src/components/Charts.tsx` — clickable KPIs/bars, extract `BarList`.

---

# FOUNDATION TASKS (build first — everything depends on these)

## Task 1: Sticky-offset tokens + un-clip the shell

**Files:**
- Modify: `src/app/globals.css` (`:root` block)
- Modify: `src/app/(erp)/layout.tsx:15`

**Interfaces:**
- Produces: CSS vars `--h-topbar` (mobile top bar height) and `--h-header` (PageHeader height) for use as `top-[var(--h-header)]` sticky offsets.

- [ ] **Step 1: Add tokens.** In `src/app/globals.css`, inside the existing `:root { … }`, add:

```css
  /* Sticky-stack offsets (compose all sticky top-* from these) */
  --h-topbar: 3.5rem;   /* mobile app bar (pt-14) */
  --h-header: 4rem;     /* PageHeader h-16 */
```

- [ ] **Step 2: Un-clip `<main>`.** In `src/app/(erp)/layout.tsx`, change line 15 from `… min-w-0 overflow-x-hidden pt-14 …` to remove `overflow-x-hidden` (keep `min-w-0`):

```tsx
      <main className="flex min-h-dvh flex-1 flex-col min-w-0 pt-14 md:pt-0">{children}</main>
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit` (pass) → `npm run dev`, open `/hr` and confirm no page-wide horizontal scrollbar appears and existing tables still render. (They will still self-scroll until Task 7/11 — that's fine.)
- [ ] **Step 4: Commit.**

```bash
git add src/app/globals.css "src/app/(erp)/layout.tsx"
git commit -m "feat(hr): sticky-offset tokens; stop clipping wide content in shell"
```

---

## Task 2: Status registry + `StatusChip`

**Files:**
- Create: `src/lib/hr-status.ts`
- Modify: `src/components/ui.tsx` (add `StatusChip`)
- Modify: `src/components/Badge.tsx` (delegate to registry)

**Interfaces:**
- Produces: `statusMeta(status: string): { label: string; chip: string; dot: string }` and `<StatusChip status={string} className?/>`. `chip` is a `bg-*/text-*` pair; semantics: present/active/approved=emerald, pending/leave/sick/half-day/under-review=amber, absent/rejected=rose, holiday/week-off/inactive=slate, informational=sky/violet.

- [ ] **Step 1: Create the registry.** `src/lib/hr-status.ts`:

```ts
// Single source of truth for status → tone across HR (and vendor) enums.
// Static class strings only (Tailwind can't see interpolated names).
type Tone = { label: string; chip: string; dot: string };

const T = {
  emerald: (label: string): Tone => ({ label, chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" }),
  amber:   (label: string): Tone => ({ label, chip: "bg-amber-50 text-amber-700",   dot: "bg-amber-500" }),
  rose:    (label: string): Tone => ({ label, chip: "bg-rose-50 text-rose-700",     dot: "bg-rose-500" }),
  slate:   (label: string): Tone => ({ label, chip: "bg-slate-100 text-slate-600",  dot: "bg-slate-400" }),
  sky:     (label: string): Tone => ({ label, chip: "bg-sky-50 text-sky-700",       dot: "bg-sky-500" }),
  violet:  (label: string): Tone => ({ label, chip: "bg-violet-50 text-violet-700", dot: "bg-violet-500" }),
};

const REGISTRY: Record<string, Tone> = {
  // Attendance
  PRESENT: T.emerald("Present"), ABSENT: T.rose("Absent"), LEAVE: T.amber("Leave"),
  SICK: T.amber("Sick"), HALF_DAY: T.sky("Half-day"), HOLIDAY: T.violet("Holiday"),
  WEEK_OFF: T.slate("Week-off"),
  // Employee
  ACTIVE: T.emerald("Active"), INACTIVE: T.slate("Inactive"),
  // Project + assignment
  PLANNED: T.sky("Planned"), ON_HOLD: T.amber("On hold"), COMPLETED: T.slate("Completed"),
  // Vendor
  INVITED: T.slate("Invited"), SUBMITTED: T.sky("Submitted"),
  UNDER_REVIEW: T.amber("Under review"), APPROVED: T.emerald("Approved"), REJECTED: T.rose("Rejected"),
  // Payroll (client-side states)
  DRAFT: T.slate("Draft"), UNSAVED: T.amber("Unsaved"), SAVED: T.emerald("Saved"),
};

export function statusMeta(status: string): Tone {
  return REGISTRY[status] ?? T.slate(status.replace(/_/g, " "));
}
```

Note: confirm the exact `Project`/`ProjectAssignment` status enum values against `prisma/schema.prisma` and `src/lib/hr-validation.ts` (`PROJECT_STATUSES`); add `ACTIVE`/`ARCHIVED` etc. as they appear — keep every enum value mapped so nothing falls through to grey.

- [ ] **Step 2: Add `StatusChip` to `ui.tsx`** (after `Chip`):

```tsx
import { statusMeta } from "@/lib/hr-status";

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const m = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", m.chip, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden="true" />
      {m.label}
    </span>
  );
}
```

- [ ] **Step 3: Delegate `Badge.tsx`.** Refactor `src/components/Badge.tsx` so its vendor/invite mapping calls `statusMeta` (keep its existing prop signature/exports so current callers compile). Confirm no visual regression on `/scm/vendors`.
- [ ] **Step 4: Verify.** `npx tsc --noEmit` + `npm run lint` pass; `npm run dev` → `/scm/vendors` badges unchanged.
- [ ] **Step 5: Commit.**

```bash
git add src/lib/hr-status.ts src/components/ui.tsx src/components/Badge.tsx
git commit -m "feat(hr): shared status→tone registry + StatusChip; Badge delegates to it"
```

---

## Task 3: `EntityLink`

**Files:** Modify `src/components/ui.tsx`.

**Interfaces:**
- Consumes: `Avatar` (existing), `cn`.
- Produces: `<EntityLink href={string} name={string} code?={string} icon?={ReactNode} avatar?={boolean} className?/>` — a clickable identity cell used in every list/detail/related panel.

- [ ] **Step 1: Add the component** (needs `next/link` — import at top of `ui.tsx`):

```tsx
import Link from "next/link";
// …
export function EntityLink({
  href, name, code, icon, avatar = true, className,
}: { href: string; name: string; code?: string; icon?: React.ReactNode; avatar?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 min-w-0", className)}>
      {icon ? <span className="shrink-0 text-slate-400">{icon}</span> : avatar ? <Avatar name={name} size="sm" /> : null}
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-800 group-hover:text-brand-700">{name}</span>
        {code && <span className="nums block truncate font-mono text-[11px] text-slate-400">{code}</span>}
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Verify.** `npx tsc --noEmit` passes.
- [ ] **Step 3: Commit.** `git add src/components/ui.tsx && git commit -m "feat(hr): EntityLink primitive"`

---

## Task 4: Linkable `StatCard`

**Files:** Modify `src/components/ui.tsx` (`StatCard`).

**Interfaces:**
- Produces: `StatCard` gains optional `href?: string`. When set, the tile renders as a `next/link` (keeps `.lift` hover, 44px, focus ring) and shows a subtle "→" affordance.

- [ ] **Step 1: Extend `StatCard`.** Add `href?: string` to the prop type. Extract the current tile body into a `const inner = (…)`. Return:

```tsx
  const cls = cn(cardCls, "lift p-5", href && "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40", className);
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
```

Keep everything else identical. (`Link` already imported in Task 3.)

- [ ] **Step 2: Verify.** `npx tsc --noEmit` + existing dashboards (`/hr`) still render (no `href` = unchanged).
- [ ] **Step 3: Commit.** `git commit -am "feat(hr): StatCard optional href (linkable KPI)"`

---

## Task 5: `Breadcrumbs` + `PageHeader` breadcrumb slot

**Files:** Modify `src/components/ui.tsx`; add a label map next to `src/lib/nav.tsx`.

**Interfaces:**
- Produces: `<Breadcrumbs items={{label: string; href?: string}[]} />` (last item inert). `PageHeader` gains optional `breadcrumbs?: {label,href?}[]` rendered above the title row.

- [ ] **Step 1: Add `Breadcrumbs`** to `ui.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-slate-500 min-w-0">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
          {it.href && i < items.length - 1
            ? <Link href={it.href} className="truncate hover:text-brand-700">{it.label}</Link>
            : <span className="truncate font-medium text-slate-700" aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add breadcrumb slot to `PageHeader`.** Change `PageHeader` to accept `breadcrumbs?: { label: string; href?: string }[]`. When present, render a two-row header: a slim breadcrumb row above the existing title/actions row, and change the sticky offset to use the token: `sticky top-[var(--h-topbar)] md:top-0`. Keep the single-row layout when `breadcrumbs` is absent (backward compatible).
- [ ] **Step 3: Verify.** `npx tsc --noEmit`; existing pages (no `breadcrumbs`) render unchanged.
- [ ] **Step 4: Commit.** `git commit -am "feat(hr): Breadcrumbs primitive + PageHeader breadcrumb slot"`

---

## Task 6: `KeyValue` + `DetailSection`

**Files:** Modify `src/components/ui.tsx`.

**Interfaces:**
- Produces: `<KeyValue items={{ label: string; value: React.ReactNode; mono?: boolean }[]} cols?={1|2} />` (responsive description list) and `<DetailSection title icon? action? children/>` (wraps `Card`+`CardHeader`).

- [ ] **Step 1: Add both.** `KeyValue` renders a `grid grid-cols-1 sm:grid-cols-2` (when `cols=2`) of muted-label / value pairs; value uses `.nums font-mono` when `mono`. `DetailSection` = `<Card><CardHeader title=… action=…/><CardBody>{children}</CardBody></Card>`. Full code:

```tsx
export function KeyValue({ items, cols = 2 }: { items: { label: string; value: React.ReactNode; mono?: boolean }[]; cols?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-0", cols === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b border-slate-100 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
          <dt className="w-40 shrink-0 text-[13px] font-medium text-slate-500">{it.label}</dt>
          <dd className={cn("text-sm text-slate-800", it.mono && "nums font-mono text-xs")}>{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function DetailSection({ title, icon, action, children }: { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return <Card><CardHeader title={title} action={action ?? icon} /><CardBody>{children}</CardBody></Card>;
}
```

- [ ] **Step 2: Verify + commit.** `npx tsc --noEmit`; `git commit -am "feat(hr): KeyValue + DetailSection primitives"`

---

## Task 7: `DataTable` (responsive) + `TableScroll` + `RowLink` + `ErrorState`

**Files:** Create `src/components/DataTable.tsx`; add `ErrorState` to `ui.tsx`.

**Interfaces:**
- Consumes: `thCls/tdCls/tdNumCls/theadRowCls/trCls`, `Card`, `EmptyState`, `cn`.
- Produces:
  - `type Column<T> = { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; align?: "left" | "right"; priority?: "always" | "md" | "lg" | "xl"; cardLabel?: string; titleInCard?: boolean; sortKey?: string }`
  - `<DataTable<T> rows={T[]} columns={Column<T>[]} rowKey={(row)=>string} href?={(row)=>string} empty={ReactNode} sort?={{key,dir}} sortHref?={(key)=>string} />` — renders a desktop `<table class="hidden sm:table">` with column-priority visibility, and a `<ul class="sm:hidden">` card fallback derived from the same columns. No horizontal scroll.
  - `<TableScroll ariaLabel={string} children/>` — the sticky/scroll-shadow shell for the rare genuinely-wide grid (used by attendance matrix fallback).
  - `<ErrorState title description? action?/>` in `ui.tsx`.

- [ ] **Step 1: Priority→class map + `DataTable`.** Create `src/components/DataTable.tsx`. **This is a SERVER component — do NOT add `"use client"`.** It has no client state; sorting and row-links are plain `<Link>`s, and `cell`/`href` are render functions passed from server-component pages (functions can't cross the server→client boundary, so a client DataTable would break every consumer). `TableScroll` is likewise a plain component (no server-only imports) so it can also be rendered inside the client `AttendanceGrid`.

```tsx
import * as React from "react";
import Link from "next/link";
import { ChevronRight, ArrowUpDown } from "lucide-react";
import { cn, Card, thCls, tdCls, tdNumCls, theadRowCls, trCls } from "@/components/ui";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  priority?: "always" | "md" | "lg" | "xl"; // when the column becomes visible
  cardLabel?: string;       // label used in the mobile card fallback
  titleInCard?: boolean;    // render as the card's title line
  sortKey?: string;         // enables a sortable header linking via sortHref
};

const VIS: Record<NonNullable<Column<unknown>["priority"]>, string> = {
  always: "", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  rows, columns, rowKey, href, empty, sort, sortHref,
}: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string;
  href?: (row: T) => string; empty: React.ReactNode;
  sort?: { key: string; dir: "asc" | "desc" }; sortHref?: (key: string) => string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      {/* Desktop / tablet: real table, priority-hidden columns, no horizontal scroll */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className={theadRowCls}>
            {columns.map((c) => (
              <th key={c.key} className={cn(thCls, c.align === "right" && "text-right", VIS[c.priority ?? "always"])}>
                {c.sortKey && sortHref ? (
                  <Link href={sortHref(c.sortKey)} className="inline-flex items-center gap-1 hover:text-slate-700"
                        aria-sort={sort?.key === c.sortKey ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    {c.header}<ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </Link>
                ) : c.header}
              </th>
            ))}
            {href && <th className={cn(thCls, "w-10")} aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row);
            return (
              <tr key={k} className={trCls}>
                {columns.map((c) => (
                  <td key={c.key} className={cn(c.align === "right" ? tdNumCls : tdCls, VIS[c.priority ?? "always"])}>
                    {href ? <RowLinkOverlay href={href(row)} label="Open" first={c === columns[0]} /> : null}
                    {c.cell(row)}
                  </td>
                ))}
                {href && (
                  <td className={cn(tdCls, "w-10 text-right")}>
                    <Link href={href(row)} className="text-slate-300 group-hover:text-brand-500" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: card list from the same columns */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => {
          const title = columns.find((c) => c.titleInCard) ?? columns[0];
          const rest = columns.filter((c) => c !== title && c.cardLabel);
          const body = (
            <Card className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">{title.cell(row)}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.cardLabel}</dt>
                    <dd className="truncate text-sm text-slate-700">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
          return <li key={rowKey(row)}>{href ? <Link href={href(row)} className="block">{body}</Link> : body}</li>;
        })}
      </ul>
    </>
  );
}

// Full-row click target: a stretched link behind the first cell (keyboard-focusable).
function RowLinkOverlay({ href, label, first }: { href: string; label: string; first: boolean }) {
  if (!first) return null;
  return <Link href={href} aria-label={label} className="absolute inset-0 z-0" tabIndex={-1} />;
}

export function TableScroll({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={ariaLabel} tabIndex={0}
         className="tablescroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}
```

Note: `trCls` already sets `group relative`, so the stretched `RowLinkOverlay` works and cells needing their own links must add `relative z-10` (the `EntityLink`/action cells) to sit above the overlay. Document this in a comment.

- [ ] **Step 2: Scroll-shadow CSS.** In `globals.css` add a `.tablescroll` background-gradient scroll-shadow (pure CSS, `background-attachment: local`) so users see when columns are clipped:

```css
.tablescroll {
  background:
    linear-gradient(to right, white 30%, rgba(255,255,255,0)) left / 40px 100% no-repeat local,
    linear-gradient(to left, white 30%, rgba(255,255,255,0)) right / 40px 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%, rgba(15,23,42,0.12), transparent) left / 14px 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, rgba(15,23,42,0.12), transparent) right / 14px 100% no-repeat scroll;
}
```

- [ ] **Step 3: Add `ErrorState` to `ui.tsx`** (mirror `EmptyState`, rose icon tint, optional `action`).
- [ ] **Step 4: Verify.** `npx tsc --noEmit` + `npm run lint`. (No consumer yet — smoke happens in Tasks 14–16.)
- [ ] **Step 5: Commit.**

```bash
git add src/components/DataTable.tsx src/components/ui.tsx src/app/globals.css
git commit -m "feat(hr): responsive DataTable (column-priority + card fallback + row-link), TableScroll, ErrorState"
```

---

## Task 8: `hr-filters` URL helper

**Files:** Create `src/lib/hr-filters.ts`.

**Interfaces:**
- Produces: `parseListParams(sp: Record<string,string|undefined>): { q?: string; status?: string; category?: string; location?: string; employeeId?: string; sort?: string; dir: "asc"|"desc"; page: number }` and `buildQuery(base: string, patch: Partial<…>): string` (serializes back to a URL, dropping empties).

- [ ] **Step 1: Implement** parse/serialize with sane defaults (`page=1`, `dir="asc"`), whitelisting `status`/`sort` values. Pure functions, no React.
- [ ] **Step 2: Sanity-check** (no test runner): create a throwaway `scratch.ts` and run `npx tsx scratch.ts` asserting a couple of round-trips (`buildQuery("/hr/employees", parseListParams({status:"ACTIVE"}))` contains `status=ACTIVE`), then delete it.
- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit`; `git add src/lib/hr-filters.ts && git commit -m "feat(hr): URL list-filter parse/serialize helper"`

---

# APPLICATION TASKS

## Task 9: HR shell layout + nav grouping + generic active-state

**Files:**
- Create: `src/app/(erp)/hr/layout.tsx`
- Modify: `src/lib/nav.tsx` (group HR; add Analytics), `src/components/Sidebar.tsx` (generic active detection).

**Interfaces:**
- Consumes: `Breadcrumbs` (Task 5).
- Produces: an HR-wide breadcrumb region; grouped HR nav.

- [ ] **Step 1: HR layout.** Create `src/app/(erp)/hr/layout.tsx` as a **server** component that renders `{children}` (breadcrumbs are page-level via `PageHeader breadcrumbs=…`, so the layout stays thin — its job is to be the anchor for future HR-wide context and to allow per-segment metadata). Minimal:

```tsx
export const dynamic = "force-dynamic";
export default function HrLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

(Breadcrumb *data* is page-specific, so it's passed to each page's `PageHeader`. The layout exists so nav grouping/active-state and future shared HR chrome have a home.)

- [ ] **Step 2: Group HR nav.** In `src/lib/nav.tsx`, restructure the `HR` section. Since `NavSection` is `{heading, items}`, either (a) split HR into 3 sections (People / Operations / Insights) for HR-role users, or (b) add subgroup support. Simplest on-system change: keep one `NavSection` but reorder items as Dashboard, Analytics, Employees, Attendance, Payout, Assets, Projects, and add `{ label: "Analytics", href: "/hr/analytics", icon: LineChart }` (import `LineChart`). Confirm `/hr/analytics` exists and renders; if it only redirects to `/hr`, either wire a real analytics view or point the item at `/hr`. Keep "Soon" items last.
- [ ] **Step 3: Generic active-state.** In `src/components/Sidebar.tsx` (~lines 33–35) replace the hard-coded literal list with: active if `pathname === item.href` (department/overview homes) OR `pathname.startsWith(item.href + "/")` (sub-routes), computed from the nav config so every route highlights an ancestor (fixes the orphaned `/hr/analytics` no-highlight bug).
- [ ] **Step 4: Verify.** `npx tsc --noEmit` + `npm run lint`; `npm run dev` → sign in as HR; confirm grouped nav, Analytics reachable + highlighted, no console errors.
- [ ] **Step 5: Commit.** `git commit -am "feat(hr): HR shell layout, grouped nav + Analytics, generic sidebar active-state"`

---

## Task 10: Employee-scoped filters on list pages

**Files:** Modify `src/app/(erp)/hr/{attendance,assets,payout,projects}/page.tsx`.

**Interfaces:**
- Consumes: `parseListParams` (Task 8), `EntityLink`/`Chip`.
- Produces: each list page accepts `?employeeId=` (and where noted its own scope param); when present it filters the query and renders a dismissible "Filtered to *Name*" chip linking back to the employee. These are the deep-link targets for the hub (Task 13).

- [ ] **Step 1: Attendance.** In `attendance/page.tsx`, extend `searchParams` type with `employeeId?: string`. When present: narrow the `employees` query to that one employee (`where: { id: employeeId }`) and add a "Filtered to <name> · Clear" chip in the header linking to `/hr/attendance?year=&month=` (no employeeId). The grid then shows just that person (heatmap from Task 11).
- [ ] **Step 2: Assets.** In `assets/page.tsx`, add `?employeeId=` → `where.employeeId = employeeId`; render the filter chip. (Assets adopts `DataTable` in Task 15; here just wire the filter + chip.)
- [ ] **Step 3: Payout.** In `payout/page.tsx`, add `?employeeId=` → limit the rendered payroll list to that employee for the period; filter chip.
- [ ] **Step 4: Projects.** In `projects/page.tsx`, add `?employeeId=` → filter to projects where the employee has an assignment; filter chip.
- [ ] **Step 5: Verify.** `npm run dev`; manually hit `/hr/attendance?employeeId=<seeded id>`, `/hr/assets?employeeId=…`, `/hr/payout?employeeId=…`, `/hr/projects?employeeId=…` — each shows only that employee's data + a working Clear chip. `npx tsc --noEmit` + build pass.
- [ ] **Step 6: Commit.** `git commit -am "feat(hr): employeeId-scoped views on attendance/assets/payout/projects with filter chip"`

---

## Task 11: Attendance calendar heatmap

**Files:** Create `src/components/hr/AttendanceCalendar.tsx`; modify `src/components/hr/AttendanceGrid.tsx` and `src/app/(erp)/hr/attendance/page.tsx`.

**Interfaces:**
- Consumes: `STATUS` map (already in `AttendanceGrid`) — extract it to a shared const or import from `hr-status`; `TableScroll` (Task 7) for the optional matrix.
- Produces: `<AttendanceCalendar employeeId year month daysInMonth cells={Record<day,status>} canWrite onPaint?/>` rendering a 7-column month grid.

- [ ] **Step 1: Build `AttendanceCalendar`.** A client component: compute a leading offset so day 1 sits under its weekday (reuse the `dow` logic from `AttendanceGrid.tsx:69`), render `grid grid-cols-7`; a weekday header row (`S M T W T F S`); each day = an `aspect-square`/`h-11` cell colored via the status map, showing the day number (`.nums`, corner) + status code glyph, today-ring, weekend muting; `HALF_DAY` rendered as a small inline SVG diagonal split (two triangles) — bespoke SVG, no lib. Cell is a `<button>` (44px hit area) carrying `aria-label={`Day N: <label>`}`; wire `onPointerDown/onPointerEnter` to the existing paint handlers when `canWrite`.
- [ ] **Step 2: Make it the default in `AttendanceGrid`.** Refactor `AttendanceGrid.tsx`:
  - When a single employee is selected (existing pill/selection logic), render `AttendanceCalendar` for that employee instead of a 31-column row.
  - Default org view: render **small-multiples** — a responsive `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` of compact per-employee calendars (each ~120px), employee name as an `EntityLink` to `/hr/employees/[id]`. Keep the existing search to filter which employees show.
  - Add an optional "Table view" toggle (`Segmented`) that renders the old matrix wrapped in `TableScroll` with the P/½/L/A totals column made `sticky right-0` (bespoke, opt-in for power users).
  - **Fixes:** `totals.unmarked` counts only elapsed working days (exclude weekends + `day > today` in the current month); the Absent `StatCard` currently uses `tone="amber"`, which clashes with the rose used for Absent in the grid — add a `rose` entry to `STAT_TONES` in `ui.tsx` and set the Absent tile to `tone="rose"` so the summary matches the grid legend; tally **all 7** statuses in the per-employee summary (not just P/½/L/A); read-only viewers get a static legend (not disabled buttons); add day-header click-to-fill for HOLIDAY/WEEK_OFF in the matrix view. Replace the no-match `<p>` with `EmptyState`.
- [ ] **Step 3: Page wiring.** `attendance/page.tsx` already passes `employees/initial/year/month`. With Task 10's `employeeId` filter, a scoped visit shows exactly one calendar. Confirm the `key={`${y}-${m}`}` remount still resets state.
- [ ] **Step 4: Verify.** `npm run dev` → `/hr/attendance`: org view is small-multiples (no horizontal scroll); selecting/filtering one employee shows their month calendar; painting still saves (POST `/api/hr/attendance`); `/hr/attendance?employeeId=…` shows one calendar; read-only role (seed a MANAGER) sees legend, no toolbar, no save bar; "Unmarked" looks sane early in a month. `npx tsc --noEmit` + build pass. **Adversarial check:** confirm save still sends correct `{year,month,entries,clears}` and cross-month state can't leak (the remount key).
- [ ] **Step 5: Commit.** `git commit -am "feat(hr): attendance calendar heatmap (single + small-multiples), kill horizontal scroll, fix metrics/tone/tally"`

---

## Task 12: Employee-360 hub shell (layout + header + snapshot + tabs) + Overview tab

**Files:**
- Create: `src/app/(erp)/hr/employees/[id]/layout.tsx`, `src/components/hr/ProfileHeader.tsx`, `src/components/hr/SnapshotStrip.tsx`, `src/components/hr/EmployeeTabs.tsx`.
- Modify: `src/app/(erp)/hr/employees/[id]/page.tsx` → Overview tab content (KeyValue sections + linked related summaries).

**Interfaces:**
- Consumes: `Breadcrumbs`, `PageHeader`, `KeyValue`, `DetailSection`, `StatusChip`, `EntityLink`, `Avatar`, `btn`, leave/attendance helpers (`hr-leave`).
- Produces: the hub shell; child tab pages (Task 13) render inside `{children}`.

- [ ] **Step 1: Dedupe the employee fetch.** Create a cached loader so layout + page don't double-query: `export const getEmployee = cache(async (id: string) => prisma.employee.findUnique({ where: {id}, include: {...} }))` (React `cache`), in a small `src/app/(erp)/hr/employees/[id]/_data.ts`. Include counts needed by the header/snapshot (`assets`, `projectAssignments`, latest payroll period).
- [ ] **Step 2: `ProfileHeader`.** Sticky identity band (`sticky top-[var(--h-header)] z-10`, white, bottom border — **no atmosphere**): `Avatar` (lg), name (Sora), EMP-ID mono + designation + location, `StatusChip status={emp.status}`, and action cluster (`Edit` link + `⋯` menu placeholder for quick actions). Manager (`reportingManager` if present) rendered as text (no relation to link yet).
- [ ] **Step 3: `SnapshotStrip`.** A row of small linking chips below the header: `Tenure {years}`, `CL {remaining} left` / `SL {remaining}`, `{assets.count} assets`, `{active projects} projects`, `Last pay {month}`. Each chip is a `Link` to its tab (`/hr/employees/[id]/attendance`, `/assets`, `/projects`, `/payroll`). Compute in the layout (server) via `getEmployee` + `leaveBalances`.
- [ ] **Step 4: `EmployeeTabs`.** Client component using `usePathname`: tabs `Overview | Attendance | Assets | Projects | Payroll` → hrefs `/hr/employees/[id]`, `/…/attendance`, etc.; active = pathname match; pill/underline style consistent with `SectionNav`; `aria-current`. Permission note: all HR_VIEW roles see all tabs in Phase 1 (field-level masking deferred); keep the tab config an array so gating can be added later.
- [ ] **Step 5: `layout.tsx`.** Server component: `await requirePageRole(HR_VIEW)`; `const emp = await getEmployee(id)`; if `!emp` → `notFound()`. Render `PageHeader` with `breadcrumbs={[{label:"HR",href:"/hr"},{label:"Employees",href:"/hr/employees"},{label:emp.name}]}` and the Edit/Back actions; then `<ProfileHeader/>`, `<SnapshotStrip/>`, `<EmployeeTabs/>`, then `<div className="p-8">{children}</div>`.
- [ ] **Step 6: Overview tab (`page.tsx`).** Replace the current `TabbedSections` page with the **Overview** only: grouped `KeyValue`/`DetailSection` blocks (Identity & Role, Contact & Personal, Compensation, Statutory & Leave) mirroring `EmployeeForm` grouping; plus compact **related summaries** (top 2–3 assets / projects / payslips as `EntityLink`/rows) each with a "View all →" to the corresponding tab. Every project/asset/payslip reference is a link.
- [ ] **Step 7: Verify.** `npm run dev` → `/hr/employees/<id>`: header + snapshot chips + tabs render; Overview shows grouped details + linked related items; `/hr/employees/<id>/edit` still works; breadcrumbs navigate; inbound links from the employees list still land on Overview. `npx tsc --noEmit` + build pass (watch for the removed `TabbedSections` import — `rm -rf .next` if stale).
- [ ] **Step 8: Commit.** `git commit -am "feat(hr): employee-360 hub shell (header, snapshot, route-tabs) + Overview tab"`

---

## Task 13: Hub tabs — Attendance, Assets, Projects, Payroll

**Files:** Create `src/app/(erp)/hr/employees/[id]/{attendance,assets,projects,payroll}/page.tsx`.

**Interfaces:**
- Consumes: `getEmployee`/scoped queries, `AttendanceCalendar` (Task 11), `DataTable`/`KeyValue`/`EntityLink`, the module deep-links (Task 10).
- Produces: four tab pages, each a scoped summary + "View full in [module] →" deep-link.

- [ ] **Step 1: Attendance tab.** `attendance/page.tsx`: `requirePageRole(HR_VIEW)`; fetch this employee's current-month records + `attendanceYearSummary` + `leaveBalances`; render the year summary chips + leave balance cards (reuse the existing detail-page markup) + **this month as `AttendanceCalendar`** (read-only), plus a prominent `Link className={btn("secondary","sm")}` → `/hr/attendance?employeeId={id}&year=&month=` ("Open full attendance →").
- [ ] **Step 2: Assets tab.** `assets/page.tsx`: list this employee's assets as `DataTable` (or KeyValue cards) with the "Items issued" chip rendering; "Manage in asset register →" → `/hr/assets?employeeId={id}`. Consistent `EmptyState` when none.
- [ ] **Step 3: Projects tab.** `projects/page.tsx`: this employee's assignments as rows, **project name/code as `EntityLink`** → `/hr/projects/[id]` (fixes the dead-end); show role/allocation/dates; `AssignProjectForm` beneath for writers (unchanged in Phase 1); "View in projects →" → `/hr/projects?employeeId={id}`.
- [ ] **Step 4: Payroll tab.** `payroll/page.tsx`: this employee's payslips grouped by year, each row `Link` to `/hr/payout/[id]/print` (existing) with net pay `.nums`; "Open payout for {month} →" → `/hr/payout?employeeId={id}`.
- [ ] **Step 5: Verify.** `npm run dev`: click each tab; every deep-link lands on the correct pre-filtered module view (Task 10) and Back returns; project links now navigate. `npx tsc --noEmit` + build pass.
- [ ] **Step 6: Commit.** `git commit -am "feat(hr): employee hub tabs (attendance/assets/projects/payroll) with module deep-links"`

---

## Task 14: Employees list → `DataTable` (responsive)

**Files:** Modify `src/app/(erp)/hr/employees/page.tsx`.

**Interfaces:** Consumes `DataTable`, `EntityLink`, `StatusChip`, `parseListParams`.

- [ ] **Step 1: Replace the raw table** (lines 81–148) with `DataTable`. Column config:

```tsx
const columns: Column<Emp>[] = [
  { key: "emp", header: "Employee", titleInCard: true,
    cell: (e) => <span className="relative z-10"><EntityLink href={`/hr/employees/${e.id}`} name={e.name} code={e.empId} /></span> },
  { key: "designation", header: "Designation", cardLabel: "Designation", cell: (e) => e.designation ?? "—" },
  { key: "category", header: "Category", priority: "lg", cardLabel: "Category", cell: (e) => e.empCategory ?? "—" },
  { key: "location", header: "Location", priority: "lg", cardLabel: "Location", cell: (e) => e.location ?? "—" },
  { key: "doj", header: "DOJ", priority: "xl", cardLabel: "DOJ", cell: (e) => <span className="nums">{fmtDateOnly(e.dateOfJoining) ?? "—"}</span> },
  { key: "status", header: "Status", cell: (e) => <span className="relative z-10"><StatusChip status={e.status} /></span> },
];
```

Render `<DataTable rows={employees} columns={columns} rowKey={(e)=>e.id} href={(e)=>`/hr/employees/${e.id}`} empty={<EmptyState …/>} />`. Drop `min-w-[860px]`/`overflow-x-auto`/`colgroup`. Keep Export + Add in `PageHeader`; add `breadcrumbs`.

- [ ] **Step 2: Verify.** `npm run dev` → `/hr/employees`: no horizontal scroll at any width; resize narrow → cards; whole row opens the employee; status chips consistent. `npx tsc --noEmit` + build.
- [ ] **Step 3: Commit.** `git commit -am "feat(hr): responsive employees directory via DataTable (no horizontal scroll, row-link)"`

---

## Task 15: Assets register → `DataTable` + chips + status + KPI + SlideOver add

**Files:** Modify `src/app/(erp)/hr/assets/page.tsx`, `src/components/hr/AssetForm.tsx`, `src/components/hr/AssetRowActions.tsx`.

**Interfaces:** Consumes `DataTable`, `EntityLink`, `StatusChip`, `StatCard`, `SlideOver`.

- [ ] **Step 1: Collapse booleans + drop dup columns.** Replace the 15-column table. New columns: Employee (`EntityLink` → `/hr/employees/[id]`), **Items issued** (one cell rendering `Chip`s only for issued items: Laptop/Bag/Mouse/Charger/ID — a shared render helper so it matches the employee Assets tab), Serial/Make (mono), **Status** (`StatusChip` Allocated/Returned derived from `returnedAt`), Allocated date, actions. **Remove** Position/Mail ID/Location (now one click away via the employee link). Priority-tier the non-essential columns.
- [ ] **Step 2: KPI strip.** Add a `StatCard` row above the table: Total / Allocated / Returned / Unassigned-employees (compute from the same query).
- [ ] **Step 3: Add-form into `SlideOver`.** Move "Add asset record" out of the always-open card into a `SlideOver` triggered by a `PageHeader` button (mirror the edit flow). Remove the 3 read-only mirror fields in `AssetForm` (Position/Mail/Location) — replace with a compact selected-employee summary line.
- [ ] **Step 4: Status filter.** Add a `Segmented` (All / Allocated / Returned) writing `?status=` (URL-driven). Wire Task 10's `?employeeId=` chip.
- [ ] **Step 5: Verify.** `npm run dev` → `/hr/assets`: no horizontal scroll; booleans are chips; Allocated/Returned status + filter work; employee cell links; add via SlideOver; `?employeeId=` shows one person's kit. `npx tsc --noEmit` + build.
- [ ] **Step 6: Commit.** `git commit -am "feat(hr): responsive asset register (chips, status, KPIs, slide-over add), employee links"`

---

## Task 16: Projects list + detail roster → `DataTable`, whole-card click

**Files:** Modify `src/app/(erp)/hr/projects/page.tsx`, `src/app/(erp)/hr/projects/[id]/page.tsx`, `src/components/hr/ProjectCard.tsx`.

**Interfaces:** Consumes `DataTable`, `EntityLink`, `StatusChip`, `EmptyState`.

- [ ] **Step 1: Whole-card click.** In `ProjectCard.tsx`, make the entire card a link (stretched-link pattern) so code/client/timeline clicks open the project; keep avatar stack non-navigating.
- [ ] **Step 2: Detail roster → `DataTable`.** In `projects/[id]/page.tsx`, replace the hand-rolled flex-wrap `<ul>` team roster with `DataTable` (columns: Employee `EntityLink` → `/hr/employees/[id]`, Role, Allocation `ProgressBar`, Dates, actions/`RemoveAssignmentButton`), card fallback for mobile. Use `EmptyState` (not bare `<p>`) for the no-team case.
- [ ] **Step 3: List consistency.** Ensure `projects/page.tsx` uses `StatusChip` and consistent `EmptyState`; wire Task 10 `?employeeId=` chip.
- [ ] **Step 4: Verify.** `npm run dev` → `/hr/projects` (whole card clicks) and a project detail (roster is a clean responsive table, member names link to employees). `npx tsc --noEmit` + build.
- [ ] **Step 5: Commit.** `git commit -am "feat(hr): responsive project roster via DataTable, whole-card click, employee links"`

---

## Task 17: Clickable dashboard — extract `BarList`, linkable KPIs/bars

**Files:** Modify `src/app/(erp)/hr/page.tsx`, `src/components/Charts.tsx` (add `BarList`), `src/components/hr/CompositionBoard.tsx`, `src/components/hr/TrendBoard.tsx`.

**Interfaces:** Consumes `StatCard` (href, Task 4). Produces a shared `BarList`/`BarRow` with optional `href`.

- [ ] **Step 1: Extract `BarList`.** Add a single `BarList({ items }: { items: { label: string; value: number; max?: number; href?: string }[] })` to `Charts.tsx` (one bar height token). Replace the three duplicated inline implementations (in `page.tsx`, `CompositionBoard.tsx`, `TrendBoard.tsx`) with it. When `href` set, the row is a `Link` (hover accent).
- [ ] **Step 2: Linkable KPIs.** Give each dashboard `StatCard` an `href` deep-link: Active headcount → `/hr/employees?status=ACTIVE`; Present today → `/hr/attendance?...` (today's month); On leave today → attendance filtered; Payroll → `/hr/payout?year=&month=`; Attrition → employees leavers view. (Use the Task 8 query convention.)
- [ ] **Step 3: Linkable bars.** Composition/location/designation/category → `/hr/employees?<dim>=…`; project bars → `/hr/projects/[id]`.
- [ ] **Step 4: Promote nav + empty states.** Move the module quick-links above the fold (or rely on KPI links) and replace the three grey-text empty states with `EmptyState`.
- [ ] **Step 5: Verify.** `npm run dev` → `/hr`: KPIs and bars are clickable and land on the right filtered lists; no duplicated bar styling; `npx tsc --noEmit` + build pass.
- [ ] **Step 6: Commit.** `git commit -am "feat(hr): clickable dashboard KPIs + bars, shared BarList, better empty states"`

---

## Phase 1 completion gate

- [ ] `npm run lint` clean; `npm run build` passes (full type-check).
- [ ] Smoke on seeded data (`npm run db:seed:demo`): no horizontal scroll on `/hr/employees`, `/hr/assets`, `/hr/attendance`, `/hr/projects`; employee ↔ attendance/assets/projects/payroll round-trips work in one click each way; dashboard KPIs drill through; read-only MANAGER sees no write controls.
- [ ] Adversarial re-check: attendance save correctness (no cross-month leak), every new page calls `requirePageRole(HR_VIEW)`, no mutation reachable by MANAGER.
- [ ] Open a PR from `hr-connected-redesign` for review before merge to `multi-role-erp`.

---

## Self-review (spec coverage)

- Foundation F1–F8 → Tasks 1–8 ✓ (F7 SavedViewPills UI deferred to Phase 2 per spec; the parse/serialize helper lands in Task 8).
- P1.1 shell/nav → Task 9 ✓ · P1.2 scoped views → Task 10 ✓ · P1.3 hub → Tasks 12–13 ✓ · P1.4 heatmap → Task 11 ✓ · P1.5 lists → Tasks 14–16 ✓ · P1.6 dashboard → Task 17 ✓.
- Phases 2–3 (LOP, bulk payroll, Cmd-K, saved-view pills, polish/a11y) are **out of scope for this plan** — separate per-phase plans.
- No placeholders; interfaces (Column<T>, statusMeta, EntityLink, parseListParams) are named consistently across producing/consuming tasks.
