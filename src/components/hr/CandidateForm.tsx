"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  HIRING_STAGES,
  HIRING_STAGE_LABELS,
  CANDIDATE_SOURCES,
} from "@/lib/recruitment-validation";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";

type Values = Record<string, string>;
type PositionOpt = { id: string; title: string; code: string | null };

const EMPTY: Values = {
  name: "", email: "", phone: "", positionId: "", source: "", stage: "SOURCED",
  cvLink: "", experienceYears: "", noticePeriod: "", appliedOn: "", notes: "",
};

export default function CandidateForm({
  id,
  initial,
  initialCvReceived,
  positions,
}: {
  id?: string;
  initial?: Values;
  initialCvReceived?: boolean;
  positions: PositionOpt[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  const [cvReceived, setCvReceived] = useState(!!initialCvReceived);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setFieldErrors((fe) => {
      if (!fe[k]) return fe;
      const next = { ...fe };
      delete next[k];
      return next;
    });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.name.trim()) {
      setFieldErrors({ name: "Name is required" });
      setError("Please fix the highlighted field.");
      document.getElementById("name")?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(id ? `/api/hr/recruitment/candidates/${id}` : "/api/hr/recruitment/candidates", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, cvReceived }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      toast(id ? "Candidate saved" : "Candidate added");
      const cid = id ?? data.candidate?.id;
      router.push(cid ? `/hr/recruitment/candidates/${cid}` : "/hr/recruitment/candidates");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const Txt = (k: string, label: string, req = false, type = "text", inputMode?: "numeric" | "tel" | "decimal") => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={req} htmlFor={k} error={err} errorId={err ? errId : undefined}>
        <Input
          id={k}
          type={type}
          inputMode={inputMode}
          value={v[k]}
          onChange={set(k)}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
      </Field>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Txt("name", "Candidate name", true)}
        {Txt("email", "Email", false, "email")}
        {Txt("phone", "Phone", false, "tel", "tel")}
        <Field label="Position" htmlFor="positionId">
          <Select id="positionId" value={v.positionId} onChange={set("positionId")}>
            <option value="">— Unassigned —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}{p.code ? ` (${p.code})` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="source">
          <Select id="source" value={v.source} onChange={set("source")}>
            <option value="">—</option>
            {CANDIDATE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="stage">
          <Select id="stage" value={v.stage} onChange={set("stage")}>
            {HIRING_STAGES.map((s) => <option key={s} value={s}>{HIRING_STAGE_LABELS[s]}</option>)}
          </Select>
        </Field>
        {Txt("experienceYears", "Experience (yrs)", false, "text", "decimal")}
        {Txt("noticePeriod", "Notice period")}
        {Txt("appliedOn", "Applied on", false, "date")}
        {Txt("cvLink", "CV link")}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={cvReceived}
            onChange={(e) => setCvReceived(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand/40"
          />
          CV received
        </label>
      </div>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" value={v.notes} onChange={set("notes")} rows={4} maxLength={4000} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add candidate"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
