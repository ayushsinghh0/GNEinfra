"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, cn } from "@/components/ui";

type VendorOption = { id: string; companyName: string };

// Compact inline control to assign an invited vendor to a BOQ item.
// Designed to live inside a table cell — renders a tiny full-width select.
export default function VendorAssign({
  projectId,
  itemId,
  currentVendorId,
  vendors,
}: {
  projectId: string;
  itemId: string;
  currentVendorId: string | null;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/boq/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: e.target.value || null }),
      });
      router.refresh();
    } catch {
      // Revert is not required; just stop the saving state.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        defaultValue={currentVendorId ?? ""}
        onChange={handleChange}
        disabled={saving}
        className={cn(inputCls, "h-8 text-xs")}
      >
        <option value="">— Unassigned —</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.companyName}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-slate-400">…</span>}
    </div>
  );
}
