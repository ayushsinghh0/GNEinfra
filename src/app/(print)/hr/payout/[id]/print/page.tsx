import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
import { amountInWords } from "@/lib/number-to-words";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ERow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-[12px] text-slate-500 whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-right text-[12px] font-medium text-slate-900 nums">{value}</td>
    </tr>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1">
      <span className="w-36 shrink-0 text-[12px] text-slate-500">{label}</span>
      <span className="text-[12px] font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PayslipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // RBAC guard — standalone page outside the app layout so it prints clean.
  const viewer = await getCurrentUser();
  if (!viewer || viewer.mustChangePassword || !HR_VIEW.includes(viewer.role)) notFound();

  const { id } = await params;
  const record = await prisma.payrollRecord.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!record) notFound();

  const emp = record.employee;

  // ── Paid-days computation from that month's attendance ────────────────────
  const monthStart  = new Date(Date.UTC(record.periodYear, record.periodMonth - 1, 1));
  const monthEnd    = new Date(Date.UTC(record.periodYear, record.periodMonth, 1));
  const daysInMonth = new Date(Date.UTC(record.periodYear, record.periodMonth, 0)).getUTCDate();
  const att = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { employeeId: record.employeeId, date: { gte: monthStart, lt: monthEnd } },
    _count: { _all: true },
  });
  const cnt      = (s: string) => att.find((a) => a.status === s)?._count._all ?? 0;
  const lopDays  = cnt("ABSENT") + 0.5 * cnt("HALF_DAY");
  const paidDays = daysInMonth - lopDays;

  const monthName = MONTHS[record.periodMonth - 1];
  const hasBankInfo = emp.bankAccountNo || emp.panNo || emp.uan;

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref="/hr/payout" />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">

        {/* ── Letterhead ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/gne-infra.png"
              alt="GNE Infra"
              width={120}
              height={34}
              className="h-9 w-auto"
              priority
            />
            <div>
              <div className="text-base font-bold leading-tight tracking-tight text-slate-900">
                Salary Slip
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Human Resources · Payroll
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-900">
              Salary Slip — {monthName} {record.periodYear}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Printed: {fmtDate(new Date())}
            </div>
          </div>
        </div>

        {/* ── Employee block (two columns) ─────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-x-10 break-inside-avoid rounded-xl border border-slate-200 bg-slate-50 px-6 py-5">
          {/* Left: identity */}
          <div>
            <div className="mb-3">
              <div className="text-lg font-bold tracking-tight text-slate-900">{emp.name}</div>
              <div className="text-[12px] text-slate-500">
                {record.designation ?? emp.designation ?? "—"}
              </div>
            </div>
            <InfoRow label="EMP ID"          value={emp.empId} />
            <InfoRow label="Date of Joining" value={fmtDateOnly(emp.dateOfJoining)} />
          </div>

          {/* Right: bank & statutory — only shown fields that have values */}
          <div className="border-l border-slate-200 pl-6">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Bank &amp; Statutory
            </div>
            {hasBankInfo ? (
              <>
                <InfoRow label="Bank A/C" value={emp.bankAccountNo} />
                <InfoRow label="PAN"      value={emp.panNo} />
                <InfoRow label="UAN"      value={emp.uan} />
              </>
            ) : (
              <span className="text-[12px] text-slate-400">No bank / statutory info on file</span>
            )}
          </div>
        </div>

        {/* ── Days row ────────────────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-3 gap-4 break-inside-avoid">
          {(
            [
              { label: "Days in Month", val: daysInMonth },
              { label: "Paid Days",     val: paidDays },
              { label: "LOP Days",      val: lopDays },
            ] as { label: string; val: number }[]
          ).map(({ label, val }) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center"
            >
              <div className="nums text-xl font-bold text-slate-900">{val}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Earnings + Deductions side-by-side ─────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-6 break-inside-avoid">

          {/* Earnings */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-3 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Earnings
            </h2>
            <table className="w-full">
              <tbody>
                <ERow label="Basic Salary"   value={fmtINR(record.basic)} />
                <ERow label="HRA"            value={fmtINR(record.hra)} />
                <ERow label="CCA"            value={fmtINR(record.cca)} />
                <ERow label="Personal Pay"   value={fmtINR(record.personalPay)} />
                <ERow label="Conveyance"     value={fmtINR(record.conveyance)} />
                <ERow label="PLA"            value={fmtINR(record.pla)} />
                <ERow label="Medical Reimb." value={fmtINR(record.medicalReimb)} />
              </tbody>
            </table>
            <div className="mt-3 flex justify-between border-t-2 border-slate-900 pt-2">
              <span className="text-[12px] font-bold text-slate-900">Total Earnings</span>
              <span className="nums text-[12px] font-bold text-slate-900">
                {fmtINR(record.totalEarnings)}
              </span>
            </div>
          </div>

          {/* Deductions */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-3 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Deductions
            </h2>
            <table className="w-full">
              <tbody>
                <ERow label="TDS"           value={fmtINR(record.tds)} />
                <ERow label="Loan / Advance" value={fmtINR(record.loanAdv)} />
                <ERow label="EPF"           value={fmtINR(record.epf)} />
                <ERow label="ESI"           value={fmtINR(record.esi)} />
              </tbody>
            </table>
            <div className="mt-3 flex justify-between border-t-2 border-slate-900 pt-2">
              <span className="text-[12px] font-bold text-slate-900">Total Deductions</span>
              <span className="nums text-[12px] font-bold text-slate-900">
                {fmtINR(record.totalDeductions)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Net Pay banner ──────────────────────────────────────────────── */}
        <div className="mt-5 break-inside-avoid rounded-xl bg-slate-900 px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Net Pay</span>
            <span className="nums text-2xl font-bold text-white">
              {fmtINR(record.payableAmount)}
            </span>
          </div>
          <div className="mt-1 text-[12px] italic text-slate-400">
            {amountInWords(record.payableAmount)}
          </div>
        </div>

        {/* ── Remarks (conditional) ───────────────────────────────────────── */}
        {record.remarks && (
          <div className="mt-5 break-inside-avoid rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Remarks
            </div>
            <p className="text-[13px] text-slate-700">{record.remarks}</p>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="mt-8 border-t border-slate-200 pt-4 text-center">
          <p className="text-[11px] text-slate-400">
            This is a system-generated salary slip and does not require a signature.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Generated by GNE ERP · {fmtDate(new Date())}
          </p>
        </div>

      </div>
    </main>
  );
}
