# Projects Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overflowing Projects list/detail tables with a responsive, single-screen experience — stat tiles, status pills, a project card grid with timeline + employee avatars, and a responsive team list — derived entirely from existing data.

**Architecture:** Pure presentational + data-derived. A new `src/lib/hr-projects.ts` computes timeline %, list stats, and per-project assignment stats from already-fetched Prisma data. Two new `ui.tsx` primitives (`Avatar`, `AvatarStack`) render initials-monograms. A client `ProjectFilters` drives `?status=`/`?q=` (mirrors `EmployeeSearch`). The list and detail RSC pages are rewritten to compose these.

**Tech Stack:** Next.js 16 App Router (RSC), Prisma, Tailwind v4 (`@theme` tokens), existing Soft-Wave primitives. No new dependencies.

## Global Constraints

- **NO database migration.** Only existing fields are read. Prisma schema untouched.
- **No new dependencies / no chart-animation libs.** Compose `Segmented`, `StatCard`, `Card`, `Chip`, `ProgressBar`, `PageHeader`, `EmptyState`, `btn`, `cn`, `inputCls`.
- **RBAC unchanged:** `requirePageRole(HR_VIEW)` to read; `canWrite = HR_WRITE.includes(viewer.role)` gates all mutate controls (managers read-only). No new/changed API routes.
- **Soft-Wave guardrails:** light-mode only; atmosphere only in chrome (never behind cards/data); motion gated on `prefers-reduced-motion` (using existing `lift`/`press` utilities only — no new keyframes); `.nums` on codes/dates/%/counts; 44px tap targets; `:focus-visible` rings.
- **ProgressBar tones** are only `brand | amber | emerald | blue` (no slate) → "no timeline" renders a bare `bg-slate-100` track; COMPLETED uses `emerald`.
- **Verification gates (this repo has no test runner):** `npm run build` (full type-check) + `npm run lint` must both pass. No fabricated test framework.

## File Structure

**Create**
- `src/lib/hr-projects.ts` — `projectTimeline`, `durationDays`, `projectStats`, `statusCounts`, `assignmentStats` + types. One responsibility: project-derived computations.
- `src/components/hr/ProjectFilters.tsx` — client: `Segmented` status pills (with counts) + debounced search; URL-driven.
- `src/components/hr/ProjectCard.tsx` — server: one project card (code, status, name, client, timeline bar, avatar cluster, headcount).

**Modify**
- `src/components/ui.tsx` — add `Avatar` + `AvatarStack` primitives.
- `src/app/(erp)/hr/projects/page.tsx` — stat tiles + filters + card grid.
- `src/app/(erp)/hr/projects/[id]/page.tsx` — summary + stat tiles + responsive team list (replaces 600px-min table).

**Untouched:** Prisma schema/migrations, all `/api/*`, `ProjectForm`, `AssignEmployeeForm`, `RemoveAssignmentButton`, RBAC sets, `Segmented`.

---

### Task 1: Project computation helpers (`src/lib/hr-projects.ts`)

**Files:** Create `src/lib/hr-projects.ts`

**Interfaces — Produces:**
- `type TimelineTone = "brand" | "amber" | "emerald" | "blue"`
- `type Timeline = { pct: number | null; label: string; tone: TimelineTone }`
- `projectTimeline(status: ProjectStatus, startDate: Date | null, endDate: Date | null, now?: Date): Timeline`
- `durationDays(startDate: Date | null, endDate: Date | null): number | null`
- `projectStats(projects: { status: ProjectStatus; assignments: { employeeId: string }[] }[]): { total; active; peopleAssigned; avgTeam }`
- `statusCounts(projects: { status: ProjectStatus }[]): { all; ACTIVE; ON_HOLD; COMPLETED }`
- `assignmentStats(assignments: { roleOnProject: string | null; allocationPct: number | null }[], startDate, endDate): { teamSize; totalAllocation; roleCount; durationDays }`

- [ ] **Step 1: Write the file**

