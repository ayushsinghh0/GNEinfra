import { Users, CalendarClock, Laptop } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui";
import { AreaChart } from "@/components/Charts";

export const dynamic = "force-dynamic";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function HrAnalyticsPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const periodYear = today.getUTCFullYear();
  const periodMonth = today.getUTCMonth() + 1;

  // Last 6 months (including current), oldest first.
  const periods: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = periodMonth - i;
    let y = periodYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push({ year: y, month: m, label: SHORT_MONTHS[m - 1] });
  }

  const [
    byLocation,
    byDesignation,
    byEmpCategory,
    attByStatus,
    payrollResults,
    laptopsAllocated,
    activeCount,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ["location"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["designation"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["empCategory"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: todayUTC },
      _count: { _all: true },
    }),
    Promise.all(
      periods.map((p) =>
        prisma.payrollRecord
          .aggregate({
            where: { periodYear: p.year, periodMonth: p.month },
            _sum: { payableAmount: true },
          })
          .then((r) => ({ label: p.label, value: r._sum.payableAmount ?? 0 }))
      )
    ),
    prisma.employeeAsset.count({ where: { hasLaptop: true, returnedAt: null } }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
  ]);

  const presentCount =
    attByStatus.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveCount =
    attByStatus.find((r) => r.status === "LEAVE")?._count._all ?? 0;

  // Project allocation
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          assignments: {
            where: {
              employee: { status: "ACTIVE" },
              OR: [{ endDate: null }, { endDate: { gte: todayUTC } }],
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const assignedEmployees = await prisma.projectAssignment.findMany({
    where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  const benchCount = activeCount - assignedEmployees.length;

  // Leave summary — this month + this year
  const yStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const mStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const yEnd = new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1));
  const mEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const [leaveYear, sickYear, leaveMonth, sickMonth] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } },
    }),
    prisma.attendanceRecord.count({
      where: { status: "SICK", date: { gte: yStart, lt: yEnd } },
    }),
    prisma.attendanceRecord.count({
      where: { status: "LEAVE", date: { gte: mStart, lt: mEnd } },
    }),
    prisma.attendanceRecord.count({
      where: { status: "SICK", date: { gte: mStart, lt: mEnd } },
    }),
  ]);

  // Sorted bar data for each breakdown
  type BarRow = { label: string; count: number };
  const sortDesc = (arr: BarRow[]) =>
    [...arr].sort((a, b) => b.count - a.count);

  const locationBars = sortDesc(
    byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all }))
  );
  const designationBars = sortDesc(
    byDesignation.map((r) => ({
      label: r.designation ?? "—",
      count: r._count._all,
    }))
  );
  const categoryBars = sortDesc(
    byEmpCategory.map((r) => ({
      label: r.empCategory ?? "—",
      count: r._count._all,
    }))
  );

  const maxLoc = Math.max(1, ...locationBars.map((r) => r.count));
  const maxDes = Math.max(1, ...designationBars.map((r) => r.count));
  const maxCat = Math.max(1, ...categoryBars.map((r) => r.count));

  const projectBars = projects.map((p) => ({
    label: p.name,
    count: p._count.assignments,
  }));
  const maxProject = Math.max(1, ...projectBars.map((r) => r.count));

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="Human Resources"
        title="HR Analytics"
        subtitle="Headcount breakdown, attendance trends and payroll overview."
        className="px-6 pb-7 pt-9 sm:px-8"
      />
      <div className="space-y-8 p-6 sm:p-8">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Active employees"
            value={activeCount}
            tone="brand"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Present today"
            value={presentCount}
            tone="emerald"
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <StatCard label="On leave today" value={onLeaveCount} tone="amber" />
          <StatCard
            label="Laptops allocated"
            value={laptopsAllocated}
            tone="blue"
            icon={<Laptop className="h-4 w-4" />}
          />
        </div>

        {/* Payroll trend — AreaChart receives {label, value} where value = net payable (₹) */}
        <Card>
          <CardHeader
            title="Net payroll trend"
            subtitle="Last 6 months · net payable (₹)"
          />
          <CardBody>
            <AreaChart data={payrollResults} />
          </CardBody>
        </Card>

        {/* Headcount breakdowns — plain horizontal bar lists, brand color only */}
        <div className="grid gap-6 sm:grid-cols-3">
          {/* By Location */}
          <Card>
            <CardHeader title="By location" subtitle="Active employees" />
            <CardBody className="space-y-3">
              {locationBars.length === 0 ? (
                <p className="text-sm text-slate-500">No data yet.</p>
              ) : (
                locationBars.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600">{row.label}</span>
                      <span className="nums ml-2 font-medium text-slate-700">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                        style={{ width: `${(row.count / maxLoc) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* By Designation */}
          <Card>
            <CardHeader title="By designation" subtitle="Active employees" />
            <CardBody className="space-y-3">
              {designationBars.length === 0 ? (
                <p className="text-sm text-slate-500">No data yet.</p>
              ) : (
                designationBars.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600">{row.label}</span>
                      <span className="nums ml-2 font-medium text-slate-700">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                        style={{ width: `${(row.count / maxDes) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader title="By category" subtitle="Active employees" />
            <CardBody className="space-y-3">
              {categoryBars.length === 0 ? (
                <p className="text-sm text-slate-500">No data yet.</p>
              ) : (
                categoryBars.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600">{row.label}</span>
                      <span className="nums ml-2 font-medium text-slate-700">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                        style={{ width: `${(row.count / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Project allocation */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="On the bench" value={benchCount} tone="amber" />
          </div>
          <Card>
            <CardHeader
              title="Project allocation"
              subtitle="Active assignments per project (today)"
            />
            <CardBody className="space-y-3">
              {projectBars.length === 0 ? (
                <p className="text-sm text-slate-500">No active projects.</p>
              ) : (
                projectBars.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600">
                        {row.label}
                      </span>
                      <span className="nums ml-2 font-medium text-slate-700">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                        style={{
                          width: `${(row.count / maxProject) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Leave summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Leaves this month" value={leaveMonth} tone="amber" />
          <StatCard label="Sick this month" value={sickMonth} tone="brand" />
          <StatCard label="Leaves this year" value={leaveYear} tone="amber" />
          <StatCard label="Sick this year" value={sickYear} tone="brand" />
        </div>
      </div>
    </>
  );
}
