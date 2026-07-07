"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { Trash2 } from "lucide-react";

// Confirm-then-DELETE button shared by position + candidate detail pages.
export default function RecruitmentDelete({
  endpoint,
  redirectTo,
  label,
  message,
}: {
  endpoint: string;
  redirectTo: string;
  label: string;
  message: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not delete");
      toast(`${label} deleted`);
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setBusy(false);
      setOpen(false);
      toast(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title={`Delete ${label}?`}
        message={message}
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={del}
      />
    </>
  );
}
