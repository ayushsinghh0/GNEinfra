"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Undo2 } from "lucide-react";
import SlideOver from "@/components/SlideOver";
import AssetForm, { type AssetEmployee, type AssetValues } from "@/components/hr/AssetForm";

export default function AssetRowActions({
  asset,
  employees,
}: {
  asset: AssetValues & { id: string };
  employees: AssetEmployee[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patchReturned() {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/hr/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...asset, returnedAt: asset.returnedAt ? "" : today }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch { alert("Could not update return status."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Delete this asset record? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch { alert("Could not delete the asset record."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setEditing(true)} aria-label="Edit asset" disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={patchReturned} aria-label={asset.returnedAt ? "Mark as allocated" : "Mark as returned"} title={asset.returnedAt ? "Mark as allocated" : "Mark as returned"} disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={remove} aria-label="Delete asset" disabled={busy}
        className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
        <Trash2 className="h-4 w-4" />
      </button>

      <SlideOver open={editing} onClose={() => setEditing(false)} title="Edit asset record" subtitle={asset.employeeId}>
        <AssetForm employees={employees} asset={asset} assetId={asset.id} onDone={() => setEditing(false)} />
      </SlideOver>
    </div>
  );
}
