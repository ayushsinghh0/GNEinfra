import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
import { attendanceLop } from "@/lib/hr-lop";
import { PageHeader, Card, CardBody, CardHeader, btn, cn } from "@/components/ui";
import PayrollForm from "@/components/hr/PayrollForm";

export const dynamic = "force-dynamic";

const moneyStr = (n: number | null | undefined) => (n !== null && n !== undefined ? String(n) : "");
const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function EmployeePayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;
  const sp = await searchParams;

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) notFound();

  // Month scope for the attendance-impact panel (defaults to the current month;
  // payroll URLs carry year/month manually, same convention as attendance).
  const now = new Date();
  const yRaw = parseInt(sp.year ?? "", 10);
  const mRaw = parseInt(sp.month ?? "", 10);
  const year = yRaw >= 2000 && yRaw <= 2100 ? yRaw : now.getUTCFullYear();
  const month = mRaw >= 1 && mRaw <= 12 ? mRaw : now.getUTCMonth() + 1;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const lop = await attendanceLop(id, year, month, emp.casualLeaveQuota, emp.sickLeaveQuota);

  // Attendance-based pay math (integer rupees; day rate = monthly gross ÷ days in month).
  const gross = (emp.salary ?? 0) + (emp.lta ?? 0) + (emp.specialAllowance ?? 0) + (emp.conveyance ?? 0);
  const fixedDed =
    (emp.pfDeduction ?? 0) + (emp.esiDeduction ?? 0) + (emp.tdsDeduction ?? 0) + (emp.otherDeduction ?? 0);
  const lopAmount = gross > 0 ? Math.round((gross / lop.workingDays) * lop.lopDays) : 0;
  const payable = gross - fixedDed - lopAmount;

  const tallies = [
    { label: "Present", value: lop.presentDays, cls: "bg-emerald-50/60 text-emerald-700" },
    { label: "Half-day", value: lop.halfDays, cls: "bg-amber-50/60 text-amber-700" },
    { label: "Absent", value: lop.absentDays, cls: "bg-rose-50/60 text-rose-700" },
    { label: "Leave", value: lop.leaveDays, cls: "bg-blue-50/60 text-blue-700" },
    { label: "Sick", value: lop.sickDays, cls: "bg-violet-50/60 text-violet-700" },
  ];

  const initial = {
    totalCtc: moneyStr(emp.totalCtc),
    salary: moneyStr(emp.salary),
    lta: moneyStr(emp.lta),
    specialAllowance: moneyStr(emp.specialAllowance),
    conveyance: moneyStr(emp.conveyance),
    bankAccountNo: emp.bankAccountNo ?? "",
    bankName: emp.bankName ?? "",
    ifsc: emp.ifsc ?? "",
    panNo: emp.panNo ?? "",
    uan: emp.uan ?? "",
    esicNo: emp.esicNo ?? "",
    pfDeduction: moneyStr(emp.pfDeduction),
    esiDeduction: moneyStr(emp.esiDeduction),
    tdsDeduction: moneyStr(emp.tdsDeduction),
    otherDeduction: moneyStr(emp.otherDeduction),
  };

  return (
    <>
      <PageHeader
        title={emp.name}
        subtitle={`${emp.empId}${emp.designation ? ` · ${emp.designation}` : ""}`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: emp.name }]}
      >
        <Link href={`/hr/payroll/${id}/slip/print?year=${year}&month=${month}`} className={btn("secondary", "sm")}>
          <FileText className="h-4 w-4" />
          Payment slip
        </Link>
      </PageHeader>
      <div className="space-y-6 p-8">
        <Card>
          <CardHeader
            title="Attendance impact"
            subtitle="Attendance-based pay for the month — leave beyond the annual quota becomes Loss of Pay"
            action={
              <span className="flex items-center gap-1">
                <Link
                  href={`/hr/payroll/${id}?year=${prev.y}&month=${prev.m}`}
                  aria-label="Previous month"
                  className={btn("ghost", "sm")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <span className="nums w-32 text-center text-sm font-medium text-slate-700">
                  {MONTHS[month - 1]} {year}
                </span>
                <Link
                  href={`/hr/payroll/${id}?year=${next.y}&month=${next.m}`}
                  aria-label="Next month"
                  className={btn("ghost", "sm")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </span>
            }
          />
          <CardBody className="space-y-4 px-6 py-5">
            {lop.markedDays === 0 ? (
              <p className="text-sm text-slate-500">
                Attendance not marked for {MONTHS[month - 1]} {year} yet — the slip pays the full structure until it is.{" "}
                <Link
                  href={`/hr/attendance?year=${year}&month=${month}&employeeId=${id}`}
                  className="font-medium text-brand-700 hover:text-brand"
                >
                  Mark attendance
                </Link>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {tallies.map((t) => (
                    <div key={t.label} className={cn("min-w-0 rounded-lg px-2.5 py-1.5", t.cls)}>
                      <div className="nums text-base font-semibold leading-none text-slate-900">{t.value}</div>
                      <div className="mt-0.5 truncate text-[11px] font-medium">{t.label}</div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-500">
                  LOP = absent ({fmtDays(lop.absentDays)}) + ½ × half-days ({lop.halfDays}) + leave beyond the annual
                  quota ({fmtDays(lop.unpaidLeaveDays)} of casual {emp.casualLeaveQuota} / sick {emp.sickLeaveQuota}).
                  Leave within quota is paid.
                </p>

                <div className="nums flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
                  <span className="text-slate-600">
                    Paid days{" "}
                    <span className="font-semibold text-slate-900">
                      {fmtDays(lop.paidDays)} / {lop.workingDays}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    Gross <span className="font-semibold text-slate-900">{fmtINR(gross)}</span>
                  </span>
                  <span className="text-slate-600">
                    Loss of Pay ({fmtDays(lop.lopDays)}d){" "}
                    <span className={cn("font-semibold", lopAmount > 0 ? "text-rose-600" : "text-slate-900")}>
                      − {fmtINR(lopAmount)}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    Fixed deductions <span className="font-semibold text-slate-900">− {fmtINR(fixedDed)}</span>
                  </span>
                  <span className="text-slate-600">
                    Payable <span className="font-semibold text-emerald-600">{fmtINR(payable)}</span>
                  </span>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            {/* key={id}: remount on employee-to-employee navigation so the seeded state can't leak. */}
            <PayrollForm key={id} id={id} initial={initial} canWrite={canWrite} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
