import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { MONTHS, type AttendanceStatusValue } from "@/lib/hr-validation";
import { PageHeader, EmptyState } from "@/components/ui";
import AttendanceGrid from "@/components/hr/AttendanceGrid";
import MonthPicker from "@/components/hr/MonthPicker";
import ScopedFilterChip from "@/components/hr/ScopedFilterChip";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; employeeId?: string; grid?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;
  const employeeId = params.employeeId?.trim() || undefined;
  const initialView = params.grid === "table" ? "table" : "calendar";

  // Clamp to valid range
  const y = Math.max(2000, Math.min(2100, year));
  const m = Math.max(1, Math.min(12, month));

  // Month window (UTC)
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));

  // Days in month: last day of the month
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // Prev / next month navigation
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;

  const [employees, records, scopedEmployee] = await Promise.all([
    prisma.employee.findMany({
      // Scoped to one employee (any status — an inactive employee's history
      // must still be viewable from their profile), else the usual active roster.
      where: employeeId ? { id: employeeId } : { status: "ACTIVE" },
      select: { id: true, empId: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { employeeId: true, date: true, status: true },
    }),
    employeeId
      ? prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, empId: true } })
      : Promise.resolve(null),
  ]);

  const initial = records.map((r) => ({
    employeeId: r.employeeId,
    day: r.date.getUTCDate(),
    status: r.status as AttendanceStatusValue,
  }));

  const monthLabel = `${MONTHS[m - 1]} ${y}`;

  return (
    <>
      <PageHeader title="Attendance" subtitle={monthLabel}>
        <a
          href={`/api/hr/attendance/export?year=${y}&month=${m}`}
          className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          download
        >
          Export XLSX
        </a>
        <Link
          href={`/hr/attendance?year=${prevYear}&month=${prevMonth}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <MonthPicker year={y} month={m} basePath="/hr/attendance" />
        <Link
          href={`/hr/attendance?year=${nextYear}&month=${nextMonth}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="p-6 sm:p-8">
        {scopedEmployee && (
          <ScopedFilterChip
            name={scopedEmployee.name}
            empId={scopedEmployee.empId}
            employeeHref={`/hr/employees/${employeeId}`}
            clearHref={`/hr/attendance?year=${y}&month=${m}`}
          />
        )}
        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="No active employees"
            description="Add employees to start tracking attendance."
          />
        ) : (
          <AttendanceGrid
            // Remount on ANY roster-defining URL state — month AND employee scope.
            // Keying on year-month alone left stale grid state when only the
            // ?employeeId= scope changed (same corruption class as the payout fix).
            key={`${y}-${m}-${employeeId ?? "all"}`}
            employees={employees}
            initial={initial}
            year={y}
            month={m}
            daysInMonth={daysInMonth}
            canWrite={canWrite}
            employeeId={employeeId}
            initialView={initialView}
          />
        )}
      </div>
    </>
  );
}
