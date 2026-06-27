import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-1.5">
      <div className="w-44 shrink-0 text-[13px] text-slate-500">{label}</div>
      <div className="text-[13px] text-slate-900">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-slate-900 pb-1 text-[13px] font-bold uppercase tracking-wide text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

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
  const monthName = MONTHS[record.periodMonth - 1];

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref="/hr/payout" />

      <div className="mx-auto max-w-3xl px-10 py-8 print:px-0 print:py-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              GNE
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">
                GNE — Salary Slip
              </div>
              <div className="text-xs text-slate-500">Human Resources · Payroll</div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-900">
              Salary for {monthName} {record.periodYear}
            </div>
            <div>Printed: {fmtDate(new Date())}</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{emp.name}</h1>

        <Section title="Employee Details">
          <Row label="EMP ID" value={emp.empId} />
          <Row label="Designation" value={record.designation ?? emp.designation} />
          <Row label="Date of Joining" value={fmtDateOnly(emp.dateOfJoining)} />
          {record.code && <Row label="Code" value={record.code} />}
          {record.role && <Row label="Role" value={record.role} />}
          {record.ctc != null && <Row label="CTC" value={fmtINR(record.ctc)} />}
        </Section>

        <Section title="Earnings">
          <Row label="Basic Salary" value={fmtINR(record.basic)} />
          <Row label="HRA" value={fmtINR(record.hra)} />
          <Row label="CCA" value={fmtINR(record.cca)} />
          <Row label="Personal Pay" value={fmtINR(record.personalPay)} />
          <Row label="Conveyance" value={fmtINR(record.conveyance)} />
          <Row label="PLA" value={fmtINR(record.pla)} />
          <Row label="Medical Reimb." value={fmtINR(record.medicalReimb)} />
          <div className="mt-2 flex justify-between border-t-2 border-slate-900 pt-2 text-[13px] font-bold">
            <span>Total Earnings</span>
            <span className="nums">{fmtINR(record.totalEarnings)}</span>
          </div>
        </Section>

        <Section title="Deductions">
          <Row label="TDS" value={fmtINR(record.tds)} />
          <Row label="Loan / Advance" value={fmtINR(record.loanAdv)} />
          <Row label="EPF" value={fmtINR(record.epf)} />
          <Row label="ESI" value={fmtINR(record.esi)} />
          <div className="mt-2 flex justify-between border-t-2 border-slate-900 pt-2 text-[13px] font-bold">
            <span>Total Deductions</span>
            <span className="nums">{fmtINR(record.totalDeductions)}</span>
          </div>
        </Section>

        {/* Net Payable */}
        <div className="mt-8 flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 break-inside-avoid">
          <span className="text-sm font-semibold text-white">Net Payable</span>
          <span className="nums text-xl font-bold text-white">{fmtINR(record.payableAmount)}</span>
        </div>

        {record.remarks && (
          <Section title="Remarks">
            <p className="text-[13px] text-slate-700">{record.remarks}</p>
          </Section>
        )}

        <p className="mt-10 text-center text-[11px] text-slate-400">
          Generated from the GNE ERP · {fmtDate(new Date())}
        </p>
      </div>
    </main>
  );
}
