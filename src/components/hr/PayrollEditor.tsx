"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { computePayrollTotals } from "@/lib/hr-validation";
import { fmtINR } from "@/lib/format";

export type PayrollRow = {
  emp: { id: string; empId: string; name: string };
  recordId: string | null;
  code: string;
  role: string;
  designation: string;
  ctc: number | null;
  basic: number;
  hra: number;
  cca: number;
  personalPay: number;
  conveyance: number;
  pla: number;
  medicalReimb: number;
  tds: number;
  loanAdv: number;
  epf: number;
  esi: number;
  remarks: string;
};

type RowState = PayrollRow & {
  saving: boolean;
  savedId: string | null;
  error: string | null;
};

const EARNINGS_FIELDS = [
  { key: "basic" as const, label: "Basic" },
  { key: "hra" as const, label: "HRA" },
  { key: "cca" as const, label: "CCA" },
  { key: "personalPay" as const, label: "Pers.Pay" },
  { key: "conveyance" as const, label: "Conv" },
  { key: "pla" as const, label: "PLA" },
  { key: "medicalReimb" as const, label: "Med" },
];

const DEDUCTION_FIELDS = [
  { key: "tds" as const, label: "TDS" },
  { key: "loanAdv" as const, label: "Loan" },
  { key: "epf" as const, label: "EPF" },
  { key: "esi" as const, label: "ESI" },
];

type NumericKey =
  | "basic" | "hra" | "cca" | "personalPay" | "conveyance" | "pla" | "medicalReimb"
  | "tds" | "loanAdv" | "epf" | "esi";

export default function PayrollEditor({
  rows: initial,
  year,
  month,
  canWrite,
}: {
  rows: PayrollRow[];
  year: number;
  month: number;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<RowState[]>(
    initial.map((r) => ({ ...r, saving: false, savedId: r.recordId, error: null }))
  );

  function updateNum(idx: number, field: NumericKey, raw: number) {
    const val = isNaN(raw) ? 0 : Math.max(0, raw);
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    );
  }

  async function save(idx: number) {
    const r = rows[idx];
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, saving: true, error: null } : row))
    );
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: r.emp.id,
          year,
          month,
          code: r.code,
          role: r.role,
          designation: r.designation,
          ctc: r.ctc,
          basic: r.basic,
          hra: r.hra,
          cca: r.cca,
          personalPay: r.personalPay,
          conveyance: r.conveyance,
          pla: r.pla,
          medicalReimb: r.medicalReimb,
          tds: r.tds,
          loanAdv: r.loanAdv,
          epf: r.epf,
          esi: r.esi,
          remarks: r.remarks,
        }),
      });
      const json = (await res.json()) as { record?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setRows((prev) =>
        prev.map((row, i) =>
          i === idx ? { ...row, saving: false, savedId: json.record!.id, error: null } : row
        )
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((row, i) =>
          i === idx ? { ...row, saving: false, error: (e as Error).message } : row
        )
      );
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[1440px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 min-w-[180px]">Employee</th>
            {EARNINGS_FIELDS.map((f) => (
              <th key={f.key} className="px-2 py-3 min-w-[80px] text-right">{f.label}</th>
            ))}
            <th className="px-3 py-3 min-w-[90px] text-right text-teal-700">Earnings</th>
            {DEDUCTION_FIELDS.map((f) => (
              <th key={f.key} className="px-2 py-3 min-w-[80px] text-right">{f.label}</th>
            ))}
            <th className="px-3 py-3 min-w-[90px] text-right text-red-600">Deduct</th>
            <th className="px-3 py-3 min-w-[90px] text-right text-teal-700">Payable</th>
            <th className="px-4 py-3 min-w-[90px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, idx) => {
            const { totalEarnings, totalDeductions, payableAmount } = computePayrollTotals(r);
            const printId = r.savedId;

            return (
              <tr key={r.emp.id} className="group hover:bg-slate-50/60 align-middle">
                {/* Employee */}
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900 leading-snug">{r.emp.name}</div>
                  <div className="nums text-xs text-slate-400">{r.emp.empId}</div>
                  {r.error && (
                    <div className="mt-0.5 text-[11px] text-red-500">{r.error}</div>
                  )}
                </td>

                {/* Earnings inputs */}
                {EARNINGS_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={r[f.key]}
                      disabled={!canWrite}
                      onChange={(e) => updateNum(idx, f.key, Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm nums focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </td>
                ))}

                {/* Total Earnings (computed) */}
                <td className="px-3 py-2 text-right">
                  <span className="nums font-semibold text-teal-700">{fmtINR(totalEarnings)}</span>
                </td>

                {/* Deduction inputs */}
                {DEDUCTION_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={r[f.key]}
                      disabled={!canWrite}
                      onChange={(e) => updateNum(idx, f.key, Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm nums focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </td>
                ))}

                {/* Total Deductions (computed) */}
                <td className="px-3 py-2 text-right">
                  <span className="nums font-semibold text-red-600">{fmtINR(totalDeductions)}</span>
                </td>

                {/* Net Payable (computed) */}
                <td className="px-3 py-2 text-right">
                  <span className="nums font-bold text-teal-700">{fmtINR(payableAmount)}</span>
                </td>

                {/* Save + Print */}
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <button
                        onClick={() => save(idx)}
                        disabled={r.saving}
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {r.saving ? "Saving…" : "Save"}
                      </button>
                    )}
                    {printId && (
                      <Link
                        href={`/hr/payout/${printId}/print`}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 transition-colors"
                        target="_blank"
                        aria-label="Print payslip"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
