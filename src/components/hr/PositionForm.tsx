"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  POSITION_STATUSES,
  POSITION_STATUS_LABELS,
  EMPLOYMENT_TYPES,
} from "@/lib/recruitment-validation";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";

type Values = Record<string, string>;
const EMPTY: Values = {
  title: "", code: "", department: "", band: "", location: "",
  employmentType: "", openings: "1", jobDescription: "", status: "OPEN",
};

export default function PositionForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
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
    if (!v.title.trim()) {
      setFieldErrors({ title: "Title is required" });
      setError("Please fix the highlighted field.");
      document.getElementById("title")?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(id ? `/api/hr/recruitment/positions/${id}` : "/api/hr/recruitment/positions", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      toast(id ? "Position saved" : "Position added");
      const pid = id ?? data.position?.id;
      router.push(pid ? `/hr/recruitment/positions/${pid}` : "/hr/recruitment/positions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const Txt = (k: string, label: string, req = false, type = "text", inputMode?: "numeric") => {
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
        {Txt("title", "Role / Position", true)}
        {Txt("code", "Requisition code")}
        {Txt("department", "Department")}
        {Txt("band", "Band")}
        {Txt("location", "Location")}
        <Field label="Employment type" htmlFor="employmentType">
          <Select id="employmentType" value={v.employmentType} onChange={set("employmentType")}>
            <option value="">—</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        {Txt("openings", "Openings (manpower required)", false, "number", "numeric")}
        <Field label="Status" required htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            {POSITION_STATUSES.map((s) => <option key={s} value={s}>{POSITION_STATUS_LABELS[s]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Job description" htmlFor="jobDescription">
        <Textarea
          id="jobDescription"
          value={v.jobDescription}
          onChange={set("jobDescription")}
          rows={7}
          maxLength={8000}
          placeholder="Responsibilities, required skills, qualifications…"
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add position"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
