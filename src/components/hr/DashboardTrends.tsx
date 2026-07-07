import { prisma } from "@/lib/prisma";
import { getPeriods, monthlyAttendanceStats } from "@/lib/hr-dashboard";
import { linearForecast } from "@/lib/hr-forecast";
import TrendBoard, { type TrendSeries } from "@/components/hr/TrendBoard";

// Streamed independently of the HR dashboard's KPI band (see hr/page.tsx) — this is the
// heaviest slice of the dashboard's data: 12x monthly aggregate loops for headcount,
// attendance and leave. Takes the reference year/month (not a Date) so this
// component computes its own `asOf` anchor and re-derives `periods` from it (pure, cheap)
// rather than receiving the page's already-computed array, so this Suspense boundary can
// resolve fully on its own without waiting on (or blocking) the KPI band or the
// composition/utilization band, which each run their own slice of the same underlying
// queries. The 12-month trend window ENDS at the reference month (year/month) rather than
// always ending at "now" — the dashboard's MonthPicker re-anchors it.
export default async function DashboardTrends({ year, month }: { year: number; month: number }) {
  const asOf = new Date(Date.UTC(year, month - 1, 1));
  const { periods, nextLabel } = getPeriods(asOf);

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

  // (Project allocation intentionally NOT here — it isn't a time series. Its single
  // home is the "Project utilization" card in DashboardComposition.)
  const series: TrendSeries = { headcount: headcountPoints, attendance: attendancePoints, leave: leavePoints };

  return <TrendBoard series={series} />;
}
