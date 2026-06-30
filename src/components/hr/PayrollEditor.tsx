"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeIndianRupee, ChevronRight, Copy, Plus, Printer, Search, Trash2, Wand2 } from "lucide-react";
import { computePayrollTotals, type PayrollExtraLine, type PayrollLineKind } from "@/lib/hr-validation";
import { fmtINR } from "@/lib/format";
import { Button, StatCard, cn } from "@/components/ui";
import SlideOver from "@/components/SlideOver";

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
  lta: number;
  specialAllowance: number;
  pla: number;
  medicalReimb: number;
  tds: number;
  loanAdv: number;
  epf: number;
  esi: number;
  remarks: string;
  extraLines: PayrollExtraLine[];
};

type NumericKey =
  | "basic" | "hra" | "cca" | "personalPay" | "conveyance" | "lta" | "specialAllowance" | "pla" | "medicalReimb"
  | "tds" | "loanAdv" | "epf" | "esi";

type RowState = PayrollRow & { saving: boolean; savedId: string | null; dirty: boolean; error: string | null };

const EARNINGS: { key: NumericKey; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "cca", label: "CCA" },
  { key: "personalPay", label: "Personal Pay" },
  { key: "conveyance", label: "Conveyance" },
  { key: "lta", label: "LTA" },
  { key: "specialAllowance", label: "Special Allowance" },
  { key: "pla", label: "PLA" },
  { key: "medicalReimb", label: "Medical reimb." },
];
const DEDUCTIONS: { key: NumericKey; label: string }[] = [
  { key: "tds", label: "TDS" },
  { key: "loanAdv", label: "Loan / Advance" },
  { key: "epf", label: "EPF" },
  { key: "esi", label: "ESI" },
];

// Standard monthly-gross split — mirrors the payroll seeding rules.
// existingLta / existingSpecialAllowance are already part of the gross, so
// personalPay absorbs what remains after all fixed components are subtracted.
function splitFromGross(gross: number, existingLta = 0, existingSpecialAllowance = 0): Partial<Record<NumericKey, number>> {
  const g = Math.max(0, Math.round(gross));
  const basic = Math.round(g * 0.5);
  const hra = Math.round(g * 0.2);
  const cca = Math.round(g * 0.05);
  const conveyance = 1600;
  const medicalReimb = 1250;
  const pla = Math.round(g * 0.05);
  const personalPay = Math.max(0, g - basic - hra - cca - conveyance - medicalReimb - pla - existingLta - existingSpecialAllowance);
  const epf = Math.round(basic * 0.12);
  const esi = g > 0 && g < 21000 ? Math.round(g * 0.0075) : 0;
  return { basic, hra, cca, conveyance, medicalReimb, pla, personalPay, epf, esi };
}

