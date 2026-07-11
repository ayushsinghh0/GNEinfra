"use client";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { phoneChars } from "@/components/finance/form-utils";
import { toast } from "@/components/Toast";
import { Plus, AlertCircle } from "lucide-react";

// Inline "add a client" used inside the enquiry/PO forms — POSTs to /api/bd/clients
// and hands the created {id, name} back so the parent can append + select it,
// without leaving the form. Enter inside its fields saves the client (not the
// outer form).
export default function AddClientInline({ onAdded }: { onAdded: (c: { id: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Client name is required"); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/bd/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactPerson, contactNumber }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not add client");
      onAdded({ id: d.client.id, name: d.client.name });
      toast("Client added");
      setOpen(false);
      setName("");
      setContactPerson("");
      setContactNumber("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add client");
    } finally {
      setBusy(false);
    }
  }

  // Enter inside these inputs saves the client instead of submitting the outer form.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" />
        Add client
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {err && (
        <div role="alert" className="flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5" />{err}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Client name" htmlFor="new-client-name">
          <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} autoFocus />
        </Field>
        <Field label="Contact person" htmlFor="new-client-person">
          <Input id="new-client-person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} onKeyDown={onKey} />
        </Field>
        <Field label="Contact no" htmlFor="new-client-number">
          <Input id="new-client-number" value={contactNumber} onChange={(e) => setContactNumber(phoneChars(e.target.value))} onKeyDown={onKey} inputMode="tel" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy}>{busy ? "Adding…" : "Add client"}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => { setOpen(false); setErr(null); }}>Cancel</Button>
      </div>
    </div>
  );
}
