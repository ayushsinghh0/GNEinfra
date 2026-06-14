"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, AlertCircle } from "lucide-react";
import { Button, Field, Input, Textarea, Select, btn, cn } from "@/components/ui";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "textarea" | "checkbox" | "datalist";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string | number | boolean;
  /** grid span on >=sm screens (1 or 2). Default 1. */
  span?: 1 | 2;
  /** Name of another field this field's options depend on (e.g. section depends on category). */
  dependsOn?: string;
  /** Options keyed by the controlling field's current value (used with dependsOn). */
  optionsBy?: Record<string, { value: string; label: string }[]>;
};

// A generic, reusable create/edit modal. Renders a trigger button; on submit it
// POSTs/PATCHes a JSON body (field values + any `hidden` values) to `endpoint`,
// then refreshes the server data. Drives every data-entry form in the Projects
// module from a simple field config.
export default function RecordForm({
  title,
  triggerLabel,
  triggerIcon,
  triggerVariant = "primary",
  triggerSize = "sm",
  fields,
  endpoint,
  method = "POST",
  hidden,
  submitLabel = "Save",
}: {
  title: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerVariant?: "primary" | "secondary" | "ghost";
  triggerSize?: "sm" | "md";
  fields: FieldDef[];
  endpoint: string;
  method?: "POST" | "PATCH";
  hidden?: Record<string, string | number | boolean>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current values of fields that other fields depend on (e.g. the
  // section options depend on the selected category).
  const controllers = new Set(fields.filter((f) => f.dependsOn).map((f) => f.dependsOn!));
  const [deps, setDeps] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of fields) {
      if (controllers.has(f.name)) {
        d[f.name] = String(f.defaultValue ?? f.options?.[0]?.value ?? "");
      }
    }
    return d;
  });
  const optionsFor = (f: FieldDef) =>
    f.dependsOn ? f.optionsBy?.[deps[f.dependsOn] ?? ""] ?? f.options ?? [] : f.options ?? [];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const body: Record<string, unknown> = { ...hidden };
      for (const f of fields) {
        if (f.type === "checkbox") body[f.name] = fd.get(f.name) === "on";
        else body[f.name] = fd.get(f.name) ?? "";
      }
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setError(null); }} className={btn(triggerVariant, triggerSize)}>
        {triggerIcon}
        {triggerLabel}
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center">
            <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={onSubmit} className="p-5">
                {error && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.name} className={cn(f.span === 2 || f.type === "textarea" ? "sm:col-span-2" : "")}>
                      {f.type === "checkbox" ? (
                        <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            name={f.name}
                            defaultChecked={Boolean(f.defaultValue)}
                            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                          />
                          {f.label}
                        </label>
                      ) : (
                        <Field label={f.label} required={f.required} hint={f.hint}>
                          {f.type === "textarea" ? (
                            <Textarea name={f.name} rows={2} defaultValue={f.defaultValue as string} placeholder={f.placeholder} />
                          ) : f.type === "datalist" ? (
                            <>
                              <Input
                                key={`${f.name}-${f.dependsOn ? deps[f.dependsOn] : ""}`}
                                name={f.name}
                                list={`dl-${f.name}-${f.dependsOn ? deps[f.dependsOn] : ""}`}
                                required={f.required}
                                placeholder={f.placeholder}
                                defaultValue={f.defaultValue as string | undefined}
                                autoComplete="off"
                              />
                              <datalist id={`dl-${f.name}-${f.dependsOn ? deps[f.dependsOn] : ""}`}>
                                {optionsFor(f).map((o) => (
                                  <option key={o.value} value={o.value} />
                                ))}
                              </datalist>
                            </>
                          ) : f.type === "select" ? (
                            <Select
                              name={f.name}
                              defaultValue={f.defaultValue as string}
                              required={f.required}
                              onChange={
                                controllers.has(f.name)
                                  ? (e) => setDeps((d) => ({ ...d, [f.name]: e.target.value }))
                                  : undefined
                              }
                            >
                              {(f.options ?? []).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              name={f.name}
                              type={f.type ?? "text"}
                              required={f.required}
                              placeholder={f.placeholder}
                              defaultValue={f.defaultValue as string | number | undefined}
                              step={f.type === "number" ? "any" : undefined}
                            />
                          )}
                        </Field>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className={btn("secondary", "md")}>
                    Cancel
                  </button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving…" : submitLabel}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
