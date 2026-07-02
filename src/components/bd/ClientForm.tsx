"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { BD_SERVICE_TYPES, BD_PLANT_TYPES, SERVICE_TYPE_LABELS, PLANT_TYPE_LABELS } from "@/lib/bd-validation";
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
  name: "", industry: "", serviceType: "", plantType: "",
  contactPerson: "", contactNumber: "", notes: "",
};

function isDirty(a: Values, b: Values): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return true;
  }
  return false;
}

export default function ClientForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
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
      const res = await fetch(id ? `/api/bd/clients/${id}` : "/api/bd/clients", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setConfirmOpen(false);
      toast(id ? "Changes saved" : "Client added");
      router.push(id ? `/bd/clients/${id}` : `/bd/clients/${d.client.id}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.name.trim()) {
      setFieldErrors({ name: "Client name is required" });
      setError("Please fix the highlighted field(s) before saving.");
      document.getElementById("name")?.focus();
      return;
    }
    if (!id) { setConfirmOpen(true); return; }
    doSave();
  }

  const nameErr = fieldErrors.name;
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Client">
        <Field label="Client name" required htmlFor="name" error={nameErr} errorId={nameErr ? "name-error" : undefined}>
          <Input
            id="name"
            value={v.name}
            onChange={set("name")}
            required
            aria-required
            aria-invalid={nameErr ? true : undefined}
            aria-describedby={nameErr ? "name-error" : undefined}
          />
        </Field>
        <Field label="Industry" htmlFor="industry" hint="e.g. Renewable, Govt, O&M">
          <Input id="industry" value={v.industry} onChange={set("industry")} />
        </Field>
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
        <Field label="Contact person" htmlFor="contactPerson">
          <Input id="contactPerson" value={v.contactPerson} onChange={set("contactPerson")} />
        </Field>
        <Field label="Contact number" htmlFor="contactNumber">
          <Input id="contactNumber" value={v.contactNumber} onChange={set("contactNumber")} inputMode="numeric" />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="notes" value={v.notes} onChange={set("notes")} rows={3} />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add client"}</Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Add this client?"
        message={`This will add${v.name ? ` ${v.name.trim()}` : " a new client"} to the BD client list.`}
        confirmLabel="Add client"
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
