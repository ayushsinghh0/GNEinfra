"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { tallySettingsSchema } from "@/lib/finance-validation";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";
import { zodFieldErrors } from "./form-utils";

export type TallyValues = Record<string, string>;

/**
 * Edits the TallySettings singleton — the ledger names the Tally XML export posts
 * to. Validated by the same tallySettingsSchema the API enforces. Blank fields
 * fall back to Tally defaults server-side.
 */
export default function TallySettingsForm({
  initial,
  canWrite,
  updatedInfo,
}: {
  initial: TallyValues;
  canWrite: boolean;
  updatedInfo?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<TallyValues>(initial);
  const [seed, setSeed] = useState(() => JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setFieldErrors((fe) => {
      if (!fe[k]) return fe;
      const next = { ...fe };
      delete next[k];
      return next;
    });
  };

  const dirty = JSON.stringify(v) !== seed;
  useUnsavedGuard(dirty && canWrite, "You have unsaved Tally settings. Leave without saving?");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = tallySettingsSchema.safeParse(v);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError("Please fix the highlighted field(s) before saving.");
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/finance/tally", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setSeed(JSON.stringify(v));
      toast("Tally settings saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const Txt = (k: string, label: string, hint?: string) => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} htmlFor={k} error={err} errorId={err ? errId : undefined} hint={hint}>
        <Input
          id={k}
          value={v[k] ?? ""}
          onChange={set(k)}
          maxLength={200}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
      </Field>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <fieldset disabled={!canWrite} className="min-w-0 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Txt("tallyCompanyName", "Tally company name", "must match the company in Tally")}
          {Txt("salesLedger", "Sales ledger", "credit ledger for invoice basic amount")}
          {Txt("gstLedger", "GST output ledger", "credit ledger for the tax amount")}
          {Txt("bankLedger", "Bank / Cash ledger", "debit ledger for receipts")}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        {canWrite && (
          <Button type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save Tally settings"}
          </Button>
        )}
        {updatedInfo && <span className="text-[12px] text-slate-500">Last saved by {updatedInfo}</span>}
      </div>
    </form>
  );
}
