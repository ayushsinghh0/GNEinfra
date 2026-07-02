"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { BD_STAGES, BD_FINAL_STATUSES } from "@/lib/bd-validation";
import { statusMeta } from "@/lib/hr-status";
import { fmtINR } from "@/lib/format";
import { fyChoices, fyLabel } from "@/lib/fiscal";
import { AlertCircle } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";

type Values = Record<string, string>;
export type ClientOption = { id: string; name: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const EMPTY: Values = {
  fiscalYear: "", enquiryDate: "", enquiryType: "", clientId: "",
  personName: "", contactNo: "", location: "", projectType: "",
  activities: "", unit: "kW", qty: "", quoteNo: "", submissionDate: "",
  projectStatus: "", probabilityPct: "", forecastedRevenue: "",
  stage: "ENQUIRY", expectedClosure: "", finalStatus: "OPEN",
  customerContact: "", value: "", notes: "",
};

const REQUIRED_FIELDS: [key: string, label: string][] = [
  ["fiscalYear", "Fiscal year"],
  ["clientId", "Client"],
];

function validate(v: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [k, label] of REQUIRED_FIELDS) {
    if (!v[k]?.trim()) errors[k] = `${label} is required`;
  }
  return errors;
}

function isDirty(a: Values, b: Values): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return true;
  }
  return false;
}

export default function EnquiryForm({
  id,
  initial,
  clients,
}: {
  id?: string;
  initial?: Values;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, fiscalYear: fyLabel(), ...(initial ?? {}) });
  const [seed] = useState<Values>(() => v);
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

  const dirty = isDirty(v, seed);
  useUnsavedGuard(dirty, "You have unsaved changes on this form. Leave without saving?");

  function handleCancel() {
    if (dirty) { setDiscardOpen(true); return; }
    router.back();
  }

  async function doSave() {
    setError(null); setBusy(true);
    try {
      const res = await fetch(id ? `/api/bd/enquiries/${id}` : "/api/bd/enquiries", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setConfirmOpen(false);
      toast(id ? "Changes saved" : "Enquiry recorded");
      router.push(id ? `/bd/enquiries/${id}` : `/bd/enquiries/${d.enquiry.id}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate(v);
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

  const Txt = (k: string, label: string, req = false, type = "text", inputMode?: "numeric" | "decimal" | "text") => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={req} htmlFor={k} error={err} errorId={err ? errId : undefined}>
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

  // Weighted-pipeline hint: quoted value × probability, shown while typing.
  const weighted =
    v.value && v.probabilityPct
      ? Math.round((parseInt(v.value, 10) || 0) * ((parseInt(v.probabilityPct, 10) || 0) / 100))
      : null;

  const fyOptions = fyChoices();
  if (v.fiscalYear && !fyOptions.includes(v.fiscalYear)) fyOptions.push(v.fiscalYear);
  const clientErr = fieldErrors.clientId;

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Enquiry">
        <Field label="Fiscal year" required htmlFor="fiscalYear">
          <Select id="fiscalYear" value={v.fiscalYear} onChange={set("fiscalYear")} required aria-required>
            {fyOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </Select>
        </Field>
        {Txt("enquiryDate", "Enquiry date", false, "date")}
        <Field label="Client" required htmlFor="clientId" error={clientErr} errorId={clientErr ? "clientId-error" : undefined}>
          <Select
            id="clientId"
            value={v.clientId}
            onChange={set("clientId")}
            required
            aria-required
            aria-invalid={clientErr ? true : undefined}
            aria-describedby={clientErr ? "clientId-error" : undefined}
          >
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {Txt("enquiryType", "Type", false)}
        {Txt("personName", "Person name")}
        {Txt("contactNo", "Contact no")}
        {Txt("location", "Location")}
        {Txt("customerContact", "Customer contact person")}
      </Section>

      <Section title="Scope & quote">
        {Txt("projectType", "Project type")}
        {Txt("unit", "Unit")}
        {Txt("qty", "Qty", false, "text", "numeric")}
        {Txt("quoteNo", "Quote no")}
        {Txt("submissionDate", "Date of submission", false, "date")}
        {Txt("value", "Quoted value (₹)", false, "text", "numeric")}
        <Field label="Activities" htmlFor="activities" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="activities" value={v.activities} onChange={set("activities")} rows={2} />
        </Field>
      </Section>

      <Section title="Pipeline">
        <Field label="Stage" htmlFor="stage">
          <Select id="stage" value={v.stage} onChange={set("stage")}>
            {BD_STAGES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
          </Select>
        </Field>
        <Field label="Final status" htmlFor="finalStatus">
          <Select id="finalStatus" value={v.finalStatus} onChange={set("finalStatus")}>
            {BD_FINAL_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
          </Select>
        </Field>
        {Txt("projectStatus", "Status of project")}
        {Txt("probabilityPct", "Probability (%)", false, "text", "numeric")}
        <Field
          label="Forecasted revenue (₹)"
          htmlFor="forecastedRevenue"
          hint={weighted !== null ? `Suggested: ${fmtINR(weighted)} (value × probability)` : undefined}
        >
          <Input
            id="forecastedRevenue"
            value={v.forecastedRevenue}
            onChange={set("forecastedRevenue")}
            inputMode="numeric"
          />
        </Field>
        {Txt("expectedClosure", "Expected closure", false, "date")}
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="notes" value={v.notes} onChange={set("notes")} rows={3} />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Record enquiry"}</Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Record this enquiry?"
        message="This will add a new row to the Query & Quote tracker."
        confirmLabel="Record enquiry"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this form. Leaving now will lose them."
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); router.back(); }}
      />
    </form>
  );
}
