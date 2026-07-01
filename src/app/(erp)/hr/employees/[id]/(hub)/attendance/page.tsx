import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { leaveBalances, attendanceYearSummary } from "@/lib/hr-leave";
import { MONTHS, type AttendanceStatusValue } from "@/lib/hr-validation";
import { DetailSection, btn } from "@/components/ui";
import AttendanceCalendar from "@/components/hr/AttendanceCalendar";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

// Mirrors the pre-hub employee detail page's summary chip palette.
const SUMMARY_CHIPS = [
  ["Present", "PRESENT", "bg-emerald-50 text-emerald-700"],
  ["Absent", "ABSENT", "bg-rose-50 text-rose-700"],
  ["Leave", "LEAVE", "bg-amber-50 text-amber-700"],
  ["Sick", "SICK", "bg-violet-50 text-violet-700"],
  ["Half-day", "HALF_DAY", "bg-sky-50 text-sky-700"],
  ["Holiday", "HOLIDAY", "bg-teal-50 text-teal-700"],
  ["Week-off", "WEEK_OFF", "bg-slate-100 text-slate-600"],
] as const;

export default async function EmployeeAttendanceTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [records, balances, summary] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId: id, date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, status: true },
    }),
    leaveBalances(id, year, emp.casualLeaveQuota, emp.sickLeaveQuota),
    attendanceYearSummary(id, year),
  ]);

  const cells: Record<number, AttendanceStatusValue | ""> = {};
  for (const r of records) cells[r.date.getUTCDate()] = r.status as AttendanceStatusValue;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailSection title={`${year} Summary`}>
          <div className="flex flex-wrap gap-2">
            {SUMMARY_CHIPS.map(([label, key, cls]) => (
              <div
                key={key}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${cls}`}
              >
                <span className="nums font-semibold">{summary[key]}</span>
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Leave Balances">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Casual Leave</p>
              <div className="flex items-end gap-1.5">
                <span className="nums text-2xl font-bold text-slate-800">{balances.casualRemaining}</span>
                <span className="pb-0.5 text-sm text-slate-400">remaining</span>
              </div>
              <p className="nums mt-1 text-xs text-slate-400">
                {balances.casualTaken} taken · {balances.casualQuota} quota
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Sick Leave</p>
              <div className="flex items-end gap-1.5">
                <span className="nums text-2xl font-bold text-slate-800">{balances.sickRemaining}</span>
                <span className="pb-0.5 text-sm text-slate-400">remaining</span>
              </div>
              <p className="nums mt-1 text-xs text-slate-400">
                {balances.sickTaken} taken · {balances.sickQuota} quota
              </p>
            </div>
          </div>
        </DetailSection>
      </div>

      <DetailSection
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {MONTHS[month - 1]} {year}
          </span>
        }
        action={
          <Link
            className={btn("secondary", "sm")}
            href={`/hr/attendance?employeeId=${id}&year=${year}&month=${month}`}
          >
            Open full attendance →
          </Link>
        }
      >
        <AttendanceCalendar year={year} month={month} daysInMonth={daysInMonth} cells={cells} />
      </DetailSection>
    </div>
  );
}
