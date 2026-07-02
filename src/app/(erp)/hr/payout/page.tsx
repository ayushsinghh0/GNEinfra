import Link from "next/link";
import { ChevronLeft, ChevronRight, BadgeIndianRupee } from "lucide-react";
import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { MONTHS, type PayrollExtraLine } from "@/lib/hr-validation";
import { computeLop } from "@/lib/hr-lop";
import { PageHeader, EmptyState, Chip } from "@/components/ui";
import PayrollEditor, { type PayrollRow } from "@/components/hr/PayrollEditor";
import MonthPicker from "@/components/hr/MonthPicker";
import ScopedFilterChip from "@/components/hr/ScopedFilterChip";
import PayoutViewPills from "@/components/hr/PayoutViewPills";

const emptyStatusCounts = (): Record<AttendanceStatus, number> => ({
  PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0, HALF_DAY: 0, HOLIDAY: 0, WEEK_OFF: 0,
});

const VALID_VIEW = new Set(["pending", "saved"]);

export const dynamic = "force-dynamic";

export default async function PayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; employeeId?: string; view?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const sp = await searchParams;
  const now = new Date();
  const year = Math.max(2000, Math.min(2100, Number(sp.year) || now.getUTCFullYear()));
  const month = Math.max(1, Math.min(12, Number(sp.month) || now.getUTCMonth() + 1));
  const employeeId = sp.employeeId?.trim() || undefined;
  const view = sp.view && VALID_VIEW.has(sp.view) ? sp.view : undefined;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  // Attendance-derived LOP (loss of pay) day counts, batched for the whole roster —
  // two grouped queries total (not 2×N), fed per-employee through the pure computeLop
  // (src/lib/hr-lop.ts). Mirrors attendanceLop's UTC half-open windowing.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [employees, payrolls, prevPayrolls, scopedEmployee, thisMonthGroups, ytdBeforeGroups] = await Promise.all([
    prisma.employee.findMany({
      // Scoped to one employee (any status — an inactive employee's payout
      // history must still be viewable from their profile), else the usual
      // active roster.
      where: employeeId ? { id: employeeId } : { status: "ACTIVE" },
      select: {
        id: true,
        empId: true,
        name: true,
        designation: true,
        totalCtc: true,
        casualLeaveQuota: true,
        sickLeaveQuota: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.payrollRecord.findMany({
      where: { periodYear: year, periodMonth: month },
      select: {
        id: true,
        employeeId: true,
        code: true,
        role: true,
        designation: true,
        ctc: true,
        basic: true,
        hra: true,
        cca: true,
        personalPay: true,
        conveyance: true,
        lta: true, specialAllowance: true,
        pla: true,
        medicalReimb: true,
        tds: true,
        loanAdv: true,
        epf: true,
        esi: true,
        remarks: true,
        extraLines: true,
      },
    }),
    prisma.payrollRecord.findMany({
      where: { periodYear: prevYear, periodMonth: prevMonth },
      select: {
        employeeId: true,
        basic: true, hra: true, cca: true, personalPay: true,
        conveyance: true, lta: true, specialAllowance: true, pla: true, medicalReimb: true,
        tds: true, loanAdv: true, epf: true, esi: true,
      },
    }),
    employeeId
      ? prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, empId: true } })
      : Promise.resolve(null),
    prisma.attendanceRecord.groupBy({
      by: ["employeeId", "status"],
      where: { date: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["employeeId", "status"],
      where: { status: { in: ["LEAVE", "SICK"] }, date: { gte: yearStart, lt: monthStart } },
      _count: { _all: true },
    }),
  ]);

  const payrollMap = new Map(payrolls.map((p) => [p.employeeId, p]));

  // Previous month's figures, for the editor's "Copy last month" shortcut.
  const lastMonth: Record<string, Omit<(typeof prevPayrolls)[number], "employeeId">> = {};
  for (const p of prevPayrolls) {
    const { employeeId, ...rest } = p;
    lastMonth[employeeId] = rest;
  }

  // This-month per-status counts and YTD-before-month LEAVE/SICK counts, keyed by employee —
  // built once from the two batched groupBy queries above, then fed per-employee into computeLop.
  const thisMonthByEmp = new Map<string, Record<AttendanceStatus, number>>();
  for (const g of thisMonthGroups) {
    if (!thisMonthByEmp.has(g.employeeId)) thisMonthByEmp.set(g.employeeId, emptyStatusCounts());
    thisMonthByEmp.get(g.employeeId)![g.status] = g._count._all;
  }
  const ytdBeforeByEmp = new Map<string, { leave: number; sick: number }>();
  for (const g of ytdBeforeGroups) {
    if (!ytdBeforeByEmp.has(g.employeeId)) ytdBeforeByEmp.set(g.employeeId, { leave: 0, sick: 0 });
    const rec = ytdBeforeByEmp.get(g.employeeId)!;
    if (g.status === "LEAVE") rec.leave = g._count._all;
    else if (g.status === "SICK") rec.sick = g._count._all;
  }

  const rows: PayrollRow[] = employees.map((emp) => {
    const lopResult = computeLop({
      thisMonth: thisMonthByEmp.get(emp.id) ?? emptyStatusCounts(),
      casualQuota: emp.casualLeaveQuota,
      sickQuota: emp.sickLeaveQuota,
      ytdBeforeLeave: ytdBeforeByEmp.get(emp.id)?.leave ?? 0,
      ytdBeforeSick: ytdBeforeByEmp.get(emp.id)?.sick ?? 0,
      daysInMonth,
    });
    const lop = { workingDays: lopResult.workingDays, lopDays: lopResult.lopDays, paidDays: lopResult.paidDays };

    const rec = payrollMap.get(emp.id);
    if (rec) {
      return {
        emp: { id: emp.id, empId: emp.empId, name: emp.name },
        recordId: rec.id,
        code: rec.code ?? "",
        role: rec.role ?? "",
        designation: rec.designation ?? emp.designation,
        ctc: rec.ctc,
        lop,
        basic: rec.basic,
        hra: rec.hra,
        cca: rec.cca,
        personalPay: rec.personalPay,
        conveyance: rec.conveyance,
        lta: rec.lta,
        specialAllowance: rec.specialAllowance,
        pla: rec.pla,
        medicalReimb: rec.medicalReimb,
        tds: rec.tds,
        loanAdv: rec.loanAdv,
        epf: rec.epf,
        esi: rec.esi,
        remarks: rec.remarks ?? "",
        extraLines: (rec.extraLines as unknown as PayrollExtraLine[] | null) ?? [],
      };
    }
    // No saved record yet — open BLANK (no auto-fill). CTC is kept only so the
    // optional "Auto-split" helper can default its gross; nothing fills the slip.
    return {
      emp: { id: emp.id, empId: emp.empId, name: emp.name },
      recordId: null,
      code: "",
      role: "",
      designation: emp.designation,
      ctc: emp.totalCtc ?? null,
      lop,
      basic: 0,
      hra: 0,
      cca: 0,
      personalPay: 0,
      conveyance: 0,
      lta: 0,
      specialAllowance: 0,
      pla: 0,
      medicalReimb: 0,
      tds: 0,
      loanAdv: 0,
      epf: 0,
      esi: 0,
      remarks: "",
      extraLines: [],
    };
  });

  // All/Pending/Saved saved-view filter (Task 6). "Pending" = a blank slip with
  // no PayrollRecord yet this month (recordId null); "Saved" = already processed.
  // Counts reflect the full (year/month/employeeId-scoped) roster regardless of
  // `view`, so the pills' counts don't shift under the filter that's applied.
  const pendingCount = rows.filter((r) => r.recordId === null).length;
  const savedCount = rows.length - pendingCount;
  const visibleRows =
    view === "pending"
      ? rows.filter((r) => r.recordId === null)
      : view === "saved"
        ? rows.filter((r) => r.recordId !== null)
        : rows;

  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const viewParam = view ? `&view=${view}` : "";

  return (
    <>
      <PageHeader title="Payout" subtitle={monthLabel}>
        <a
          href={`/api/hr/payroll/export?year=${year}&month=${month}`}
          className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          download
        >
          Export XLSX
        </a>
        <Link
          href={`/hr/payout?year=${prevYear}&month=${prevMonth}${viewParam}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <MonthPicker year={year} month={month} basePath="/hr/payout" />
        <Link
          href={`/hr/payout?year=${nextYear}&month=${nextMonth}${viewParam}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="p-6 sm:p-8">
        {/* Toolbar: the view pills get a quiet label so they read as a filter
            control (not a floating decoration), plus a context chip while a
            view is active — the stat strip below stays full-month truth, so
            this chip is the only place that names what's actually on screen. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">View</span>
          <PayoutViewPills
            year={year}
            month={month}
            employeeId={employeeId}
            view={view}
            counts={{ all: rows.length, pending: pendingCount, saved: savedCount }}
          />
          {view && (
            <Chip>
              Showing {view === "pending" ? "Pending" : "Saved"} · {visibleRows.length} of {rows.length}
            </Chip>
          )}
        </div>
        {scopedEmployee && (
          <ScopedFilterChip
            name={scopedEmployee.name}
            empId={scopedEmployee.empId}
            employeeHref={`/hr/employees/${employeeId}`}
            clearHref={`/hr/payout?year=${year}&month=${month}${viewParam}`}
          />
        )}
        {employees.length === 0 ? (
          <EmptyState
            icon={<BadgeIndianRupee className="h-6 w-6" />}
            title="No active employees"
            description="Add employees to start processing payroll."
          />
        ) : (
          <PayrollEditor
            // Remount whenever the roster-defining URL state changes (month, view
            // pill, employee scope). The editor seeds its row state at mount, so
            // WITHOUT this key a soft navigation would leave it frozen on stale
            // rows — and save() would pair the NEW year/month with OLD figures
            // (same data-corruption class as the attendance month-key fix).
            key={`${year}-${month}-${view ?? "all"}-${employeeId ?? "all"}`}
            rows={visibleRows}
            year={year}
            month={month}
            canWrite={canWrite}
            lastMonth={lastMonth}
            monthTotals={{ total: rows.length, pending: pendingCount, saved: savedCount }}
          />
        )}
      </div>
    </>
  );
}
