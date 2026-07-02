"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { PROJECT_STATUSES } from "@/lib/hr-validation";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";

type Values = Record<string, string>;
const EMPTY: Values = {
  name: "", code: "", client: "", status: "ACTIVE", startDate: "", endDate: "",
};

export default function ProjectForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    // Client-side pre-check mirroring the server's `.refine` on projectSchema
    // (src/lib/hr-validation.ts) — same rule, checked before the round-trip.
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      setFieldErrors({ endDate: "End date cannot be before start date" });
      setError("Please fix the highlighted field.");
      document.getElementById("endDate")?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(id ? `/api/hr/projects/${id}` : "/api/hr/projects", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      toast("Project saved", "success");
      const projectId = id ?? data.project?.id;
      router.push(projectId ? `/hr/projects/${projectId}` : "/hr/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  const Txt = (k: string, label: string, req = false, type = "text") => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={req} htmlFor={k} error={err} errorId={err ? errId : undefined}>
        <Input
          id={k}
          type={type}
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
        {Txt("name", "Project Name", true)}
        {Txt("code", "Project Code", true)}
        {Txt("client", "Client")}
        <Field label="Status" required htmlFor="status">
          <Select id="status" value={v.status} onChange={set("status")}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </Select>
        </Field>
        {Txt("startDate", "Start Date", false, "date")}
        {Txt("endDate", "End Date", false, "date")}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add project"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
