"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, inputCls, cn } from "@/components/ui";
import { GST_LABELS, invoiceSchema } from "@/lib/finance-validation";
import { fmtINR } from "@/lib/format";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";
import {
  decimal3,
  digitsOnly,
  docNoChars,
  phoneChars,
  useLocalToday,
  zodFieldErrors,
} from "./form-utils";

type Values = Record<string, string>;
export type ItemValues = {
  description: string;
  sacCode: string;
  qty: string;
  uom: string;
  rate: string;
};

const EMPTY: Values = {
  invoiceNo: "", invoiceDate: "", orderNo: "", orderDate: "",
  contactPerson: "", contactNumber: "", billTo: "", shipTo: "",
  gstLabel: "IGST", gstRate: "18", notes: "",
};

const EMPTY_ITEM: ItemValues = { description: "", sacCode: "", qty: "1", uom: "Nos", rate: "" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

// The shared invoiceSchema (the same one the API enforces) is the single
// validator — its issues map onto per-field error keys.
function validate(v: Values, items: ItemValues[]): Record<string, string> {
  const parsed = invoiceSchema.safeParse({ ...v, items });
  return parsed.success ? {} : zodFieldErrors(parsed.error, "items", "item");
}

// Mirror of computeInvoiceTotals for the live footer (server recomputes anyway).
function liveTotals(items: ItemValues[], gstRateStr: string) {
  const amounts = items.map((i) => {
    const qty = parseFloat(i.qty);
    const rate = parseInt(i.rate, 10);
    return Number.isFinite(qty) && Number.isFinite(rate) ? Math.round(qty * rate) : 0;
  });
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const gstRate = parseInt(gstRateStr, 10);
  const gstAmount = Number.isFinite(gstRate) ? Math.round((subtotal * gstRate) / 100) : 0;
  return { amounts, subtotal, gstAmount, total: subtotal + gstAmount };
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

export default function InvoiceForm({
  id,
  initial,
  initialItems,
}: {
  id?: string;
  initial?: Values;
  initialItems?: ItemValues[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  const [items, setItems] = useState<ItemValues[]>(
    initialItems && initialItems.length > 0 ? initialItems : [{ ...EMPTY_ITEM }]
  );
  const [seed] = useState(() => JSON.stringify({ v, items }));
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

  const setItem = (i: number, k: keyof ItemValues, sanitize?: (s: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitize ? sanitize(e.target.value) : e.target.value;
      setItems((rows) => rows.map((row, j) => (j === i ? { ...row, [k]: value } : row)));
      const errKey = `item-${i}-${k}`;
      setFieldErrors((fe) => {
        if (!fe[errKey]) return fe;
        const next = { ...fe };
        delete next[errKey];
        return next;
      });
    };

  const dirty = JSON.stringify({ v, items }) !== seed;
  useUnsavedGuard(dirty, "You have unsaved changes on this invoice. Leave without saving?");

  function handleCancel() {
    if (dirty) { setDiscardOpen(true); return; }
    router.back();
  }

  async function doSave() {
    setError(null); setBusy(true);
    try {
      const res = await fetch(id ? `/api/finance/invoices/${id}` : "/api/finance/invoices", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, items }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setConfirmOpen(false);
      toast(id ? "Invoice updated" : "Invoice raised");
      router.push(id ? `/finance/invoices/${id}` : `/finance/invoices/${d.invoice.id}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate(v, items);
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      setError("Please fix the highlighted field(s) before saving.");
      document.getElementById(firstKey)?.focus();
      return;
    }
    if (!id) { setConfirmOpen(true); return; }
    doSave();
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

  const totals = liveTotals(items, v.gstRate);
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

      <Section title="Invoice">
        {Txt("invoiceNo", "Invoice no", {
          req: true,
          placeholder: "GNE/25-26/0001",
          maxLength: 40,
          sanitize: docNoChars,
          hint: "letters, numbers and / . - only",
        })}
        {Txt("invoiceDate", "Invoice date", {
          req: true,
          type: "date",
          min: "2000-01-01",
          max: today || undefined,
          hint: "today or earlier",
        })}
        {Txt("orderNo", "Order no", { placeholder: "Client PO / WO no.", maxLength: 60 })}
        {Txt("orderDate", "Order date", {
          type: "date",
          min: "2000-01-01",
          max: v.invoiceDate || today || undefined,
          hint: "on or before the invoice date",
        })}
        {Txt("contactPerson", "Contact person", { placeholder: "e.g. Rakesh Sharma", maxLength: 120 })}
        {Txt("contactNumber", "Contact number", {
          placeholder: "e.g. 98765 43210",
          inputMode: "tel",
          maxLength: 20,
          sanitize: phoneChars,
          hint: "8–15 digits",
        })}
      </Section>

      <Section title="Parties">
        <Field
          label="Bill to"
          required
          htmlFor="billTo"
          error={fieldErrors.billTo}
          errorId={fieldErrors.billTo ? "billTo-error" : undefined}
          className="sm:col-span-2 lg:col-span-3"
          hint="Name, address and GSTIN of the party being billed"
        >
          <Textarea
            id="billTo"
            value={v.billTo}
            onChange={set("billTo")}
            rows={4}
            maxLength={1000}
            placeholder={"Company name\nStreet, city, state, PIN\nGSTIN: 22AAAAA0000A1Z5"}
            required
            aria-required
            aria-invalid={fieldErrors.billTo ? true : undefined}
            aria-describedby={fieldErrors.billTo ? "billTo-error" : undefined}
          />
        </Field>
        <Field label="Ship to" htmlFor="shipTo" className="sm:col-span-2 lg:col-span-3" hint="Leave blank if same as Bill to">
          <Textarea
            id="shipTo"
            value={v.shipTo}
            onChange={set("shipTo")}
            rows={3}
            maxLength={1000}
            placeholder="Site / delivery address"
          />
        </Field>
      </Section>

      {/* Line items — description / SAC / qty / UOM / rate; amount is computed. */}
      <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="px-1.5 text-[13px] font-semibold text-slate-700">Line items</legend>
        <div className="space-y-4">
          {items.map((item, i) => {
            const dErr = fieldErrors[`item-${i}-description`];
            const sErr = fieldErrors[`item-${i}-sacCode`];
            const qErr = fieldErrors[`item-${i}-qty`];
            const uErr = fieldErrors[`item-${i}-uom`];
            const rErr = fieldErrors[`item-${i}-rate`];
            const amount = totals.amounts[i] ?? 0;
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                  <div className="col-span-2 sm:col-span-12">
                    <label htmlFor={`item-${i}-description`} className="mb-1 block text-[12px] font-medium text-slate-600">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id={`item-${i}-description`}
                      value={item.description}
                      onChange={setItem(i, "description")}
                      maxLength={500}
                      placeholder="e.g. Supply & installation of 545 Wp solar modules"
                      aria-invalid={dErr ? true : undefined}
                    />
                    {dErr && <p className="mt-1 text-[12px] text-rose-600">{dErr}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`item-${i}-sacCode`} className="mb-1 block text-[12px] font-medium text-slate-600">SAC code</label>
                    <Input
                      id={`item-${i}-sacCode`}
                      value={item.sacCode}
                      onChange={setItem(i, "sacCode", digitsOnly(8))}
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="995461"
                      aria-invalid={sErr ? true : undefined}
                    />
                    {sErr && <p className="mt-1 text-[12px] text-rose-600">{sErr}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`item-${i}-qty`} className="mb-1 block text-[12px] font-medium text-slate-600">Qty</label>
                    <Input
                      id={`item-${i}-qty`}
                      value={item.qty}
                      onChange={setItem(i, "qty", decimal3)}
                      inputMode="decimal"
                      maxLength={12}
                      placeholder="1"
                      aria-invalid={qErr ? true : undefined}
                    />
                    {qErr && <p className="mt-1 text-[12px] text-rose-600">{qErr}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`item-${i}-uom`} className="mb-1 block text-[12px] font-medium text-slate-600">UOM</label>
                    <Input
                      id={`item-${i}-uom`}
                      value={item.uom}
                      onChange={setItem(i, "uom")}
                      maxLength={20}
                      placeholder="Nos / Set / Mtr"
                      aria-invalid={uErr ? true : undefined}
                    />
                    {uErr && <p className="mt-1 text-[12px] text-rose-600">{uErr}</p>}
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`item-${i}-rate`} className="mb-1 block text-[12px] font-medium text-slate-600">
                      Rate (₹) <span className="font-normal text-slate-400">whole ₹</span>
                    </label>
                    <Input
                      id={`item-${i}-rate`}
                      value={item.rate}
                      onChange={setItem(i, "rate", digitsOnly(10))}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="e.g. 125000"
                      aria-invalid={rErr ? true : undefined}
                    />
                    {rErr && <p className="mt-1 text-[12px] text-rose-600">{rErr}</p>}
                  </div>
                  <div className="sm:col-span-3">
                    <span className="mb-1 block text-[12px] font-medium text-slate-600">Amount</span>
                    <div className={cn(inputCls, "nums flex items-center bg-white text-slate-700")}>{fmtINR(amount)}</div>
                  </div>
                </div>
                {items.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove line
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
              onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])}
              disabled={items.length >= 30}
            >
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
            <span className="text-[12px] text-slate-500">{items.length} of 30 lines</span>
          </div>
        </div>
      </fieldset>

      <Section title="Tax & totals">
        <Field label="GST type" htmlFor="gstLabel">
          <Select id="gstLabel" value={v.gstLabel} onChange={set("gstLabel")}>
            {GST_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Subtotal</span>
            <span className="nums font-medium text-slate-700">{fmtINR(totals.subtotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px] text-slate-500">
            <span>{v.gstLabel} @ {v.gstRate || 0}%</span>
            <span className="nums font-medium text-slate-700">{fmtINR(totals.gstAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <span>Total</span>
            <span className="nums">{fmtINR(totals.total)}</span>
          </div>
          {fieldErrors.items && (
            <p className="mt-2 text-[12px] font-medium text-rose-600">{fieldErrors.items}</p>
          )}
        </div>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea
            id="notes"
            value={v.notes}
            onChange={set("notes")}
            rows={2}
            maxLength={1000}
            placeholder="Payment terms, bank details, remarks…"
          />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Raise invoice"}</Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Raise this invoice?"
        message={`${v.invoiceNo || "This invoice"} will be created as a draft totalling ${fmtINR(totals.total)}. You can still edit it before sending for approval.`}
        confirmLabel="Raise invoice"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this invoice. Leaving now will lose them."
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); router.back(); }}
      />
    </form>
  );
}
