import { prisma } from "@/lib/prisma";
import { getPeriods, monthlyAttendanceStats } from "@/lib/hr-dashboard";
import { linearForecast } from "@/lib/hr-forecast";
import TrendBoard, { type TrendSeries } from "@/components/hr/TrendBoard";

type Bar = { label: string; count: number; href?: string };

// Streamed independently of the HR dashboard's KPI band (see hr/page.tsx) — this is the
// heaviest slice of the dashboard's data: 12x monthly aggregate/groupBy loops for payroll,
// headcount, attendance and leave. Takes the reference year/month (not a Date) so this
// component computes its own `asOf` anchor and re-derives `periods` from it (pure, cheap)
// rather than receiving the page's already-computed array, so this Suspense boundary can
// resolve fully on its own without waiting on (or blocking) the KPI band or the
// composition/utilization band, which each run their own slice of the same underlying
// queries. The 12-month trend window ENDS at the reference month (year/month) rather than
// always ending at "now" — the dashboard's MonthPicker re-anchors it.
export default async function DashboardTrends({ year, month }: { year: number; month: number }) {
  const asOf = new Date(Date.UTC(year, month - 1, 1));
  const { periods, cur, nextLabel } = getPeriods(asOf);

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

  // Headcount at each month-end (12) → forecast 1.
  const headcountSeries = await Promise.all(periods.map((p) =>
    prisma.employee.count({ where: { dateOfJoining: { lt: p.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: p.end } }] } })));
  const headcountPoints = [
    ...periods.map((p, i) => ({ label: p.label, value: headcountSeries[i], forecast: false })),
    { label: nextLabel, value: linearForecast(headcountSeries, 1)[0], forecast: true },
  ];

  // Attendance rate + leave-days per month (12).
  const monthly = await Promise.all(periods.map((p) => monthlyAttendanceStats(p.start, p.end)));
  const attendancePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].rate }));
  const leavePoints = periods.map((p, i) => ({ label: p.label, value: monthly[i].leaveDays }));

  // Project allocation (for the "Projects" trend metric) — assignments still active as of
  // the reference month's end (`cur.end`, the same exclusive month-end boundary the
  // headcount series above uses), not literally "today".
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, _count: { select: { assignments: { where: { employee: { status: "ACTIVE" }, OR: [{ endDate: null }, { endDate: { gte: cur.end } }] } } } } },
    orderBy: { name: "asc" },
  });
  const projectBars: Bar[] = projects.map((p) => ({ label: p.name, count: p._count.assignments, href: `/hr/projects/${p.id}` }));

  const series: TrendSeries = { payroll: payrollPoints, headcount: headcountPoints, attendance: attendancePoints, leave: leavePoints, projects: projectBars };

  return <TrendBoard series={series} />;
}
