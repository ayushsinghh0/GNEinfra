import Link from "next/link";
import { FolderKanban, Users, ChevronRight, Armchair } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody, ProgressBar, EmptyState } from "@/components/ui";
import { BarList, RingGauge } from "@/components/Charts";
import CompositionBoard from "@/components/hr/CompositionBoard";

type Bar = { label: string; count: number; href?: string };

// Three independently-Suspended dashboard cells (bento Task 8) — split out of
// what used to be one `DashboardComposition` component so each can occupy its
// own bento cell (leave-burn sits beside the KPI cluster, utilization beside
// Trends, composition on its own row). Each re-runs its own slice of the
// employee/project/attendance queries rather than sharing another cell's
// result — correctness over dedupe, per the dashboard's streaming split (see
// DashboardTrends's file-level comment for the same rationale). All three
// stay a current-snapshot ("now"), not re-anchored to the dashboard's
// reference-month picker — they're workforce composition/utilization, not a
// monthly KPI.

/* ── Leave burn (this year) — casual/sick rings + combined summary ───────── */
export async function DashboardLeaveBurn({ today }: { today: Date }) {
  const Y = today.getUTCFullYear();
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));

  const [activeCount, quotas, casualYear, sickYear] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { casualLeaveQuota: true, sickLeaveQuota: true } }),
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
  ]);

  const totalCasualQuota = quotas.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = quotas.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;
  const totalQuota = totalCasualQuota + totalSickQuota;
  const totalUsed = casualYear + sickYear;
  const combinedBurn = totalQuota ? Math.round((totalUsed / totalQuota) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader title="Leave burn (this year)" subtitle={`Days taken vs quota · across ${activeCount} active employees`} />
      <CardBody className="space-y-4 px-6 py-5">
        <div className="flex justify-center gap-6">
          <RingGauge value={casualBurn} tone="amber" label="Casual leave" sublabel={`${casualYear} of ${totalCasualQuota} days`} size={76} />
          <RingGauge value={sickBurn} tone="brand" label="Sick leave" sublabel={`${sickYear} of ${totalSickQuota} days`} size={76} />
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-500">Total used</span>
            <span className="nums text-sm font-semibold text-slate-900">
              {totalUsed} <span className="font-normal text-slate-400">/ {totalQuota}</span>
            </span>
          </div>
          <ProgressBar value={combinedBurn} tone="brand" />
          <p className="text-xs text-slate-400">
            <span className="nums">{combinedBurn}%</span> burned
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Project utilization ──────────────────────────────────────────────────── */
export async function DashboardUtilization({ today }: { today: Date }) {
  const [activeCount, projects, assigned] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: today } }] } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.projectAssignment.findMany({ where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { employeeId: true }, distinct: ["employeeId"] }),
  ]);

  const deployed = assigned.length;
  const benchCount = Math.max(0, activeCount - deployed);
  const utilization = activeCount ? Math.round((deployed / activeCount) * 100) : 0;

  // Top projects by staffed headcount — the list answers "where are people
  // committed", so it ranks by count (name order was arbitrary) and caps at 5
  // with an explicit "+N more" link rather than a silently scrolling tail.
  const TOP = 5;
  const ranked = [...projects].sort(
    (a, b) => b._count.assignments - a._count.assignments || a.name.localeCompare(b.name)
  );
  const top: Bar[] = ranked
    .slice(0, TOP)
    .map((p) => ({ label: p.name, count: p._count.assignments, href: `/hr/projects/${p.id}` }));
  const moreCount = ranked.length - top.length;

  return (
    <Card className="h-full">
      <CardHeader
        title="Project utilization"
        subtitle="Active staff on at least one live project"
        action={
          <Link
            href="/hr/projects"
            className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
          >
            Projects
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      {activeCount === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No active employees"
          description="Utilization appears once there are active employees to deploy."
        />
      ) : (
        <CardBody className="space-y-4 px-6 py-5">
          <div className="flex justify-center">
            <RingGauge
              value={utilization}
              tone="brand"
              label="Deployed"
              sublabel={`${deployed} of ${activeCount} active staff`}
              size={84}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-emerald-50/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                On projects
              </div>
              <div className="nums mt-1 text-xl font-semibold leading-none text-slate-900">{deployed}</div>
            </div>
            <div className="rounded-xl bg-amber-50/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                <Armchair className="h-3.5 w-3.5" aria-hidden="true" />
                On bench
              </div>
              <div className="nums mt-1 text-xl font-semibold leading-none text-slate-900">{benchCount}</div>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-500">Top projects by headcount</span>
              <span className="nums text-xs text-slate-400">
                {projects.length} active project{projects.length === 1 ? "" : "s"}
              </span>
            </div>
            {top.length === 0 ? (
              <p className="text-sm text-slate-400">
                No active projects yet —{" "}
                <Link href="/hr/projects" className="font-medium text-brand-700 hover:text-brand">
                  view projects
                </Link>
                .
              </p>
            ) : (
              <BarList items={top.map((b) => ({ label: b.label, value: b.count, href: b.href }))} />
            )}
            {moreCount > 0 && (
              <Link
                href="/hr/projects"
                className="press inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition-colors hover:text-brand"
              >
                +{moreCount} more project{moreCount === 1 ? "" : "s"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

/* ── Workforce composition (location/designation/category/tenure) ───────── */
export async function DashboardWorkforceComposition({ today }: { today: Date }) {
  const [byLocation, byDesignation, byEmpCategory, joinDates] = await Promise.all([
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true } }),
  ]);

  const now = today.getTime();
  const tenures = joinDates.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));

  return <CompositionBoard location={locationBars} designation={designationBars} category={categoryBars} tenure={tenureBars} />;
}
