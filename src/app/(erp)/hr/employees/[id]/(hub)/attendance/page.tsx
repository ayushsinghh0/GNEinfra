import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { attendanceYearSummary } from "@/lib/hr-leave";
import { MONTHS, type AttendanceStatusValue } from "@/lib/hr-validation";
import { DetailSection, btn } from "@/components/ui";
import AttendanceCalendar from "@/components/hr/AttendanceCalendar";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

// See (hub)/page.tsx's generateMetadata comment — same per-tab title fix.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = await getEmployee(id);
  return { title: emp ? `${emp.name} · Attendance` : "Employee" };
}

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

  const [records, summary] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId: id, date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, status: true },
    }),
    attendanceYearSummary(id, year),
  ]);

  const cells: Record<number, AttendanceStatusValue | ""> = {};
  for (const r of records) cells[r.date.getUTCDate()] = r.status as AttendanceStatusValue;

  return (
    <div className="space-y-6">
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
