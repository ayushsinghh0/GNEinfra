"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeIndianRupee, ChevronRight, Copy, Plus, Printer, Search, Trash2, Wand2 } from "lucide-react";
import { computePayrollTotals, type PayrollExtraLine, type PayrollLineKind } from "@/lib/hr-validation";
import { fmtINR } from "@/lib/format";
import { Button, StatCard, StatusChip, cn } from "@/components/ui";
import SlideOver from "@/components/SlideOver";
import Segmented from "@/components/Segmented";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

export type PayrollRow = {
  emp: { id: string; empId: string; name: string };
  recordId: string | null;
  code: string;
  role: string;
  designation: string;
  ctc: number | null;
  /** Attendance-derived LOP day counts for this employee/month (src/lib/hr-lop.ts). */
  lop?: { workingDays: number; lopDays: number; paidDays: number };
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

// Reserved extraLines label for the attendance-derived LOP deduction. Once inserted it's a
// normal, fully-editable extraLines row (see ExtraLines) — never auto-overwritten.
const LOP_LABEL = "Loss of Pay";

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

// The exact per-row request body — shared by the single-row save() and the
// batch save-all so both hit the server with an identical shape (the server
// re-validates + recomputes totals either way; this is just DRY wiring).
function rowPayload(r: PayrollRow, year: number, month: number) {
  return {
    employeeId: r.emp.id, year, month,
    code: r.code, role: r.role, designation: r.designation, ctc: r.ctc,
    basic: r.basic, hra: r.hra, cca: r.cca, personalPay: r.personalPay,
    conveyance: r.conveyance, lta: r.lta, specialAllowance: r.specialAllowance,
    pla: r.pla, medicalReimb: r.medicalReimb,
    tds: r.tds, loanAdv: r.loanAdv, epf: r.epf, esi: r.esi, remarks: r.remarks,
    extraLines: r.extraLines,
  };
}

// Payroll's client-side status — feeds the shared statusMeta registry (DRAFT/UNSAVED/SAVED).
function payrollStatus(dirty: boolean, saved: boolean): "UNSAVED" | "SAVED" | "DRAFT" {
  return dirty ? "UNSAVED" : saved ? "SAVED" : "DRAFT";
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
  const [view, setView] = useState<"all" | "pending" | "saved">("all");
  const [confirmSplitAll, setConfirmSplitAll] = useState(false);

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
        body: JSON.stringify(rowPayload(r, year, month)),
      });
      const json = (await res.json()) as { record?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      patch(idx, { saving: false, savedId: json.record!.id, dirty: false, error: null }, false);
    } catch (e) {
      patch(idx, { saving: false, error: (e as Error).message }, false);
    }
  }

  async function saveAll() {
    const dirtyIdx = rows.reduce<number[]>((acc, r, i) => (r.dirty ? [...acc, i] : acc), []);
    if (dirtyIdx.length === 0) return;
    const dirtySet = new Set(dirtyIdx);
    setRows((prev) => prev.map((r, i) => (dirtySet.has(i) ? { ...r, saving: true, error: null } : r)));
    try {
      const res = await fetch("/api/hr/payroll/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: dirtyIdx.map((i) => rowPayload(rows[i], year, month)) }),
      });
      const json = (await res.json()) as { ok?: boolean; results?: { employeeId: string; id: string }[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed");
      const idByEmp = new Map(json.results!.map((x) => [x.employeeId, x.id] as const));
      setRows((prev) =>
        prev.map((r, i) =>
          dirtySet.has(i)
            ? { ...r, saving: false, savedId: idByEmp.get(r.emp.id) ?? r.savedId, dirty: false, error: null }
            : r
        )
      );
      toast(`Saved ${dirtyIdx.length} payslip${dirtyIdx.length === 1 ? "" : "s"}`, "success");
    } catch (e) {
      const msg = (e as Error).message;
      setRows((prev) => prev.map((r, i) => (dirtySet.has(i) ? { ...r, saving: false, error: msg } : r)));
      toast(msg, "error");
    }
  }

  function autoSplitAll() {
    rows.forEach((r, idx) => {
      const gross = r.ctc ? Math.round(r.ctc / 12) : computePayrollTotals(r).totalEarnings;
      patch(idx, splitFromGross(gross, r.lta, r.specialAllowance));
    });
    setConfirmSplitAll(false);
    toast(`Auto-split applied for ${rows.length} employee${rows.length === 1 ? "" : "s"}`, "success");
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
      .filter(({ r }) => !q || r.emp.name.toLowerCase().includes(q) || r.emp.empId.toLowerCase().includes(q))
      .filter(({ r }) => (view === "pending" ? !r.savedId : view === "saved" ? !!r.savedId : true));
  }, [rows, query, view]);

  const dirtyCount = rows.reduce((n, r) => n + (r.dirty ? 1 : 0), 0);
  const anySaving = rows.some((r) => r.saving);

  const active = openIdx === null ? null : rows[openIdx];

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total payout" value={fmtINR(totals.payable)} icon={<BadgeIndianRupee className="h-4 w-4" />} tone="brand" />
        <StatCard label="Total earnings" value={fmtINR(totals.earnings)} tone="emerald" />
        <StatCard label="Processed" value={`${totals.processed}/${rows.length}`} tone="blue" spark={rows.length ? (totals.processed / rows.length) * 100 : 0} />
        <StatCard
          label="Pending"
          value={totals.pending}
          tone="amber"
          onClick={() => setView((v) => (v === "pending" ? "all" : "pending"))}
          className={cn(view === "pending" && "ring-2 ring-amber-400/60")}
        />
      </div>

      {/* Search + view filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
          />
        </div>
        <Segmented
          ariaLabel="Filter payslips"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "saved", label: "Saved" },
          ]}
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
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{r.emp.name}</span>
                      <StatusChip status={payrollStatus(r.dirty, !!r.savedId)} className="shrink-0 sm:hidden" />
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      <span className="nums">{r.emp.empId}</span> · {r.designation || "—"}
                    </span>
                  </span>
                  <span className="nums hidden text-right text-sm text-slate-500 sm:block">{fmtINR(r.ctc)}</span>
                  <span className={cn("nums text-right text-sm font-semibold", untouched ? "text-slate-300" : "text-teal-700")}>
                    {untouched ? "—" : fmtINR(payableAmount)}
                  </span>
                  <span className="hidden justify-center sm:flex">
                    <StatusChip status={payrollStatus(r.dirty, !!r.savedId)} />
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

      {/* Bulk actions — sticky footer, mirrors the attendance grid's save bar */}
      {canWrite && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[var(--shadow-pop)] backdrop-blur">
          <span className="text-sm text-slate-500">
            {dirtyCount > 0 ? (
              <>
                <span className="font-semibold text-slate-800">{dirtyCount}</span> unsaved change{dirtyCount === 1 ? "" : "s"}
              </>
            ) : (
              "All changes saved"
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmSplitAll(true)} disabled={rows.length === 0}>
              <Wand2 className="h-4 w-4" /> Auto-split all
            </Button>
            {dirtyCount > 0 && (
              <Button size="sm" onClick={saveAll} disabled={anySaving}>
                {anySaving ? "Saving…" : `Save all (${dirtyCount})`}
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSplitAll}
        title="Auto-split all from CTC?"
        message={`Overwrite earnings for all ${rows.length} employees from their CTC? Unsaved changes will be replaced.`}
        confirmLabel="Auto-split all"
        onConfirm={autoSplitAll}
        onCancel={() => setConfirmSplitAll(false)}
      />

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

  // Attendance-derived LOP: rate = LIVE monthly gross ÷ days-in-month, so the suggested
  // amount always reflects the operator's current earnings edits at the moment "Apply" is
  // clicked. Once inserted, the line is a normal editable extraLines deduction — never
  // auto-recomputed or overwritten on subsequent renders.
  const hasLopLine = row.extraLines.some((l) => l.label === LOP_LABEL);
  const lopAmount =
    row.lop && row.lop.workingDays > 0 ? Math.round((totalEarnings / row.lop.workingDays) * row.lop.lopDays) : 0;
  const canApplyLop = canWrite && !!row.lop && row.lop.lopDays > 0 && row.lop.workingDays > 0 && !hasLopLine;
  const applyLop = () => onExtra(idx, [...row.extraLines, { label: LOP_LABEL, amount: lopAmount, kind: "deduction" }]);

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

      {canApplyLop && (
        <button
          type="button"
          onClick={applyLop}
          className="press flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/60 px-3 py-2.5 text-left hover:bg-rose-50"
        >
          <span className="text-sm font-medium text-rose-700">
            Apply LOP — {row.lop!.lopDays}d unpaid this month
          </span>
          <span className="nums shrink-0 text-sm font-semibold text-rose-700">−{fmtINR(lopAmount)}</span>
        </button>
      )}

      {/* Custom line items */}
      <ExtraLines idx={idx} lines={row.extraLines} canWrite={canWrite} onExtra={onExtra} />

      {/* Net */}
      <div className="space-y-1.5">
        {row.lop && (
          <p className="nums px-1 text-xs text-slate-500">
            Payable days {row.lop.paidDays} of {row.lop.workingDays}
            {row.lop.lopDays > 0 && <> · LOP {row.lop.lopDays}d</>}
          </p>
        )}
        <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3 ring-1 ring-inset ring-teal-100">
          <span className="text-sm font-semibold text-teal-900">Net payable</span>
          <span className="nums text-xl font-bold text-teal-700">{fmtINR(payableAmount)}</span>
        </div>
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