```ts
import type { ProjectStatus } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;

export type TimelineTone = "brand" | "amber" | "emerald" | "blue";
export type Timeline = { pct: number | null; label: string; tone: TimelineTone };

/** Timeline progress from the start→end window. null pct = render an empty track. */
export function projectTimeline(
  status: ProjectStatus,
  startDate: Date | null,
  endDate: Date | null,
  now: Date = new Date(),
): Timeline {
  if (status === "COMPLETED") return { pct: 100, label: "Completed", tone: "emerald" };
  if (!startDate || !endDate) return { pct: null, label: "No timeline", tone: "brand" };
  const start = startDate.getTime();
  const end = endDate.getTime();
  const t = now.getTime();
  const tone: TimelineTone = status === "ON_HOLD" ? "amber" : "brand";
  if (end <= start) return { pct: t >= end ? 100 : 0, label: t >= end ? "Ended" : "Not started", tone };
  if (t < start) return { pct: 0, label: "Not started", tone };
  if (t > end) return { pct: 100, label: status === "ACTIVE" ? "Overdue" : "Ended", tone: "amber" };
  const pct = Math.round(((t - start) / (end - start)) * 100);
  return { pct, label: `${pct}% elapsed`, tone };
}

export function durationDays(startDate: Date | null, endDate: Date | null): number | null {
  if (!startDate || !endDate) return null;
  const d = Math.round((endDate.getTime() - startDate.getTime()) / DAY);
  return d >= 0 ? d : null;
}

export function projectStats(
  projects: { status: ProjectStatus; assignments: { employeeId: string }[] }[],
) {
  const total = projects.length;
  let active = 0;
  let totalAssignments = 0;
  const people = new Set<string>();
  for (const p of projects) {
    if (p.status === "ACTIVE") active++;
    for (const a of p.assignments) {
      people.add(a.employeeId);
      totalAssignments++;
    }
  }
  return { total, active, peopleAssigned: people.size, avgTeam: total ? Math.round(totalAssignments / total) : 0 };
}

export function statusCounts(projects: { status: ProjectStatus }[]) {
  const c = { all: projects.length, ACTIVE: 0, ON_HOLD: 0, COMPLETED: 0 };
  for (const p of projects) c[p.status]++;
  return c;
}

export function assignmentStats(
  assignments: { roleOnProject: string | null; allocationPct: number | null }[],
  startDate: Date | null,
  endDate: Date | null,
) {
  const teamSize = assignments.length;
  const totalAllocation = assignments.reduce((s, a) => s + (a.allocationPct ?? 0), 0);
  const roles = new Set(assignments.map((a) => a.roleOnProject).filter((r): r is string => !!r));
  return { teamSize, totalAllocation, roleCount: roles.size, durationDays: durationDays(startDate, endDate) };
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean for this file (full build runs in Task 6). Commit folded into Task 5/6.

---

### Task 2: `Avatar` + `AvatarStack` primitives (`src/components/ui.tsx`)

**Files:** Modify `src/components/ui.tsx` (append near `Chip`)

**Interfaces — Produces:**
- `Avatar({ name: string; size?: "sm" | "md"; className?: string })`
- `AvatarStack({ names: string[]; max?: number; size?: "sm" | "md" })`

**Consumes:** existing `cn` from same file.

- [ ] **Step 1: Append primitives** (tones are static class strings — Tailwind cannot see interpolated class names):

```tsx
/* ── Avatar (initials monogram) ─────────────────────────────────────────── */
const AVATAR_TONES = [
  "bg-brand-100 text-brand-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];
const AVATAR_SIZE = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs" } as const;

function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold select-none",
        AVATAR_SIZE[size],
        avatarTone(name),
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 5,
  size = "md",
}: {
  names: string[];
  max?: number;
  size?: "sm" | "md";
}) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-grid shrink-0 place-items-center rounded-full bg-slate-100 font-semibold text-slate-500 ring-2 ring-white",
            AVATAR_SIZE[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
```

---

### Task 3: `ProjectFilters` client component

**Files:** Create `src/components/hr/ProjectFilters.tsx`

**Consumes:** `Segmented` (default export, `src/components/Segmented.tsx`), `inputCls`/`cn` from `ui`.
**Produces:** default export `ProjectFilters({ counts: { all; ACTIVE; ON_HOLD; COMPLETED } })`.

- [ ] **Step 1: Write the component** (mirrors `EmployeeSearch` URL-sync; pills apply immediately, search debounced 300ms):

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, type FormEvent } from "react";
import { Search } from "lucide-react";
import { inputCls, cn } from "@/components/ui";
import Segmented from "@/components/Segmented";

type Status = "" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export default function ProjectFilters({
  counts,
}: {
  counts: { all: number; ACTIVE: number; ON_HOLD: number; COMPLETED: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStatus = (params.get("status") ?? "") as Status;

  const [q, setQ] = useState(urlQ);
  const [seen, setSeen] = useState(`${urlQ}|${urlStatus}`);
  if (seen !== `${urlQ}|${urlStatus}`) {
    setSeen(`${urlQ}|${urlStatus}`);
    setQ(urlQ);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(nextQ: string, nextStatus: Status) {
    const sp = new URLSearchParams();
    if (nextStatus) sp.set("status", nextStatus);
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    const qs = sp.toString();
    router.push(qs ? `/hr/projects?${qs}` : "/hr/projects");
  }
  function onQChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v, urlStatus), 300);
  }

  const options: { value: Status; label: string }[] = [
    { value: "", label: `All ${counts.all}` },
    { value: "ACTIVE", label: `Active ${counts.ACTIVE}` },
    { value: "ON_HOLD", label: `On Hold ${counts.ON_HOLD}` },
    { value: "COMPLETED", label: `Completed ${counts.COMPLETED}` },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Segmented
        ariaLabel="Filter projects by status"
        options={options}
        value={urlStatus}
        onChange={(v) => push(q, v)}
        size="sm"
      />
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          push(q, urlStatus);
        }}
        className="relative sm:w-72"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search name, code or client…"
          aria-label="Search projects"
          className={cn(inputCls, "pl-9")}
        />
      </form>
    </div>
  );
}
```

---

### Task 4: `ProjectCard` server component

**Files:** Create `src/components/hr/ProjectCard.tsx`

**Consumes:** `Card`, `Chip`, `AvatarStack`, `ProgressBar`, `cn` from `ui`; `projectTimeline` from `hr-projects`; `fmtDateOnly` from `format`.
**Produces:** default export `ProjectCard({ project })` where project has `{ id, name, code, client, status, startDate, endDate, assignments: { employee: { name } }[] }`.

- [ ] **Step 1: Write the component:**

```tsx
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { fmtDateOnly } from "@/lib/format";
import { Card, Chip, AvatarStack, ProgressBar } from "@/components/ui";
import { projectTimeline } from "@/lib/hr-projects";

type CardProject = {
  id: string;
  name: string;
  code: string;
  client: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  assignments: { employee: { name: string } }[];
};

function statusChipCls(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default function ProjectCard({ project }: { project: CardProject }) {
  const tl = projectTimeline(project.status, project.startDate, project.endDate);
  const names = project.assignments.map((a) => a.employee.name);
  const n = names.length;
  return (
    <Card className="lift flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="nums font-mono text-xs text-slate-500">{project.code}</span>
        <Chip className={statusChipCls(project.status)}>{project.status.replace(/_/g, " ")}</Chip>
      </div>
      <Link
        href={`/hr/projects/${project.id}`}
        className="mt-2 block truncate font-display text-base font-semibold text-slate-900 hover:text-brand-700"
      >
        {project.name}
      </Link>
      <p className="mt-0.5 truncate text-sm text-slate-500">{project.client ?? "—"}</p>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span className="nums">
            {fmtDateOnly(project.startDate) ?? "—"} → {fmtDateOnly(project.endDate) ?? "—"}
          </span>
          <span className="font-medium text-slate-600">{tl.label}</span>
        </div>
        {tl.pct === null ? (
          <div className="h-2 rounded-full bg-slate-100" />
        ) : (
          <ProgressBar value={tl.pct} tone={tl.tone} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        {n > 0 ? (
          <AvatarStack names={names} max={5} size="sm" />
        ) : (
          <span className="text-xs text-slate-400">No team yet</span>
        )}
        <span className="nums text-xs font-medium text-slate-500">
          {n} {n === 1 ? "person" : "people"}
        </span>
      </div>
    </Card>
  );
}
```

---

### Task 5: List page rewrite (`src/app/(erp)/hr/projects/page.tsx`)

**Files:** Modify (full rewrite) `src/app/(erp)/hr/projects/page.tsx`

**Consumes:** `projectStats`/`statusCounts` (Task 1), `ProjectFilters` (Task 3), `ProjectCard` (Task 4).

- [ ] **Step 1: Replace the file:**

```tsx
import Link from "next/link";
import { Briefcase, FolderKanban, CircleDot, Users, Gauge } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, StatCard, EmptyState, btn } from "@/components/ui";
import { projectStats, statusCounts } from "@/lib/hr-projects";
import ProjectFilters from "@/components/hr/ProjectFilters";
import ProjectCard from "@/components/hr/ProjectCard";

export const dynamic = "force-dynamic";

const VALID = new Set(["ACTIVE", "ON_HOLD", "COMPLETED"]);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { status, q } = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignments: { include: { employee: { select: { id: true, name: true } } } } },
  });

  const stats = projectStats(projects);
  const counts = statusCounts(projects);

  const statusFilter = status && VALID.has(status) ? status : "";
  const term = (q ?? "").trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (term && !`${p.name} ${p.code} ${p.client ?? ""}`.toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Projects" subtitle={`${projects.length} project(s)`}>
        {canWrite && (
          <Link href="/hr/projects/new" className={btn("primary", "sm")}>
            + Add project
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {projects.length === 0 ? (
          <Card className="overflow-hidden">
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="No projects yet"
              description="Add your first project to get started."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total projects" value={stats.total} tone="brand" icon={<FolderKanban className="h-4 w-4" />} />
              <StatCard label="Active" value={stats.active} tone="emerald" icon={<CircleDot className="h-4 w-4" />} />
              <StatCard label="People assigned" value={stats.peopleAssigned} tone="blue" icon={<Users className="h-4 w-4" />} />
              <StatCard label="Avg team size" value={stats.avgTeam} tone="amber" icon={<Gauge className="h-4 w-4" />} />
            </div>

            <Card>
              <div className="p-4">
                <ProjectFilters counts={counts} />
              </div>
            </Card>

            {filtered.length === 0 ? (
              <Card className="overflow-hidden">
                <EmptyState
                  icon={<Briefcase className="h-6 w-6" />}
                  title="No projects match these filters"
                  description="Try a different status or search term."
                  action={
                    <Link href="/hr/projects" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
```

---

### Task 6: Detail page rewrite (`src/app/(erp)/hr/projects/[id]/page.tsx`)

**Files:** Modify (full rewrite) `src/app/(erp)/hr/projects/[id]/page.tsx`

**Consumes:** `projectTimeline`/`assignmentStats` (Task 1), `Avatar` (Task 2).

- [ ] **Step 1: Replace the file:**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, CalendarRange, Layers, Gauge } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Chip,
  Avatar,
  ProgressBar,
  btn,
} from "@/components/ui";
import AssignEmployeeForm from "@/components/hr/AssignEmployeeForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";
import { projectTimeline, assignmentStats } from "@/lib/hr-projects";

