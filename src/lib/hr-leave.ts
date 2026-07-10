import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

// Holds the year-summary helper used by the employee attendance tab.

// Count per status for one employee across a calendar year.
export async function attendanceYearSummary(employeeId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const groups = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { employeeId, date: { gte: start, lt: end } },
    _count: { _all: true },
  });
  const summary: Record<AttendanceStatus, number> = {
    PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0, HALF_DAY: 0, HOLIDAY: 0, WEEK_OFF: 0,
  };
  for (const g of groups) summary[g.status] = g._count._all;
  return summary;
}
