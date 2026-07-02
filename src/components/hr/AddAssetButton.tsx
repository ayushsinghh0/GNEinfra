"use client";
import { useState } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import SlideOver from "@/components/SlideOver";
import AssetForm, { type AssetEmployee } from "@/components/hr/AssetForm";

/**
 * Header "+ Add asset" trigger — opens the create form in a SlideOver instead
 * of the always-open Card the register used to dedicate half the page to.
 * Mirrors AssetRowActions' edit SlideOver: AssetForm already toasts + calls
 * router.refresh() on success, so this only needs to close the panel.
 */
export default function AddAssetButton({ employees }: { employees: AssetEmployee[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add asset
      </Button>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add asset record" icon={<Package className="h-5 w-5" />}>
        {/* Key on open/closed so reopening remounts AssetForm with a clean
            EMPTY state (mirrors AssetRowActions' edit-panel key pattern),
            rather than reusing whatever was left typed from a prior open. */}
        <AssetForm key={open ? "open" : "closed"} employees={employees} onDone={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
