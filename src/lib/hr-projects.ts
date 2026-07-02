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
  // Dates are stored date-only at UTC midnight; treat endDate inclusively (the whole
  // end day counts as in-progress) and compare in date-only space, so the label doesn't
  // flip to "Overdue"/100% early for viewers/servers ahead of UTC.
  const end = endDate.getTime() + DAY;
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tone: TimelineTone = status === "ON_HOLD" ? "amber" : "brand";
  if (end <= start) return { pct: t >= end ? 100 : 0, label: t >= end ? "Ended" : "Not started", tone };
  if (t < start) return { pct: 0, label: "Not started", tone };
  if (t >= end) return { pct: 100, label: status === "ACTIVE" ? "Overdue" : "Ended", tone: "amber" };
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
  return {
    total,
    active,
    peopleAssigned: people.size,
    avgTeam: total ? Math.round(totalAssignments / total) : 0,
  };
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
  const roles = new Set(
    assignments.map((a) => a.roleOnProject).filter((r): r is string => !!r),
  );
  return {
    teamSize,
    roleCount: roles.size,
    durationDays: durationDays(startDate, endDate),
  };
}

/**
 * Sum of allocationPct across a single employee's ACTIVE assignment rows (endDate
 * null or on/after `asOf`, default today at UTC midnight). Null allocationPct
 * contributes 0 — never blocks/undercounts as NaN.
 */
export function activeAllocation(
  rows: { allocationPct: number | null; endDate: Date | null }[],
  asOf: Date = new Date(),
): number {
  const cutoff = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return rows.reduce((sum, r) => {
    const active = r.endDate == null || r.endDate.getTime() >= cutoff;
    return active ? sum + (r.allocationPct ?? 0) : sum;
  }, 0);
}
