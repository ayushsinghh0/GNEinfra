import { prisma } from "@/lib/prisma";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Period = { year: number; month: number; label: string; start: Date; end: Date };

// Last 12 months (oldest first) ending at `today`'s month, + the label for the month
// after the current one (the forecast tail's x-axis label). Pure/no DB — cheap enough to
// recompute independently in every HR-dashboard section that needs it (see hr/page.tsx's
// streaming split: the KPI band and the two heavy Suspense-streamed sections each call
// this rather than threading one shared array through props).
export function getPeriods(today: Date) {
  const Y = today.getUTCFullYear();
  const Mo = today.getUTCMonth() + 1;
  const periods: Period[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = Mo - i, y = Y;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push({ year: y, month: m, label: SHORT[m - 1], start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  const last = periods.length - 1;
  const cur = periods[last];
  const prev = periods[last - 1];
  const nextLabel = SHORT[Mo % 12]; // month after current
  return { periods, last, cur, prev, nextLabel, Y, Mo };
}

export function periodKey(p: { year: number; month: number }) {
  return `${p.year}-${p.month}`;
}

// Attendance rate (present-equivalent %) + leave/sick days taken, for one [start, end)
// month window — one groupBy per call. Callers needing the full 12-month series run this
// once per period; callers only needing a delta (this month vs last) call it twice.
export async function monthlyAttendanceStats(start: Date, end: Date) {
  const g = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: { gte: start, lt: end } }, _count: { _all: true } });
  const c = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
  const worked = c("PRESENT") + c("ABSENT") + c("LEAVE") + c("SICK") + c("HALF_DAY");
  const rate = worked ? Math.round(((c("PRESENT") + 0.5 * c("HALF_DAY")) / worked) * 100) : 0;
  const leaveDays = c("LEAVE") + c("SICK");
  return { rate, leaveDays };
}
