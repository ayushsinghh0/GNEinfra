import Link from "next/link";
import { ChevronLeft, ChevronRight, BadgeIndianRupee } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { MONTHS } from "@/lib/hr-validation";
import { PageHeader, EmptyState } from "@/components/ui";
import PayrollEditor, { type PayrollRow } from "@/components/hr/PayrollEditor";

export const dynamic = "force-dynamic";

export default async function PayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const sp = await searchParams;
  const now = new Date();
  const year = Math.max(2000, Math.min(2100, Number(sp.year) || now.getUTCFullYear()));
  const month = Math.max(1, Math.min(12, Number(sp.month) || now.getUTCMonth() + 1));

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const [employees, payrolls, prevPayrolls] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        empId: true,
        name: true,
        designation: true,
        totalCtc: true,
        salary: true,
        conveyance: true,
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
        pla: true,
        medicalReimb: true,
        tds: true,
        loanAdv: true,
        epf: true,
        esi: true,
        remarks: true,
      },
    }),
    prisma.payrollRecord.findMany({
      where: { periodYear: prevYear, periodMonth: prevMonth },
      select: {
        employeeId: true,
        basic: true, hra: true, cca: true, personalPay: true,
        conveyance: true, pla: true, medicalReimb: true,
        tds: true, loanAdv: true, epf: true, esi: true,
      },
    }),
  ]);

  const payrollMap = new Map(payrolls.map((p) => [p.employeeId, p]));

  // Previous month's figures, for the editor's "Copy last month" shortcut.
  const lastMonth: Record<string, Omit<(typeof prevPayrolls)[number], "employeeId">> = {};
  for (const p of prevPayrolls) {
    const { employeeId, ...rest } = p;
    lastMonth[employeeId] = rest;
  }

  const rows: PayrollRow[] = employees.map((emp) => {
    const rec = payrollMap.get(emp.id);
    if (rec) {
      return {
        emp: { id: emp.id, empId: emp.empId, name: emp.name },
        recordId: rec.id,
        code: rec.code ?? "",
        role: rec.role ?? "",
        designation: rec.designation ?? emp.designation,
        ctc: rec.ctc,
        basic: rec.basic,
        hra: rec.hra,
        cca: rec.cca,
        personalPay: rec.personalPay,
        conveyance: rec.conveyance,
        pla: rec.pla,
        medicalReimb: rec.medicalReimb,
        tds: rec.tds,
        loanAdv: rec.loanAdv,
        epf: rec.epf,
        esi: rec.esi,
        remarks: rec.remarks ?? "",
      };
    }
    // Prefill from employee master
    return {
      emp: { id: emp.id, empId: emp.empId, name: emp.name },
      recordId: null,
      code: "",
      role: "",
      designation: emp.designation,
      ctc: emp.totalCtc ?? null,
      basic: emp.salary ?? 0,
      hra: 0,
      cca: 0,
      personalPay: 0,
      conveyance: emp.conveyance ?? 0,
      pla: 0,
      medicalReimb: 0,
      tds: 0,
      loanAdv: 0,
      epf: 0,
      esi: 0,
      remarks: "",
    };
  });

  const monthLabel = `${MONTHS[month - 1]} ${year}`;

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
          href={`/hr/payout?year=${prevYear}&month=${prevMonth}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="nums text-sm font-medium text-slate-700 min-w-[7rem] text-center">
          {monthLabel}
        </span>
        <Link
          href={`/hr/payout?year=${nextYear}&month=${nextMonth}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="p-6 sm:p-8">
        {employees.length === 0 ? (
          <EmptyState
            icon={<BadgeIndianRupee className="h-6 w-6" />}
            title="No active employees"
            description="Add employees to start processing payroll."
          />
        ) : (
          <PayrollEditor rows={rows} year={year} month={month} canWrite={canWrite} lastMonth={lastMonth} />
        )}
      </div>
    </>
  );
}