export const dynamic = "force-dynamic";

function statusChipCls(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: {
        orderBy: { createdAt: "asc" },
        include: { employee: { select: { id: true, empId: true, name: true } } },
      },
    },
  });
  if (!project) notFound();

  const assignedIds = new Set(project.assignments.map((a) => a.employeeId));
  const assignableEmployees = canWrite
    ? (
        await prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, empId: true, name: true },
          orderBy: { name: "asc" },
        })
      ).filter((e) => !assignedIds.has(e.id))
    : [];

  const tl = projectTimeline(project.status, project.startDate, project.endDate);
  const stats = assignmentStats(project.assignments, project.startDate, project.endDate);

  return (
    <>
      <PageHeader title={project.name} subtitle={project.code}>
        <Link href="/hr/projects" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {canWrite && (
          <Link href={`/hr/projects/${id}/edit`} className={btn("primary", "sm")}>
            Edit
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={statusChipCls(project.status)}>{project.status.replace(/_/g, " ")}</Chip>
              <span className="text-sm text-slate-500">{project.client ?? "No client"}</span>
              <span className="nums ml-auto text-sm text-slate-600">
                {fmtDateOnly(project.startDate) ?? "—"} → {fmtDateOnly(project.endDate) ?? "—"}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>Timeline</span>
                <span className="font-medium text-slate-600">{tl.label}</span>
              </div>
              {tl.pct === null ? (
                <div className="h-2 rounded-full bg-slate-100" />
              ) : (
                <ProgressBar value={tl.pct} tone={tl.tone} />
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Team size" value={stats.teamSize} tone="brand" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Total allocation" value={`${stats.totalAllocation}%`} tone="blue" icon={<Gauge className="h-4 w-4" />} />
          <StatCard label="Duration" value={stats.durationDays != null ? `${stats.durationDays}d` : "—"} tone="amber" icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Roles" value={stats.roleCount} tone="emerald" icon={<Layers className="h-4 w-4" />} />
        </div>

        <Card>
          <CardHeader
            title="Team"
            subtitle={`${project.assignments.length} assigned`}
            action={<Users className="h-4 w-4 text-slate-400" />}
          />
          <CardBody>
            {project.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">No employees assigned to this project yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <Avatar name={a.employee.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/hr/employees/${a.employee.id}`}
                        className="block truncate font-medium text-slate-800 hover:text-brand-700"
                      >
                        {a.employee.name}
                      </Link>
                      <span className="nums font-mono text-xs text-slate-500">{a.employee.empId}</span>
                    </div>
                    <Chip className="bg-slate-100 text-slate-600">{a.roleOnProject ?? "—"}</Chip>
                    <div className="w-28">
                      {a.allocationPct != null ? (
                        <>
                          <div className="nums mb-1 text-right text-xs text-slate-500">{a.allocationPct}%</div>
                          <ProgressBar value={a.allocationPct} tone="brand" />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">— alloc</span>
                      )}
                    </div>
                    <span className="nums text-xs text-slate-500">
                      {fmtDateOnly(a.startDate) ?? "—"} → {fmtDateOnly(a.endDate) ?? "—"}
                    </span>
                    {canWrite && <RemoveAssignmentButton assignmentId={a.id} />}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <div className="mt-5">
                <AssignEmployeeForm projectId={project.id} employees={assignableEmployees} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build` then `npm run lint`
Expected: build completes with no type errors; lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr-projects.ts src/components/ui.tsx src/components/hr/ProjectFilters.tsx src/components/hr/ProjectCard.tsx "src/app/(erp)/hr/projects/page.tsx" "src/app/(erp)/hr/projects/[id]/page.tsx" docs/superpowers/
git commit -m "feat(hr): redesign Projects — card grid, status pills, timeline + team avatars"
```

---

## Self-Review

**1. Spec coverage:**
- List card grid + no horizontal scroll → Tasks 4, 5 (grid, no min-width). ✓
- Stat tiles → Task 5. ✓
- Status pills + counts + search → Task 3. ✓
- Timeline elapsed progress → Task 1 `projectTimeline` + Tasks 4/6. ✓
- Employee avatars / headcount mapping → Task 2 + Tasks 4/6. ✓
- Detail summary + stat tiles + responsive team rows → Task 6. ✓
- No migration / no new libs / RBAC / guardrails → Global Constraints, honored in every task. ✓

**2. Placeholder scan:** none — every step has complete code. ✓

**3. Type consistency:** `Timeline.tone` ∈ ProgressBar tones; `projectTimeline`/`assignmentStats`/`projectStats`/`statusCounts` signatures match their call sites in Tasks 4/5/6; `ProjectFilters` `counts` prop shape matches `statusCounts` return; `Avatar`/`AvatarStack` props match usages. ✓

## Notes for executor

- `npm run build` may be slow on this box; if it OOMs, run `npm run lint` for component-only checks and rely on `npx tsc --noEmit` for types.
- After implementation, run an adversarial review (ultracode) covering: responsiveness/no-overflow, Soft-Wave guardrails, RBAC (manager read-only), and edge cases (no dates, no client, no assignments, null role/alloc, long names, +N cluster).
