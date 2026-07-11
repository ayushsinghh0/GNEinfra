"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { POLICY_CATEGORIES } from "@/lib/hr-validation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "./useUnsavedGuard";

export interface PolicyValues {
  title: string;
  category: string;
  content: string;
  effectiveFrom: string; // yyyy-mm-dd or ""
  isActive: boolean;
}

const EMPTY: PolicyValues = { title: "", category: "", content: "", effectiveFrom: "", isActive: true };

// Create/edit a company policy. `id` present = edit (PATCH + Delete); absent = create (POST).
export default function PolicyForm({ id, initial }: { id?: string; initial?: PolicyValues }) {
  const router = useRouter();
  const seed = { ...EMPTY, ...initial };
  const [v, setV] = useState<PolicyValues>(seed);
  const [saved, setSaved] = useState(() => JSON.stringify(seed));
  const presets: readonly string[] = POLICY_CATEGORIES;
  const [categoryOther, setCategoryOther] = useState(() => Boolean(seed.category && !presets.includes(seed.category)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(v) !== saved;
  useUnsavedGuard(dirty && !busy, "You have unsaved policy changes. Leave without saving?");

  const set = (k: keyof PolicyValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(id ? `/api/hr/policies/${id}` : "/api/hr/policies", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setSaved(JSON.stringify(v));
      toast(id ? "Policy saved" : "Policy added");
      router.push("/hr/policies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/policies/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not delete");
      setSaved(JSON.stringify(v)); // suppress the unsaved guard on the way out
      toast("Policy deleted");
      router.push("/hr/policies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Title" required htmlFor="title" className="sm:col-span-2 lg:col-span-1">
          <Input id="title" value={v.title} onChange={set("title")} required aria-required maxLength={160} />
        </Field>
        <Field label="Category" htmlFor="category">
          <Select
            id="category"
            value={categoryOther ? "__OTHER__" : v.category}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__OTHER__") {
                setCategoryOther(true);
                setV((s) => ({ ...s, category: "" }));
              } else {
                setCategoryOther(false);
                setV((s) => ({ ...s, category: val }));
              }
            }}
          >
            <option value="">—</option>
            {POLICY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__OTHER__">Other…</option>
          </Select>
          {categoryOther && (
            <Input className="mt-2" value={v.category} onChange={set("category")} placeholder="Enter category" aria-label="Custom category" maxLength={60} />
          )}
        </Field>
        <Field label="Effective from" htmlFor="effectiveFrom">
          <Input id="effectiveFrom" type="date" value={v.effectiveFrom} onChange={set("effectiveFrom")} />
        </Field>
      </div>

      <Field label="Policy text" required htmlFor="content" hint="Plain text. Paste the full policy, or a summary plus a link to the signed document.">
        <Textarea id="content" value={v.content} onChange={set("content")} required aria-required rows={12} maxLength={20000} />
      </Field>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={v.isActive}
          onChange={(e) => setV((s) => ({ ...s, isActive: e.target.checked }))}
          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
        />
        Active (inactive policies stay listed but read as archived)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : id ? "Save policy" : "Add policy"}</Button>
        {id && (
          <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this policy?"
        message={`"${v.title || "This policy"}" will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
