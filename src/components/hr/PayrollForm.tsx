"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { digitsOnly } from "@/components/finance/form-utils";
import { fmtINR } from "@/lib/format";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "./useUnsavedGuard";

type Values = Record<string, string>;

const EMPTY: Values = {
  totalCtc: "", salary: "", lta: "", specialAllowance: "", conveyance: "",
  bankAccountNo: "", bankName: "", ifsc: "", panNo: "", uan: "", esicNo: "",
  pfDeduction: "", esiDeduction: "", tdsDeduction: "", otherDeduction: "",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

// Edits an employee's pay / bank / statutory / deductions (the payroll home).
// Live gross/net so HR sees the take-home while entering the structure.
export default function PayrollForm({ id, initial, canWrite }: { id: string; initial: Values; canWrite: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...initial });
  const [seed, setSeed] = useState(() => JSON.stringify({ ...EMPTY, ...initial }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Money fields are strict: non-digit keystrokes never enter state (the zod
  // `money` schema on the API stays the submit-time authority).
  const rupees = digitsOnly(9);
  const set = (k: string, money = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: money ? rupees(e.target.value) : e.target.value }));

  const dirty = JSON.stringify(v) !== seed;
  useUnsavedGuard(dirty && canWrite, "You have unsaved payroll changes. Leave without saving?");

  const n = (k: string) => parseInt(v[k], 10) || 0;
  const gross = n("salary") + n("lta") + n("specialAllowance") + n("conveyance");
  const deductions = n("pfDeduction") + n("esiDeduction") + n("tdsDeduction") + n("otherDeduction");
  const net = gross - deductions;

  // Non-blocking reconciliation hint: the annual CTC and the monthly breakup
  // are entered independently — surface the delta so HR fixes it at entry time.
  const ctc = n("totalCtc");
  const annualised = gross * 12;
  const ctcMismatch = ctc > 0 && gross > 0 && annualised !== ctc;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/payroll/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setSeed(JSON.stringify(v));
      toast("Payroll saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const Txt = (k: string, label: string, money = false) => (
    <Field label={label} htmlFor={k}>
      <Input id={k} value={v[k] ?? ""} onChange={set(k, money)} inputMode={money ? "numeric" : undefined} maxLength={money ? 9 : undefined} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <fieldset disabled={!canWrite} className="min-w-0 space-y-5">
        <Section title="Pay structure">
          {Txt("totalCtc", "Total CTC (₹)", true)}
          {Txt("salary", "Salary (₹)", true)}
          {Txt("lta", "LTA (₹)", true)}
          {Txt("specialAllowance", "Special Allowance (₹)", true)}
          {Txt("conveyance", "Conveyance (₹)", true)}
        </Section>
        <Section title="Bank details">
          {Txt("bankAccountNo", "Bank A/C No")}
          {Txt("bankName", "Bank Name")}
          {Txt("ifsc", "IFSC")}
        </Section>
        <Section title="Statutory">
          {Txt("panNo", "PAN No")}
          {Txt("uan", "UAN (PF)")}
          {Txt("esicNo", "ESIC No")}
        </Section>
        <Section title="Deductions">
          {Txt("pfDeduction", "PF (₹)", true)}
          {Txt("esiDeduction", "ESI (₹)", true)}
          {Txt("tdsDeduction", "TDS (₹)", true)}
          {Txt("otherDeduction", "Other (₹)", true)}
        </Section>
      </fieldset>

      {/* Live take-home summary */}
      <div className="nums flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
        <span className="text-slate-600">Gross <span className="font-semibold text-slate-900">{fmtINR(gross)}</span></span>
        <span className="text-slate-600">Deductions <span className="font-semibold text-slate-900">{fmtINR(deductions)}</span></span>
        <span className="text-slate-600">Net <span className="font-semibold text-emerald-600">{fmtINR(net)}</span></span>
      </div>

      {ctcMismatch && (
        <p role="status" className="nums flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            12 × monthly gross ({fmtINR(annualised)}) differs from Total CTC ({fmtINR(ctc)}) by{" "}
            <span className="font-semibold">{fmtINR(Math.abs(ctc - annualised))}</span>.
          </span>
        </p>
      )}

      {canWrite && (
        <Button type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save payroll"}</Button>
      )}
    </form>
  );
}
