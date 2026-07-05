"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { companyProfileSchema } from "@/lib/finance-validation";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/hr/useUnsavedGuard";
import {
  digitsOnly,
  ifscChars,
  phoneChars,
  upperAlnum,
  zodFieldErrors,
} from "./form-utils";

export type CompanyValues = Record<string, string>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

type TxtOpts = {
  req?: boolean;
  inputMode?: "numeric" | "tel";
  hint?: ReactNode;
  placeholder?: string;
  maxLength?: number;
  sanitize?: (s: string) => string;
  className?: string;
};

/**
 * Edits the CompanyProfile singleton — the "From" block (name, address, GSTIN,
 * PAN, contact, bank) printed on the Tax Invoice, NOPA, Approval Note and
 * salary slips. Validated by the same companyProfileSchema the API enforces.
 */
export default function CompanyForm({
  initial,
  canWrite,
  updatedInfo,
}: {
  initial: CompanyValues;
  canWrite: boolean;
  /** "name · date" of the last save, when a saved row exists. */
  updatedInfo?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<CompanyValues>(initial);
  const [seed, setSeed] = useState(() => JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string, sanitize?: (s: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = sanitize ? sanitize(e.target.value) : e.target.value;
      setV((s) => ({ ...s, [k]: value }));
      setFieldErrors((fe) => {
        if (!fe[k]) return fe;
        const next = { ...fe };
        delete next[k];
        return next;
      });
    };

  const dirty = JSON.stringify(v) !== seed;
  useUnsavedGuard(dirty && canWrite, "You have unsaved company details. Leave without saving?");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = companyProfileSchema.safeParse(v);
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
      const res = await fetch("/api/finance/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setSeed(JSON.stringify(v));
      toast("Company details saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const Txt = (k: string, label: string, o: TxtOpts = {}) => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field
        label={label}
        required={o.req}
        htmlFor={k}
        error={err}
        errorId={err ? errId : undefined}
        hint={o.hint}
        className={o.className}
      >
        <Input
          id={k}
          value={v[k] ?? ""}
          onChange={set(k, o.sanitize)}
          inputMode={o.inputMode}
          placeholder={o.placeholder}
          maxLength={o.maxLength}
          required={o.req}
          aria-required={o.req || undefined}
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

      {/* Native disable of every control for read-only (manager) viewers. */}
      <fieldset disabled={!canWrite} className="min-w-0 space-y-5">
        <Section title="Company">
          {Txt("name", "Company name", {
            req: true,
            placeholder: "Green Next Energy Infra Pvt. Ltd.",
            maxLength: 200,
            className: "sm:col-span-2 lg:col-span-3",
          })}
          <Field
            label="Registered address"
            required
            htmlFor="addressLines"
            error={fieldErrors.addressLines}
            errorId={fieldErrors.addressLines ? "addressLines-error" : undefined}
            className="sm:col-span-2 lg:col-span-3"
            hint="one address line per line, max 4"
          >
            <Textarea
              id="addressLines"
              value={v.addressLines ?? ""}
              onChange={set("addressLines")}
              rows={3}
              maxLength={500}
              placeholder={"Flat No. C-3/8, DDA Flat, Near Krishna Cyber Café\nNew Delhi – 110065, India"}
              required
              aria-required
              aria-invalid={fieldErrors.addressLines ? true : undefined}
              aria-describedby={fieldErrors.addressLines ? "addressLines-error" : undefined}
            />
          </Field>
          {Txt("gstin", "GSTIN", {
            placeholder: "07AALCG5876C1ZD",
            maxLength: 15,
            sanitize: upperAlnum(15),
            hint: "15 characters",
          })}
          {Txt("pan", "PAN", {
            placeholder: "AALCG5876C",
            maxLength: 10,
            sanitize: upperAlnum(10),
            hint: "10 characters",
          })}
          {Txt("cin", "CIN", {
            placeholder: "U40106DL2024PTC000000",
            maxLength: 21,
            sanitize: upperAlnum(21),
            hint: "optional",
          })}
        </Section>

        <Section title="Contact">
          {Txt("phone", "Phone", {
            placeholder: "e.g. 99580 02517",
            inputMode: "tel",
            maxLength: 20,
            sanitize: phoneChars,
            hint: "8–15 digits",
          })}
          {Txt("email", "Email", {
            placeholder: "e.g. accounts@gneinfra.com",
            maxLength: 200,
          })}
        </Section>

        <Section title="Bank details">
          {Txt("bankName", "Bank name", { placeholder: "e.g. HDFC Bank", maxLength: 120 })}
          {Txt("accountNo", "Account no", {
            inputMode: "numeric",
            maxLength: 18,
            sanitize: digitsOnly(18),
            placeholder: "e.g. 50200102008242",
            hint: "9–18 digits",
          })}
          {Txt("ifsc", "IFSC code", {
            maxLength: 11,
            sanitize: ifscChars,
            placeholder: "e.g. HDFC0000483",
            hint: "11 characters",
          })}
        </Section>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite && (
          <Button type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save company details"}
          </Button>
        )}
        {updatedInfo && (
          <span className="text-[12px] text-slate-500">Last saved by {updatedInfo}</span>
        )}
      </div>
    </form>
  );
}
