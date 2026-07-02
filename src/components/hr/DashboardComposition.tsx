import { FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody, ProgressBar, EmptyState } from "@/components/ui";
import { BarList } from "@/components/Charts";
import CompositionBoard from "@/components/hr/CompositionBoard";

type Bar = { label: string; count: number; href?: string };

// Streamed independently of the HR dashboard's KPI band (see hr/page.tsx) — workforce
// composition (location/designation/category/tenure), project utilization and leave burn.
// Re-runs its own employee/project/attendance queries rather than sharing the KPI band's
// results (e.g. active headcount) — correctness over dedupe, per the dashboard's
// streaming split, so this Suspense boundary resolves fully on its own.
export default async function DashboardComposition({ today }: { today: Date }) {
  const Y = today.getUTCFullYear();
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));

  const [activeCount, byLocation, byDesignation, byEmpCategory, activeEmployees, projects, assigned, casualYear, sickYear] =
    await Promise.all([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true, casualLeaveQuota: true, sickLeaveQuota: true } }),
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: today } }] } } } } },
        orderBy: { name: "asc" },
      }),
      prisma.projectAssignment.findMany({ where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { employeeId: true }, distinct: ["employeeId"] }),
      prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
      prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
    ]);

  // Tenure.
  const now = today.getTime();
  const tenures = activeEmployees.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // Leave burn (year).
  const totalCasualQuota = activeEmployees.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = activeEmployees.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;

  // Project allocation.
  const benchCount = Math.max(0, activeCount - assigned.length);
  const utilization = activeCount ? Math.round((assigned.length / activeCount) * 100) : 0;

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));
  const projectBars: Bar[] = projects.map((p) => ({ label: p.name, count: p._count.assignments, href: `/hr/projects/${p.id}` }));

  return (
    <>
      {/* Utilization + leave burn */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Project utilization" subtitle={`${utilization}% deployed · ${benchCount} on the bench · ${projects.length} active projects`} />
          <CardBody>
            {projectBars.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-6 w-6" />}
                title="No active projects"
                description="Assign employees to a project to see utilization here."
              />
            ) : (
              <BarList items={projectBars.map((b) => ({ label: b.label, value: b.count, href: b.href }))} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leave burn (this year)" subtitle="Days taken vs total annual quota" />
          <CardBody className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-600">Casual leave</span>
                <span className="nums text-slate-700">{casualYear} / {totalCasualQuota} <span className="text-slate-400">({casualBurn}%)</span></span>
              </div>
              <ProgressBar value={casualBurn} tone="amber" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-600">Sick leave</span>
                <span className="nums text-slate-700">{sickYear} / {totalSickQuota} <span className="text-slate-400">({sickBurn}%)</span></span>
              </div>
              <ProgressBar value={sickBurn} tone="brand" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pill-driven workforce composition */}
      <CompositionBoard
        location={locationBars}
        designation={designationBars}
        category={categoryBars}
        tenure={tenureBars}
      />
    </>
  );
}
