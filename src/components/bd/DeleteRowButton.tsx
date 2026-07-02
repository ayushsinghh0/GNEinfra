"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

/**
 * Danger action for BD/Finance edit pages — confirm, DELETE the API resource,
 * then navigate back to the list. Render only when the viewer canWrite.
 */
export default function DeleteRowButton({
  endpoint,
  redirectTo,
  title,
  message,
  label = "Delete",
  doneToast = "Deleted",
}: {
  endpoint: string;
  redirectTo: string;
  title: string;
  message: string;
  label?: string;
  doneToast?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not delete");
      setOpen(false);
      toast(doneToast);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Trash2 className="h-3.5 w-3.5" /> {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        message={error ? `${message} (${error})` : message}
        confirmLabel={label}
        variant="danger"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
