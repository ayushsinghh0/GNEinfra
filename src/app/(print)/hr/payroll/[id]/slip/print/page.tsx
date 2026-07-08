import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { fmtDate, fmtDateOnly, fmtINR } from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import PrintBar from "@/components/PrintBar";
import { getCompany } from "@/lib/company";

export const dynamic = "force-dynamic";

// Structure-based payment slip: earnings and deductions come from the employee's
// stored pay structure (edited on /hr/payroll), not a monthly payroll run.
export default async function PaymentSlipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.mustChangePassword || !HR_VIEW.includes(viewer.role)) notFound();

  const { id } = await params;
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) notFound();
  const company = await getCompany();

  const earnings = [
    { label: "Salary", value: emp.salary ?? 0 },
    { label: "LTA", value: emp.lta ?? 0 },
    { label: "Special Allowance", value: emp.specialAllowance ?? 0 },
    { label: "Conveyance", value: emp.conveyance ?? 0 },
  ];
  const deductions = [
    { label: "PF", value: emp.pfDeduction ?? 0 },
    { label: "ESI", value: emp.esiDeduction ?? 0 },
    { label: "TDS", value: emp.tdsDeduction ?? 0 },
    { label: "Other", value: emp.otherDeduction ?? 0 },
  ];
  const gross = earnings.reduce((s, r) => s + r.value, 0);
  const totalDed = deductions.reduce((s, r) => s + r.value, 0);
  const net = gross - totalDed;

  const th = "border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const td = "border border-slate-300 px-3 py-1.5 text-[12px] text-slate-800";
  const tdNum = "border border-slate-300 px-3 py-1.5 text-right text-[12px] nums text-slate-900";

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/hr/payroll/${emp.id}`} />

      <div className="mx-auto max-w-[794px] px-10 py-8 print:px-0 print:py-0">
        {/* ── Letterhead ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-4 break-inside-avoid">
          <Image src="/brand/gne-infra.png" alt={company.name} width={120} height={34} className="h-9 w-auto" priority />
          <div>
            <div className="text-[15px] font-bold text-slate-900">{company.name}</div>
            <div className="text-[10.5px] leading-tight text-slate-500">{company.addressLines.join(", ")}</div>
          </div>
        </div>

        <h1 className="font-display mt-5 text-center text-[15px] font-bold uppercase tracking-[0.2em] text-slate-900">
          Payment Slip
        </h1>

        {/* ── Employee identity ──────────────────────────────────────────── */}
        <table className="mt-5 w-full border-collapse break-inside-avoid">
          <tbody>
            <tr>
              <td className={th}>Employee</td>
              <td className={td}>{emp.name}</td>
              <td className={th}>EMP ID</td>
              <td className={`${td} nums font-mono`}>{emp.empId}</td>
            </tr>
            <tr>
              <td className={th}>Designation</td>
              <td className={td}>{emp.designation || "—"}</td>
              <td className={th}>Band</td>
              <td className={td}>{emp.band || "—"}</td>
            </tr>
            <tr>
              <td className={th}>Bank A/C</td>
              <td className={`${td} nums`}>{emp.bankAccountNo || "—"}</td>
              <td className={th}>IFSC</td>
              <td className={`${td} nums`}>{emp.ifsc || "—"}</td>
            </tr>
            <tr>
              <td className={th}>PAN</td>
              <td className={`${td} nums`}>{emp.panNo || "—"}</td>
              <td className={th}>UAN</td>
              <td className={`${td} nums`}>{emp.uan || "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Earnings / Deductions ──────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-5 break-inside-avoid">
          <table className="w-full border-collapse">
            <thead>
              <tr><th className={th} colSpan={2}>Earnings</th></tr>
            </thead>
            <tbody>
              {earnings.map((r) => (
                <tr key={r.label}><td className={td}>{r.label}</td><td className={tdNum}>{fmtINR(r.value)}</td></tr>
              ))}
              <tr><td className={`${td} font-semibold`}>Gross Earnings</td><td className={`${tdNum} font-semibold`}>{fmtINR(gross)}</td></tr>
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <thead>
              <tr><th className={th} colSpan={2}>Deductions</th></tr>
            </thead>
            <tbody>
              {deductions.map((r) => (
                <tr key={r.label}><td className={td}>{r.label}</td><td className={tdNum}>{fmtINR(r.value)}</td></tr>
              ))}
              <tr><td className={`${td} font-semibold`}>Total Deductions</td><td className={`${tdNum} font-semibold`}>{fmtINR(totalDed)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Net pay ────────────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between border-2 border-slate-900 px-4 py-2.5 break-inside-avoid">
          <span className="text-[13px] font-bold uppercase tracking-wide text-slate-900">Net Pay</span>
          <span className="nums text-[15px] font-bold text-slate-900">{fmtINR(net)}</span>
        </div>
        <p className="mt-1.5 text-[11px] italic text-slate-500">{amountInWords(net)}</p>

        {emp.totalCtc != null && (
          <p className="nums mt-4 text-[11px] text-slate-400">
            Annual CTC {fmtINR(emp.totalCtc)} · Date of joining {fmtDateOnly(emp.dateOfJoining) ?? "—"}
          </p>
        )}

        <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Generated by GNE ERP · {fmtDate(new Date())} · Computer-generated payment slip.
        </div>
      </div>
    </main>
  );
}
