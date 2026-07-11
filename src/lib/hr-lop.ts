import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

// ── LOP (Loss of Pay) policy ────────────────────────────────────────────────
// lopDays = absentDays + 0.5*halfDays + unpaidLeaveDays, where unpaidLeaveDays is this
// month's LEAVE/SICK that falls beyond the employee's calendar-year quota. The over-quota
// portion is computed year-to-date so a month only "eats" the days that push the running
// total past the quota (not the whole month once the quota is exhausted):
//   unpaidThisMonth = max(0, ytdThroughMonth - quota) - max(0, ytdBeforeMonth - quota)
// paidDays = daysInMonth - lopDays. Day counts only — no rupee math here.

export interface LopInput {
  /** This month's per-status attendance counts (full Record — mirror hr-leave's init pattern). */
  thisMonth: Record<AttendanceStatus, number>;
  casualQuota: number;
  sickQuota: number;
  /** LEAVE/SICK taken from Jan 1 up to (not including) this month, i.e. ytdBeforeMonth. */
  ytdBeforeLeave: number;
  ytdBeforeSick: number;
  daysInMonth: number;
}

export interface LopResult {
  workingDays: number;
  lopDays: number;
  paidDays: number;
  absentDays: number;
  halfDays: number;
  unpaidLeaveDays: number;
}

// Pure core — no DB access, no rounding (days can be .5 from HALF_DAY).
export function computeLop(input: LopInput): LopResult {
  const { thisMonth, casualQuota, sickQuota, ytdBeforeLeave, ytdBeforeSick, daysInMonth } = input;

  const absentDays = thisMonth.ABSENT;
  const halfDays = thisMonth.HALF_DAY;
  const thisLeave = thisMonth.LEAVE;
  const thisSick = thisMonth.SICK;

  const unpaidCasual = Math.max(
    0,
    Math.max(0, ytdBeforeLeave + thisLeave - casualQuota) - Math.max(0, ytdBeforeLeave - casualQuota)
  );
  const unpaidSick = Math.max(
    0,
    Math.max(0, ytdBeforeSick + thisSick - sickQuota) - Math.max(0, ytdBeforeSick - sickQuota)
  );
  const unpaidLeaveDays = unpaidCasual + unpaidSick;

  const lopDays = absentDays + 0.5 * halfDays + unpaidLeaveDays;
  const workingDays = daysInMonth;
  const paidDays = daysInMonth - lopDays;

  return { workingDays, lopDays, paidDays, absentDays, halfDays, unpaidLeaveDays };
}

// DB-backed: pulls this month's attendance + YTD-before-month LEAVE/SICK counts for one
// employee and feeds computeLop. Mirrors hr-leave's UTC half-open windowing. Callers guard
// RBAC themselves; this does no mutation and no schema change.
export async function attendanceLop(
  employeeId: string,
  year: number,
  month: number /* 1-based */,
  casualQuota: number,
  sickQuota: number
) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [thisMonthGroups, ytdBeforeGroups] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { employeeId, status: { in: ["LEAVE", "SICK"] }, date: { gte: yearStart, lt: monthStart } },
      _count: { _all: true },
    }),
  ]);

  const thisMonth: Record<AttendanceStatus, number> = {
    PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0, HALF_DAY: 0, HOLIDAY: 0, WEEK_OFF: 0,
  };
  for (const g of thisMonthGroups) thisMonth[g.status] = g._count._all;

  const ytdBeforeLeave = ytdBeforeGroups.find((g) => g.status === "LEAVE")?._count._all ?? 0;
  const ytdBeforeSick = ytdBeforeGroups.find((g) => g.status === "SICK")?._count._all ?? 0;

  const result = computeLop({
    thisMonth, casualQuota, sickQuota, ytdBeforeLeave, ytdBeforeSick, daysInMonth,
  });

  // markedDays lets callers distinguish "no LOP" from "attendance not marked yet"
  // (the dashboard honesty rule — never show a full-pay claim off zero rows).
  const markedDays = Object.values(thisMonth).reduce((s, n) => s + n, 0);

  return {
    ...result,
    leaveDays: thisMonth.LEAVE,
    sickDays: thisMonth.SICK,
    presentDays: thisMonth.PRESENT,
    markedDays,
  };
}
