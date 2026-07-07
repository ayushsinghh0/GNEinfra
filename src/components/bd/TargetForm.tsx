"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  BD_SERVICE_TYPES, BD_PLANT_TYPES, BD_QUARTERS,
  SERVICE_TYPE_LABELS, PLANT_TYPE_LABELS,
  BD_TECHNOLOGIES, BD_SERVICE_CATEGORIES, TECHNOLOGY_LABELS, SERVICE_CATEGORY_LABELS,
} from "@/lib/bd-validation";
import { fmtINR } from "@/lib/format";
import { fyChoices, fyLabel } from "@/lib/fiscal";
import { AlertCircle } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";

type Values = Record<string, string>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const EMPTY: Values = {
  fiscalYear: "", quarter: "", states: "", keyAccountPerson: "", project: "",
  serviceType: "", plantType: "", technology: "", serviceCategory: "",
  projectSize: "", locations: "",
  estimatedValue: "", probabilityPct: "", forecastedRevenue: "", orderReceived: "",
  salesTarget: "", notes: "",
};

function isDirty(a: Values, b: Values): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return true;
  }
  return false;
}

export default function TargetForm({ id, initial }: { id?: string; initial?: Values }) {
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
      const res = await fetch(id ? `/api/bd/targets/${id}` : "/api/bd/targets", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setConfirmOpen(false);
      toast(id ? "Changes saved" : "Target added");
      router.push("/bd/targets");
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.fiscalYear.trim()) {
      setFieldErrors({ fiscalYear: "Fiscal year is required" });
      setError("Please fix the highlighted field(s) before saving.");
      document.getElementById("fiscalYear")?.focus();
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

  const weighted =
    v.estimatedValue && v.probabilityPct
      ? Math.round((parseInt(v.estimatedValue, 10) || 0) * ((parseInt(v.probabilityPct, 10) || 0) / 100))
      : null;

  const targetNum = parseInt(v.salesTarget, 10) || 0;
  const achievement =
    targetNum > 0 ? Math.round(((parseInt(v.orderReceived, 10) || 0) / targetNum) * 100) : null;

  const fyOptions = fyChoices();
  if (v.fiscalYear && !fyOptions.includes(v.fiscalYear)) fyOptions.push(v.fiscalYear);

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Target line">
        <Field label="Fiscal year" required htmlFor="fiscalYear">
          <Select id="fiscalYear" value={v.fiscalYear} onChange={set("fiscalYear")} required aria-required>
            {fyOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </Select>
        </Field>
        <Field label="Quarter" htmlFor="quarter">
          <Select id="quarter" value={v.quarter} onChange={set("quarter")}>
            <option value="">—</option>
            {BD_QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </Select>
        </Field>
        {Txt("states", "States")}
        {Txt("keyAccountPerson", "Key account person")}
        {Txt("project", "Project")}
      </Section>

      <Section title="Project category">
        <Field label="Technology" htmlFor="technology">
          <Select id="technology" value={v.technology} onChange={set("technology")}>
            <option value="">—</option>
            {BD_TECHNOLOGIES.map((t) => <option key={t} value={t}>{TECHNOLOGY_LABELS[t]}</option>)}
          </Select>
        </Field>
        <Field label="Service category" htmlFor="serviceCategory">
          <Select id="serviceCategory" value={v.serviceCategory} onChange={set("serviceCategory")}>
            <option value="">—</option>
            {BD_SERVICE_CATEGORIES.map((s) => <option key={s} value={s}>{SERVICE_CATEGORY_LABELS[s]}</option>)}
          </Select>
        </Field>
      </Section>

      <Section title="Scope">
        <Field label="Type of service" htmlFor="serviceType">
          <Select id="serviceType" value={v.serviceType} onChange={set("serviceType")}>
            <option value="">—</option>
            {BD_SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
        <Field label="Type of plant" htmlFor="plantType">
          <Select id="plantType" value={v.plantType} onChange={set("plantType")}>
            <option value="">—</option>
            {BD_PLANT_TYPES.map((t) => <option key={t} value={t}>{PLANT_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
        {Txt("projectSize", "Project size (kW/MW)")}
        {Txt("locations", "No of locations", false, "text", "numeric")}
      </Section>

      <Section title="Value">
        {Txt("salesTarget", "Sales target (₹)", false, "text", "numeric")}
        {Txt("estimatedValue", "Estimated value (₹)", false, "text", "numeric")}
        {Txt("probabilityPct", "Probability (%)", false, "text", "numeric")}
        <Field
          label="Forecasted revenue (₹)"
          htmlFor="forecastedRevenue"
          hint={weighted !== null ? `Suggested: ${fmtINR(weighted)} (estimate × probability)` : undefined}
        >
          <Input
            id="forecastedRevenue"
            value={v.forecastedRevenue}
            onChange={set("forecastedRevenue")}
            inputMode="numeric"
          />
        </Field>
        <Field
          label="Order received (₹)"
          htmlFor="orderReceived"
          hint={achievement !== null ? `${achievement}% of sales target achieved` : undefined}
        >
          <Input id="orderReceived" value={v.orderReceived} onChange={set("orderReceived")} inputMode="numeric" />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="notes" value={v.notes} onChange={set("notes")} rows={2} />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add target"}</Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Add this target?"
        message="This will add a new line to the business target sheet."
        confirmLabel="Add target"
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