export default function PayrollEditor({
  rows: initial,
  year,
  month,
  canWrite,
  lastMonth,
}: {
  rows: PayrollRow[];
  year: number;
  month: number;
  canWrite: boolean;
  lastMonth?: Record<string, Pick<PayrollRow, NumericKey>>;
}) {
  const [rows, setRows] = useState<RowState[]>(
    initial.map((r) => ({ ...r, saving: false, savedId: r.recordId, dirty: false, error: null }))
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  function patch(idx: number, fields: Partial<RowState>, markDirty = true) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...fields, ...(markDirty ? { dirty: true } : {}) } : r)));
  }
  const setNum = (idx: number, field: NumericKey, raw: number) =>
    patch(idx, { [field]: Math.max(0, Math.floor(isNaN(raw) ? 0 : raw)) } as Partial<RowState>);

  async function save(idx: number) {
    const r = rows[idx];
    patch(idx, { saving: true, error: null }, false);
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: r.emp.id, year, month,
          code: r.code, role: r.role, designation: r.designation, ctc: r.ctc,
          basic: r.basic, hra: r.hra, cca: r.cca, personalPay: r.personalPay,
          conveyance: r.conveyance, lta: r.lta, specialAllowance: r.specialAllowance,
          pla: r.pla, medicalReimb: r.medicalReimb,
          tds: r.tds, loanAdv: r.loanAdv, epf: r.epf, esi: r.esi, remarks: r.remarks,
          extraLines: r.extraLines,
        }),
      });
      const json = (await res.json()) as { record?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      patch(idx, { saving: false, savedId: json.record!.id, dirty: false, error: null }, false);
    } catch (e) {
      patch(idx, { saving: false, error: (e as Error).message }, false);
    }
  }

  const totals = useMemo(() => {
    let payable = 0, earnings = 0, processed = 0;
    for (const r of rows) {
      const t = computePayrollTotals(r);
      payable += t.payableAmount;
      earnings += t.totalEarnings;
      if (r.savedId) processed++;
    }
    return { payable, earnings, processed, pending: rows.length - processed };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !q || r.emp.name.toLowerCase().includes(q) || r.emp.empId.toLowerCase().includes(q));
  }, [rows, query]);

  const active = openIdx === null ? null : rows[openIdx];

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total payout" value={fmtINR(totals.payable)} icon={<BadgeIndianRupee className="h-4 w-4" />} tone="brand" />
        <StatCard label="Total earnings" value={fmtINR(totals.earnings)} tone="emerald" />
        <StatCard label="Processed" value={`${totals.processed}/${rows.length}`} tone="blue" spark={rows.length ? (totals.processed / rows.length) * 100 : 0} />
        <StatCard label="Pending" value={totals.pending} tone="amber" />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
        />
      </div>

      {/* Employee list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <div className="hidden items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:flex">
          <div className="grid flex-1 grid-cols-[minmax(0,1fr)_7rem_8rem_6rem] gap-4">
            <span>Employee</span>
            <span className="text-right">CTC (annual)</span>
            <span className="text-right">Net payable</span>
            <span className="text-center">Status</span>
          </div>
          <span className="w-16 text-right">Slip</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {filtered.map(({ r, idx }) => {
            const { payableAmount, totalEarnings } = computePayrollTotals(r);
            const untouched = !r.savedId && !r.dirty && totalEarnings === 0;
            return (
              <li key={r.emp.id} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-50/40 sm:px-5">
                <button
                  type="button"
                  onClick={() => setOpenIdx(idx)}
                  className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/30 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_6rem]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{r.emp.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      <span className="nums">{r.emp.empId}</span> · {r.designation || "—"}
                    </span>
                  </span>
                  <span className="nums hidden text-right text-sm text-slate-500 sm:block">{fmtINR(r.ctc)}</span>
                  <span className={cn("nums text-right text-sm font-semibold", untouched ? "text-slate-300" : "text-teal-700")}>
                    {untouched ? "—" : fmtINR(payableAmount)}
                  </span>
                  <span className="hidden justify-center sm:flex">
                    <StatusBadge dirty={r.dirty} saved={!!r.savedId} />
                  </span>
                </button>
                <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                  {r.savedId ? (
                    <Link
                      href={`/hr/payout/${r.savedId}/print`}
                      target="_blank"
                      aria-label={`Print payslip for ${r.emp.name}`}
                      className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="grid h-8 w-8 place-items-center text-slate-200"><Printer className="h-4 w-4" /></span>
                  )}
                  <button type="button" onClick={() => setOpenIdx(idx)} aria-label="Edit" className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No employees match “{query}”.</p>}
      </div>

      {/* Editor slide-over */}
      <SlideOver
        open={active !== null}
        onClose={() => setOpenIdx(null)}
        icon={<BadgeIndianRupee className="h-5 w-5" />}
        title={active?.emp.name ?? ""}
        subtitle={active ? `${active.emp.empId} · ${active.designation || "—"}` : ""}
        footer={
          active && openIdx !== null ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <span className="text-slate-500">Net payable</span>{" "}
                <span className="nums font-bold text-teal-700">{fmtINR(computePayrollTotals(active).payableAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                {active.savedId && (
                  <Link href={`/hr/payout/${active.savedId}/print`} target="_blank" className="press inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Link>
                )}
                {canWrite && (
                  <Button size="sm" onClick={() => save(openIdx)} disabled={active.saving || !active.dirty}>
                    {active.saving ? "Saving…" : active.savedId ? "Save changes" : "Save payslip"}
                  </Button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {active && openIdx !== null && (
          <EditorBody
            key={active.emp.id}
            row={active}
            idx={openIdx}
            canWrite={canWrite}
            lastMonth={lastMonth?.[active.emp.id]}
            onNum={setNum}
            onMany={(idx, fields) => patch(idx, fields as Partial<RowState>)}
            onExtra={(idx, lines) => patch(idx, { extraLines: lines })}
          />
        )}
      </SlideOver>
    </div>
  );
}

function StatusBadge({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">Unsaved</span>;
  if (saved) return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Saved</span>;
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Draft</span>;
}

function EditorBody({
  row, idx, canWrite, lastMonth, onNum, onMany, onExtra,
}: {
  row: RowState;
  idx: number;
  canWrite: boolean;
  lastMonth?: Pick<PayrollRow, NumericKey>;
  onNum: (idx: number, field: NumericKey, raw: number) => void;
  onMany: (idx: number, fields: Partial<Record<NumericKey, number> & { remarks: string }>) => void;
  onExtra: (idx: number, lines: PayrollExtraLine[]) => void;
}) {
  const { totalEarnings, totalDeductions, payableAmount } = computePayrollTotals(row);
  const [gross, setGross] = useState(() => (row.ctc ? Math.round(row.ctc / 12) : totalEarnings || 0));

  return (
    <div className="space-y-6">
      {row.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{row.error}</div>}

      {/* Quick fill */}
      {canWrite && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick fill — optional</p>
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Monthly gross</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                <input
                  type="number" min={0} value={gross}
                  onChange={(e) => setGross(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="nums h-10 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 text-right text-sm outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
                />
              </div>
            </label>
            <Button variant="secondary" size="md" onClick={() => onMany(idx, splitFromGross(gross, row.lta, row.specialAllowance))} title="Split into Basic/HRA/… and compute EPF/ESI">
              <Wand2 className="h-4 w-4" /> Auto-split
            </Button>
          </div>
          {lastMonth && (
            <button
              type="button"
              onClick={() => onMany(idx, { ...lastMonth })}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              <Copy className="h-3.5 w-3.5" /> Copy last month’s figures
            </button>
          )}
        </div>
      )}

      {/* Earnings */}
      <Section title="Earnings" total={totalEarnings} tone="emerald">
        {EARNINGS.map((f) => (
          <MoneyRow key={f.key} label={f.label} value={row[f.key]} disabled={!canWrite} onChange={(v) => onNum(idx, f.key, v)} />
        ))}
      </Section>

      {/* Deductions */}
      <Section title="Deductions" total={totalDeductions} tone="rose">
        {DEDUCTIONS.map((f) => (
          <MoneyRow key={f.key} label={f.label} value={row[f.key]} disabled={!canWrite} onChange={(v) => onNum(idx, f.key, v)} />
        ))}
      </Section>

      {/* Custom line items */}
      <ExtraLines idx={idx} lines={row.extraLines} canWrite={canWrite} onExtra={onExtra} />

      {/* Net */}
      <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3 ring-1 ring-inset ring-teal-100">
        <span className="text-sm font-semibold text-teal-900">Net payable</span>
        <span className="nums text-xl font-bold text-teal-700">{fmtINR(payableAmount)}</span>
      </div>

      {/* Remarks */}
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Remarks</span>
        <textarea
          value={row.remarks}
          disabled={!canWrite}
          onChange={(e) => onMany(idx, { remarks: e.target.value })}
          rows={2}
          placeholder="Optional note for this payslip…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-slate-50"
        />
      </label>
    </div>
  );
}

function Section({ title, total, tone, children }: { title: string; total: number; tone: "emerald" | "rose"; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <span className={cn("nums text-sm font-semibold", tone === "emerald" ? "text-emerald-700" : "text-rose-600")}>{fmtINR(total)}</span>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">{children}</div>
    </div>
  );
}

function ExtraLines({
  idx, lines, canWrite, onExtra,
}: {
  idx: number;
  lines: PayrollExtraLine[];
  canWrite: boolean;
  onExtra: (idx: number, lines: PayrollExtraLine[]) => void;
}) {
  const update = (i: number, fields: Partial<PayrollExtraLine>) =>
    onExtra(idx, lines.map((l, j) => (j === i ? { ...l, ...fields } : l)));
  const add = () => onExtra(idx, [...lines, { label: "", amount: 0, kind: "earning" }]);
  const remove = (i: number) => onExtra(idx, lines.filter((_, j) => j !== i));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custom items</h3>
        {canWrite && (
          <button type="button" onClick={add} className="press inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        )}
      </div>
      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-400">
          No custom lines. Add a bonus, arrears, or a one-off deduction — it prints on the slip.
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={l.label}
                disabled={!canWrite}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label (e.g. Bonus)"
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-slate-50"
              />
              <select
                value={l.kind}
                disabled={!canWrite}
                onChange={(e) => update(i, { kind: e.target.value as PayrollLineKind })}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-slate-50"
              >
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
              </select>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                <input
                  type="number" min={0} step={1} value={l.amount} disabled={!canWrite}
                  onChange={(e) => update(i, { amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="nums h-9 w-28 rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-right text-sm text-slate-900 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-slate-50"
                />
              </div>
              {canWrite && (
                <button type="button" onClick={() => remove(i)} aria-label="Remove line" className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
        <input
          type="number" min={0} step={1} value={value} disabled={disabled}
          onChange={(e) => onChange(Math.floor(Number(e.target.value) || 0))}
          className="nums h-9 w-36 rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 text-right text-sm text-slate-900 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
    </div>
  );
}
