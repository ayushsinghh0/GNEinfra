"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, inputCls, cn } from "@/components/ui";
import { nopaSchema } from "@/lib/finance-validation";
import { fmtINR } from "@/lib/format";
import { AlertCircle, Plus, SendHorizonal, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";
import {
  digitsOnly,
  docNoChars,
  ifscChars,
  useLocalToday,
  zodFieldErrors,
} from "./form-utils";

type Values = Record<string, string>;
export type NopaLineValues = {
  description: string;
  qtyWords: string;
  uom: string;
  unitPrice: string;
  amount: string;
};

const EMPTY: Values = {
  nopaNo: "", nopaDate: "", companyName: "Green Next Energy Infra Pvt Ltd",
  plantName: "", partyName: "", itemDescription: "", poRef: "",
  gstRate: "18", advancePaid: "", advanceRequest: "", dueDate: "",
  bankName: "", accountNo: "", ifsc: "", branchName: "",
  initiatedBy: "", checkedBy: "",
};

const EMPTY_LINE: NopaLineValues = { description: "", qtyWords: "", uom: "", unitPrice: "", amount: "" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

// The shared nopaSchema (the same one the API enforces) is the single
// validator — its issues map onto per-field error keys.
function validate(v: Values, lines: NopaLineValues[]): Record<string, string> {
  const parsed = nopaSchema.safeParse({ ...v, lines });
  return parsed.success ? {} : zodFieldErrors(parsed.error, "lines", "line");
}

function liveTotals(lines: NopaLineValues[], gstRateStr: string) {
  const basicAmount = lines.reduce((s, l) => {
    const a = parseInt(l.amount, 10);
    return s + (Number.isFinite(a) ? a : 0);
  }, 0);
  const gstRate = parseInt(gstRateStr, 10);
  const gstAmount = Number.isFinite(gstRate) ? Math.round((basicAmount * gstRate) / 100) : 0;
  return { basicAmount, gstAmount, grandTotal: basicAmount + gstAmount };
}

type TxtOpts = {
  req?: boolean;
  type?: string;
  inputMode?: "numeric" | "decimal" | "tel";
  hint?: ReactNode;
  placeholder?: string;
  maxLength?: number;
  min?: string;
  max?: string;
  sanitize?: (s: string) => string;
};

/**
 * The Note On Payment Approval form — pre-filled from the invoice, fully
 * editable, and submitted straight into the approval queue (the API call is
 * the status transition to PENDING_APPROVAL).
 */
export default function NopaForm({
  invoiceId,
  initial,
  initialLines,
  resubmit,
}: {
  invoiceId: string;
  initial?: Values;
  initialLines?: NopaLineValues[];
  /** True when the invoice is REJECTED or already PENDING (label changes). */
  resubmit?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  const [lines, setLines] = useState<NopaLineValues[]>(
    initialLines && initialLines.length > 0 ? initialLines : [{ ...EMPTY_LINE }]
  );
  const [seed] = useState(() => JSON.stringify({ v, lines }));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // "" during SSR so the server HTML can't disagree with the browser's date.
  const today = useLocalToday();

  const set = (k: string, sanitize?: (s: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = sanitize ? sanitize(e.target.value) : e.target.value;
      setV((s) => ({ ...s, [k]: value }));
      setFieldErrors((fe) => {
        if (!fe[k]) return fe;
        const next = { ...fe };
        delete next[k];
        return next;
      });
    };

  const setLine = (i: number, k: keyof NopaLineValues, sanitize?: (s: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitize ? sanitize(e.target.value) : e.target.value;
      setLines((rows) => rows.map((row, j) => (j === i ? { ...row, [k]: value } : row)));
      const errKey = `line-${i}-${k}`;
      setFieldErrors((fe) => {
        if (!fe[errKey]) return fe;
        const next = { ...fe };
        delete next[errKey];
        return next;
      });
    };

  const dirty = JSON.stringify({ v, lines }) !== seed;
  useUnsavedGuard(dirty, "You have unsaved changes on this NOPA. Leave without saving?");

  function handleCancel() {
    if (dirty) { setDiscardOpen(true); return; }
    router.back();
  }

  async function doSubmit() {
    setError(null); setBusy(true);
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, lines }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not submit");
      setConfirmOpen(false);
      toast("Sent for approval");
      router.push(`/finance/invoices/${invoiceId}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate(v, lines);
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      setError("Please fix the highlighted field(s) before submitting.");
      document.getElementById(firstKey)?.focus();
      return;
    }
    setConfirmOpen(true);
  }

  const Txt = (k: string, label: string, o: TxtOpts = {}) => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={o.req} htmlFor={k} error={err} errorId={err ? errId : undefined} hint={o.hint}>
        <Input
          id={k}
          type={o.type ?? "text"}
          value={v[k]}
          onChange={set(k, o.sanitize)}
          inputMode={o.inputMode}
          placeholder={o.placeholder}
          maxLength={o.maxLength}
          min={o.min}
          max={o.max}
          required={o.req}
          aria-required={o.req || undefined}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
      </Field>
    );
  };

  const totals = liveTotals(lines, v.gstRate);
  // Immediate feedback on the one field that drives the totals footer.
  const gstErr =
    fieldErrors.gstRate ??
    (v.gstRate !== "" && parseInt(v.gstRate, 10) > 28 ? "GST rate must be 0–28" : undefined);

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Note on payment approval">
        {Txt("nopaNo", "NOPA no", {
          req: true,
          placeholder: "NOPA/25-26/0001",
          maxLength: 40,
          sanitize: docNoChars,
          hint: "letters, numbers and / . - only",
        })}
        {Txt("nopaDate", "Date", {
          req: true,
          type: "date",
          min: "2000-01-01",
          max: today || undefined,
          hint: "today or earlier",
        })}
        {Txt("companyName", "Company name", { maxLength: 200 })}
        <Field label="Plant name / description" htmlFor="plantName" className="sm:col-span-2 lg:col-span-2">
          <Input
            id="plantName"
            value={v.plantName}
            onChange={set("plantName")}
            maxLength={300}
            placeholder="e.g. 1 MW rooftop — Indore plant"
          />
        </Field>
        {Txt("partyName", "Party / vendor name", { placeholder: "Payee name", maxLength: 200 })}
        {Txt("poRef", "PO/WO reference no", { placeholder: "e.g. PO/2025/042", maxLength: 120 })}
        <Field label="Description of item" htmlFor="itemDescription" className="sm:col-span-2 lg:col-span-2">
          <Textarea
            id="itemDescription"
            value={v.itemDescription}
            onChange={set("itemDescription")}
            rows={2}
            maxLength={500}
            placeholder="What this payment is for"
          />
        </Field>
      </Section>

      {/* NOPA line items — qty is written in WORDS on this document. */}
      <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="px-1.5 text-[13px] font-semibold text-slate-700">Items</legend>
        <div className="space-y-4">
          {lines.map((line, i) => {
            const dErr = fieldErrors[`line-${i}-description`];
            const wErr = fieldErrors[`line-${i}-qtyWords`];
            const uErr = fieldErrors[`line-${i}-uom`];
            const pErr = fieldErrors[`line-${i}-unitPrice`];
            const aErr = fieldErrors[`line-${i}-amount`];
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                  <div className="col-span-2 sm:col-span-12">
                    <label htmlFor={`line-${i}-description`} className="mb-1 block text-[12px] font-medium text-slate-600">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id={`line-${i}-description`}
                      value={line.description}
                      onChange={setLine(i, "description")}
                      maxLength={500}
                      placeholder="e.g. Supply & installation of 545 Wp solar modules"
                      aria-invalid={dErr ? true : undefined}
                    />
                    {dErr && <p className="mt-1 text-[12px] text-rose-600">{dErr}</p>}
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={`line-${i}-qtyWords`} className="mb-1 block text-[12px] font-medium text-slate-600">Qty (words)</label>
                    <Input
                      id={`line-${i}-qtyWords`}
                      value={line.qtyWords}
                      onChange={setLine(i, "qtyWords")}
                      maxLength={200}
                      placeholder="e.g. Ten Nos Only"
                      aria-invalid={wErr ? true : undefined}
                    />
                    {wErr && <p className="mt-1 text-[12px] text-rose-600">{wErr}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`line-${i}-uom`} className="mb-1 block text-[12px] font-medium text-slate-600">UOM</label>
                    <Input
                      id={`line-${i}-uom`}
                      value={line.uom}
                      onChange={setLine(i, "uom")}
                      maxLength={20}
                      placeholder="Nos / Set / Mtr"
                      aria-invalid={uErr ? true : undefined}
                    />
                    {uErr && <p className="mt-1 text-[12px] text-rose-600">{uErr}</p>}
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`line-${i}-unitPrice`} className="mb-1 block text-[12px] font-medium text-slate-600">
                      Unit price (₹) <span className="font-normal text-slate-400">whole ₹</span>
                    </label>
                    <Input
                      id={`line-${i}-unitPrice`}
                      value={line.unitPrice}
                      onChange={setLine(i, "unitPrice", digitsOnly(10))}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="e.g. 125000"
                      aria-invalid={pErr ? true : undefined}
                    />
                    {pErr && <p className="mt-1 text-[12px] text-rose-600">{pErr}</p>}
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`line-${i}-amount`} className="mb-1 block text-[12px] font-medium text-slate-600">
                      Amount (₹) <span className="font-normal text-slate-400">whole ₹</span>
                    </label>
                    <Input
                      id={`line-${i}-amount`}
                      value={line.amount}
                      onChange={setLine(i, "amount", digitsOnly(10))}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="e.g. 1250000"
                      aria-invalid={aErr ? true : undefined}
                    />
                    {aErr && <p className="mt-1 text-[12px] text-rose-600">{aErr}</p>}
                  </div>
                </div>
                {lines.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove item
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLines((rows) => [...rows, { ...EMPTY_LINE }])}
              disabled={lines.length >= 15}
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
            <span className="text-[12px] text-slate-500">{lines.length} of 15 items</span>
          </div>
        </div>
      </fieldset>

      <Section title="Amounts & payment terms">
        <Field
          label="GST rate (%)"
          htmlFor="gstRate"
          hint="0–28"
          error={gstErr}
          errorId={gstErr ? "gstRate-error" : undefined}
        >
          <Input
            id="gstRate"
            value={v.gstRate}
            onChange={set("gstRate", digitsOnly(2))}
            inputMode="numeric"
            maxLength={2}
            placeholder="18"
            aria-invalid={gstErr ? true : undefined}
            aria-describedby={gstErr ? "gstRate-error" : undefined}
          />
        </Field>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Total basic amount</span>
            <span className="nums font-medium text-slate-700">{fmtINR(totals.basicAmount)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px] text-slate-500">
            <span>GST @ {v.gstRate || 0}%</span>
            <span className="nums font-medium text-slate-700">{fmtINR(totals.gstAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <span>Grand total with GST</span>
            <span className="nums">{fmtINR(totals.grandTotal)}</span>
          </div>
          {fieldErrors.lines && (
            <p className="mt-2 text-[12px] font-medium text-rose-600">{fieldErrors.lines}</p>
          )}
        </div>
        {Txt("advancePaid", "Advance already paid (₹)", {
          inputMode: "numeric",
          maxLength: 10,
          sanitize: digitsOnly(10),
          placeholder: "e.g. 250000",
          hint: "whole ₹",
        })}
        {Txt("advanceRequest", "Advance requested (₹)", {
          inputMode: "numeric",
          maxLength: 10,
          sanitize: digitsOnly(10),
          placeholder: "e.g. 500000",
          hint: "whole ₹, e.g. 50% of basic",
        })}
        {Txt("dueDate", "Due date for payment", {
          type: "date",
          min: v.nopaDate || "2000-01-01",
          hint: "on or after the NOPA date",
        })}
      </Section>

      <Section title="Payee bank details">
        {Txt("bankName", "Bank name", { placeholder: "e.g. HDFC Bank", maxLength: 120 })}
        {Txt("accountNo", "Bank account no", {
          inputMode: "numeric",
          maxLength: 18,
          sanitize: digitsOnly(18),
          placeholder: "e.g. 50100212345678",
          hint: "9–18 digits",
        })}
        {Txt("ifsc", "IFSC code", {
          maxLength: 11,
          sanitize: ifscChars,
          placeholder: "e.g. HDFC0001234",
          hint: "11 characters",
        })}
        {Txt("branchName", "Branch name", { placeholder: "e.g. Vijay Nagar, Indore", maxLength: 120 })}
      </Section>

      <Section title="Sign-off">
        {Txt("initiatedBy", "Initiated by", { placeholder: "Defaults to your name", maxLength: 120 })}
        {Txt("checkedBy", "Checked by", { maxLength: 120 })}
        <div className={cn(inputCls, "flex items-center border-dashed bg-slate-50 text-[13px] text-slate-500")}>
          Approving authority signs after review
        </div>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          <SendHorizonal className="h-4 w-4" />
          {busy ? "Submitting…" : resubmit ? "Resubmit for approval" : "Send for approval"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={resubmit ? "Resubmit for approval?" : "Send for approval?"}
        message={`${v.nopaNo || "This NOPA"} (grand total ${fmtINR(totals.grandTotal)}) will go to Manager / Admin / Superadmin for sign-off.`}
        confirmLabel={resubmit ? "Resubmit" : "Send for approval"}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this NOPA. Leaving now will lose them."
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); router.back(); }}
      />
    </form>
  );
}
