import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody, ProgressBar } from "@/components/ui";
import { AreaChart, ForecastArea, DeltaBadge } from "@/components/Charts";
import { linearForecast, pctDelta } from "@/lib/hr-forecast";

export const dynamic = "force-dynamic";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Bar = { label: string; count: number };
function BarList({ rows, empty }: { rows: Bar[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{row.label}</span>
            <span className="nums ml-2 font-medium text-slate-700">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HrAnalyticsPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const Y = today.getUTCFullYear();
  const Mo = today.getUTCMonth() + 1;

  // last 6 months (oldest first) + UTC windows
  const periods: { year: number; month: number; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = Mo - i, y = Y;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push({ year: y, month: m, label: SHORT_MONTHS[m - 1], start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  const fLabels: string[] = [];
  for (let i = 1; i <= 3; i++) { let m = Mo + i; while (m > 12) { m -= 12; } fLabels.push(SHORT_MONTHS[m - 1]); }
  const cur = periods[5], prev = periods[4];

  const [activeCount, byLocation, byDesignation, byEmpCategory, laptopsAllocated, activeEmployees] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employeeAsset.count({ where: { hasLaptop: true, returnedAt: null } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true, casualLeaveQuota: true, sickLeaveQuota: true } }),
  ]);

  // payroll series (6) → forecast 3
  const payrollSeries = await Promise.all(periods.map((p) =>
    prisma.payrollRecord.aggregate({ where: { periodYear: p.year, periodMonth: p.month }, _sum: { payableAmount: true } }).then((r) => r._sum.payableAmount ?? 0)));
  const payrollForecast = linearForecast(payrollSeries, 3);
  const payrollChart = [
    ...periods.map((p, i) => ({ label: p.label, value: payrollSeries[i], forecast: false })),
    ...payrollForecast.map((v, i) => ({ label: fLabels[i], value: v, forecast: true })),
  ];
  const costDelta = pctDelta(payrollSeries[5], payrollSeries[4]);

  // headcount at each month-end (6) → forecast 1
  const headcountSeries = await Promise.all(periods.map((p) =>
    prisma.employee.count({ where: { dateOfJoining: { lt: p.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: p.end } }] } })));
  const headcountChart = [
    ...periods.map((p, i) => ({ label: p.label, value: headcountSeries[i], forecast: false })),
    { label: fLabels[0], value: linearForecast(headcountSeries, 1)[0], forecast: true },
  ];

  // attendance rate per month (6)
  const attRateSeries = await Promise.all(periods.map(async (p) => {
    const g = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: { gte: p.start, lt: p.end } }, _count: { _all: true } });
    const c = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
    const worked = c("PRESENT") + c("ABSENT") + c("LEAVE") + c("SICK") + c("HALF_DAY");
    return worked ? Math.round(((c("PRESENT") + 0.5 * c("HALF_DAY")) / worked) * 100) : 0;
  }));
  const attRateChart = periods.map((p, i) => ({ label: p.label, value: attRateSeries[i] }));
  const attRateDelta = pctDelta(attRateSeries[5], attRateSeries[4]);

  // today's leave + joiners/leavers + attrition delta
  const [onLeaveToday, joinersCur, leaversCur, leaversPrev] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: { in: ["LEAVE", "SICK"] }, date: todayUTC } }),
    prisma.employee.count({ where: { dateOfJoining: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: prev.start, lt: prev.end } } }),
  ]);
  const netHeadcountChange = joinersCur - leaversCur;
  const attritionDelta = pctDelta(leaversCur, leaversPrev);

  // tenure (years) over active
  const now = todayUTC.getTime();
  const tenures = activeEmployees.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // leave burn (org) + summary
  const totalCasualQuota = activeEmployees.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = activeEmployees.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));
  const [casualYear, sickYear, leaveMonth, sickMonth] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: cur.start, lt: cur.end } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: cur.start, lt: cur.end } } }),
  ]);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;

  // project utilization
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] } } } } },
    orderBy: { name: "asc" },
  });
  const assigned = await prisma.projectAssignment.findMany({ where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: todayUTC } }] }, select: { employeeId: true }, distinct: ["employeeId"] });
  const benchCount = Math.max(0, activeCount - assigned.length);
  const utilization = activeCount ? Math.round((assigned.length / activeCount) * 100) : 0;

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));
  const projectBars = projects.map((p) => ({ label: p.name, count: p._count.assignments }));

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Analytics" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="space-y-8 p-6 sm:p-8">

        {/* KPI bento with deltas */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label="Active headcount"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{activeCount}</span><DeltaBadge value={netHeadcountChange === 0 ? 0 : (netHeadcountChange > 0 ? 100 : -100)} /></span>} />
          <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label="Payroll this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{fmtINR(payrollSeries[5])}</span><DeltaBadge value={costDelta} /></span>} />
          <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label="Attendance rate (MTD)"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{attRateSeries[5]}%</span><DeltaBadge value={attRateDelta} /></span>} />
          <StatCard tone="amber" icon={<Clock className="h-4 w-4" />} label="On leave today" value={onLeaveToday} />
          <StatCard tone="slate" icon={<Clock className="h-4 w-4" />} label="Avg tenure" value={`${avgTenure.toFixed(1)} yrs`} />
          <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label="Attrition this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span><DeltaBadge value={attritionDelta} invert /></span>} />
        </div>

        {/* Hero: payroll forecast */}
        <Card>
          <CardHeader title="Payroll cost — actual & forecast" subtitle="Last 6 months (solid) · next 3 months projected (dashed, trend)" />
          <CardBody><ForecastArea data={payrollChart} /></CardBody>
        </Card>

        {/* Workforce trends */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Headcount trend" subtitle="Active staff at each month-end · next month projected" />
            <CardBody><ForecastArea data={headcountChart} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Attendance rate" subtitle="Monthly present-equivalent %, last 6 months" />
            <CardBody><AreaChart data={attRateChart} /></CardBody>
          </Card>
        </div>

        {/* Project utilization */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard tone="brand" icon={<FolderKanban className="h-4 w-4" />} label="Utilization" value={`${utilization}%`} spark={utilization} />
            <StatCard tone="amber" label="On the bench" value={benchCount} />
            <StatCard tone="slate" label="Active projects" value={projects.length} />
          </div>
          <Card>
            <CardHeader title="Project allocation" subtitle="Active assignments per project (today)" />
            <CardBody><BarList rows={projectBars} empty="No active projects." /></CardBody>
          </Card>
        </div>

        {/* Leave & wellbeing */}
        <div className="grid gap-6 lg:grid-cols-2">
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
          <div className="grid grid-cols-2 gap-4">
            <StatCard tone="amber" label="Leaves this month" value={leaveMonth} />
            <StatCard tone="brand" label="Sick this month" value={sickMonth} />
            <StatCard tone="amber" label="Leaves this year" value={casualYear} />
            <StatCard tone="brand" label="Sick this year" value={sickYear} />
          </div>
        </div>

        {/* Composition */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader title="By location" subtitle="Active" /><CardBody><BarList rows={locationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By designation" subtitle="Active" /><CardBody><BarList rows={designationBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By category" subtitle="Active" /><CardBody><BarList rows={categoryBars} empty="No data yet." /></CardBody></Card>
          <Card><CardHeader title="By tenure" subtitle="Active" /><CardBody><BarList rows={tenureBars} empty="No data yet." /></CardBody></Card>
        </div>

        <p className="text-center text-[11px] text-slate-400">Dashed/&quot;projected&quot; values are trend extrapolations, not guarantees · {laptopsAllocated} laptops allocated</p>
      </div>
    </>
  );
}
