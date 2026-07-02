"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, inputCls, cn } from "@/components/ui";
import { fmtINR } from "@/lib/format";
import { AlertCircle, Plus, SendHorizonal, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const REQUIRED_FIELDS: [key: string, label: string][] = [
  ["nopaNo", "NOPA number"],
  ["nopaDate", "NOPA date"],
];

function validate(v: Values, lines: NopaLineValues[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [k, label] of REQUIRED_FIELDS) {
    if (!v[k]?.trim()) errors[k] = `${label} is required`;
  }
  lines.forEach((line, i) => {
    if (!line.description.trim()) errors[`line-${i}-description`] = "Description is required";
  });
  return errors;
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
    initialLines && initialLines.length > 0
      ? initialLines
      : [{ description: "", qtyWords: "", uom: "", unitPrice: "", amount: "" }]
  );
  const [seed] = useState(() => JSON.stringify({ v, lines }));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setFieldErrors((fe) => {
      if (!fe[k]) return fe;
      const next = { ...fe };
      delete next[k];
      return next;
    });
  };

  const setLine = (i: number, k: keyof NopaLineValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLines((rows) => rows.map((row, j) => (j === i ? { ...row, [k]: e.target.value } : row)));
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

  const Txt = (k: string, label: string, req = false, type = "text", inputMode?: "numeric" | "decimal" | "text", hint?: string) => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={req} htmlFor={k} error={err} errorId={err ? errId : undefined} hint={hint}>
        <Input
          id={k}
          type={type}
          value={v[k]}
          onChange={set(k)}
          inputMode={inputMode}
          required={req}
          aria-required={req || undefined}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
      </Field>
    );
  };

  const totals = liveTotals(lines, v.gstRate);

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Note on payment approval">
        {Txt("nopaNo", "NOPA no", true)}
        {Txt("nopaDate", "Date", true, "date")}
        {Txt("companyName", "Company name")}
        <Field label="Plant name / description" htmlFor="plantName" className="sm:col-span-2 lg:col-span-2">
          <Input id="plantName" value={v.plantName} onChange={set("plantName")} />
        </Field>
        {Txt("partyName", "Party / vendor name")}
        {Txt("poRef", "PO/WO reference no")}
        <Field label="Description of item" htmlFor="itemDescription" className="sm:col-span-2 lg:col-span-2">
          <Textarea id="itemDescription" value={v.itemDescription} onChange={set("itemDescription")} rows={2} />
        </Field>
      </Section>

      {/* NOPA line items — qty is written in WORDS on this document. */}
      <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="px-1.5 text-[13px] font-semibold text-slate-700">Items</legend>
        <div className="space-y-4">
          {lines.map((line, i) => {
            const dErr = fieldErrors[`line-${i}-description`];
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
                      aria-invalid={dErr ? true : undefined}
                    />
                    {dErr && <p className="mt-1 text-[12px] text-rose-600">{dErr}</p>}
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={`line-${i}-qtyWords`} className="mb-1 block text-[12px] font-medium text-slate-600">Qty (words)</label>
                    <Input id={`line-${i}-qtyWords`} value={line.qtyWords} onChange={setLine(i, "qtyWords")} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`line-${i}-uom`} className="mb-1 block text-[12px] font-medium text-slate-600">UOM</label>
                    <Input id={`line-${i}-uom`} value={line.uom} onChange={setLine(i, "uom")} />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`line-${i}-unitPrice`} className="mb-1 block text-[12px] font-medium text-slate-600">Unit price (₹)</label>
                    <Input id={`line-${i}-unitPrice`} value={line.unitPrice} onChange={setLine(i, "unitPrice")} inputMode="numeric" />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`line-${i}-amount`} className="mb-1 block text-[12px] font-medium text-slate-600">Amount (₹)</label>
                    <Input id={`line-${i}-amount`} value={line.amount} onChange={setLine(i, "amount")} inputMode="numeric" />
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

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLines((rows) => [...rows, { description: "", qtyWords: "", uom: "", unitPrice: "", amount: "" }])}
            disabled={lines.length >= 15}
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        </div>
      </fieldset>

      <Section title="Amounts & payment terms">
        {Txt("gstRate", "GST rate (%)", false, "text", "numeric")}
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
        </div>
        {Txt("advancePaid", "Advance already paid (₹)", false, "text", "numeric")}
        {Txt("advanceRequest", "Advance requested (₹)", false, "text", "numeric", "e.g. 50% of basic")}
        {Txt("dueDate", "Due date for payment", false, "date")}
      </Section>

      <Section title="Payee bank details">
        {Txt("bankName", "Bank name")}
        {Txt("accountNo", "Bank account no", false, "text", "numeric")}
        {Txt("ifsc", "IFSC code")}
        {Txt("branchName", "Branch name")}
      </Section>

      <Section title="Sign-off">
        {Txt("initiatedBy", "Initiated by")}
        {Txt("checkedBy", "Checked by")}
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
