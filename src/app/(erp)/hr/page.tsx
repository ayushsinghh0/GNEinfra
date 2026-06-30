import Link from "next/link";
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, BadgeIndianRupee } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody, ProgressBar } from "@/components/ui";
import { DeltaBadge } from "@/components/Charts";
import { linearForecast, pctDelta } from "@/lib/hr-forecast";
import TrendBoard, { type TrendSeries } from "@/components/hr/TrendBoard";
import CompositionBoard from "@/components/hr/CompositionBoard";

export const dynamic = "force-dynamic";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const Y = today.getUTCFullYear();
  const Mo = today.getUTCMonth() + 1;

  // Last 12 months (oldest first).
  const periods: { year: number; month: number; label: string; start: Date; end: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = Mo - i, y = Y;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push({ year: y, month: m, label: SHORT[m - 1], start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  const last = periods.length - 1;
  const cur = periods[last], prev = periods[last - 1];
  const nextLabel = SHORT[(Mo % 12)]; // month after current

  const [activeCount, byLocation, byDesignation, byEmpCategory, activeEmployees, attTodayG] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true, casualLeaveQuota: true, sickLeaveQuota: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
  ]);

  // Payroll series (12) → anchor on last non-zero month, forecast the rest.
  const payrollSeries = await Promise.all(periods.map((p) =>
    prisma.payrollRecord.aggregate({ where: { periodYear: p.year, periodMonth: p.month }, _sum: { payableAmount: true } }).then((r) => r._sum.payableAmount ?? 0)));
  let lastActual = payrollSeries.length - 1;
  while (lastActual > 0 && payrollSeries[lastActual] === 0) lastActual--;
  const payrollActuals = payrollSeries.slice(0, lastActual + 1);
  const fLabels = [...periods.slice(lastActual + 1).map((p) => p.label), nextLabel];
  const payrollForecast = linearForecast(payrollActuals, fLabels.length);
  const payrollPoints = [
    ...payrollActuals.map((v, i) => ({ label: periods[i].label, value: v, forecast: false })),
    ...payrollForecast.map((v, i) => ({ label: fLabels[i], value: v, forecast: true })),
  ];
  const costAnchor = payrollSeries[lastActual];
  const costDelta = pctDelta(costAnchor, lastActual > 0 ? payrollSeries[lastActual - 1] : 0);

  // Headcount at each month-end (12) → forecast 1.
  const headcountSeries = await Promise.all(periods.map((p) =>
    prisma.employee.count({ where: { dateOfJoining: { lt: p.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: p.end } }] } })));
  const headcountPoints = [
    ...periods.map((p, i) => ({ label: p.label, value: headcountSeries[i], forecast: false })),
    { label: nextLabel, value: linearForecast(headcountSeries, 1)[0], forecast: true },
  ];
  const headcountDelta = pctDelta(headcountSeries[last], headcountSeries[last - 1]);

  // Attendance rate + leave-days per month (12).
  const monthly = await Promise.all(periods.map(async (p) => {
    const g = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: { gte: p.start, lt: p.end } }, _count: { _all: true } });
    const c = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
    const worked = c("PRESENT") + c("ABSENT") + c("LEAVE") + c("SICK") + c("HALF_DAY");
    const rate = worked ? Math.round(((c("PRESENT") + 0.5 * c("HALF_DAY")) / worked) * 100) : 0;
    const leaveDays = c("LEAVE") + c("SICK");
    return { rate, leaveDays };
  }));
  const attendancePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].rate }));
  const leavePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].leaveDays }));
  const attRateDelta = pctDelta(monthly[last].rate, monthly[last - 1].rate);

  // Today / attrition.
  const presentToday = attTodayG.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveToday = (attTodayG.find((r) => r.status === "LEAVE")?._count._all ?? 0) + (attTodayG.find((r) => r.status === "SICK")?._count._all ?? 0);
  const [leaversCur, leaversPrev] = await Promise.all([
    prisma.employee.count({ where: { leavingDate: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: prev.start, lt: prev.end } } }),
  ]);
  const attritionDelta = pctDelta(leaversCur, leaversPrev);
  const netPayrollMonth = payrollSeries[last];

  // Tenure.
  const now = todayUTC.getTime();
  const tenures = activeEmployees.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // Leave burn (year).
  const totalCasualQuota = activeEmployees.reduce((s, e) => s + e.casualLeaveQuota, 0);
  const totalSickQuota = activeEmployees.reduce((s, e) => s + e.sickLeaveQuota, 0);
  const yStart = new Date(Date.UTC(Y, 0, 1)), yEnd = new Date(Date.UTC(Y + 1, 0, 1));
  const [casualYear, sickYear] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: "LEAVE", date: { gte: yStart, lt: yEnd } } }),
    prisma.attendanceRecord.count({ where: { status: "SICK", date: { gte: yStart, lt: yEnd } } }),
  ]);
  const casualBurn = totalCasualQuota ? Math.round((casualYear / totalCasualQuota) * 100) : 0;
  const sickBurn = totalSickQuota ? Math.round((sickYear / totalSickQuota) * 100) : 0;

  // Project allocation.
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
  const projectBars: Bar[] = projects.map((p) => ({ label: p.name, count: p._count.assignments }));

  const series: TrendSeries = { payroll: payrollPoints, headcount: headcountPoints, attendance: attendancePoints, leave: leavePoints, projects: projectBars };

  const quickLinks = [
    { href: "/hr/employees", label: "Employees", icon: Users, desc: "View and manage employee records." },
    { href: "/hr/attendance", label: "Attendance", icon: CalendarClock, desc: "Track daily attendance and leave." },
    { href: "/hr/payout", label: "Payout", icon: BadgeIndianRupee, desc: "Process and review monthly payroll." },
    { href: "/hr/projects", label: "Projects", icon: FolderKanban, desc: "Projects and concurrent assignments." },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Dashboard" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="space-y-8 p-6 sm:p-8">
        {/* KPI bento with deltas */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label="Active headcount"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{activeCount}</span><DeltaBadge value={headcountDelta} /></span>} />
          <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label={`Payroll · ${periods[lastActual].label}`}
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{fmtINR(costAnchor)}</span><DeltaBadge value={costDelta} /></span>} />
          <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label="Attendance rate (MTD)"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{monthly[last].rate}%</span><DeltaBadge value={attRateDelta} /></span>} />
          <StatCard tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} label="Present today" value={presentToday} />
          <StatCard tone="amber" icon={<Clock className="h-4 w-4" />} label="On leave today" value={onLeaveToday} />
          <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label="Attrition this month"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span><DeltaBadge value={attritionDelta} invert /></span>} />
        </div>

        {/* Pill-driven trend board */}
        <TrendBoard series={series} />

        {/* Utilization + leave burn */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Project utilization" subtitle={`${utilization}% deployed · ${benchCount} on the bench · ${projects.length} active projects`} />
            <CardBody><BarList rows={projectBars} empty="No active projects." /></CardBody>
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

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href} className="group block rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] motion-safe:transition hover:motion-safe:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 motion-safe:transition group-hover:bg-brand-100"><Icon className="h-5 w-5" /></div>
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</div>
            </Link>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400">&quot;Projected&quot; values are least-squares trend extrapolations, not guarantees · {netPayrollMonth ? `${fmtINR(netPayrollMonth)} processed this month` : "no payroll processed yet this month"}</p>
      </div>
    </>
  );
}
