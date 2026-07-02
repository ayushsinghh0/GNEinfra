"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

export default function RemoveAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not remove the assignment");
      }
      setConfirmOpen(false);
      toast("Assignment removed", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove the assignment", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        title="Remove assignment"
        aria-label="Remove assignment"
        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Remove assignment?"
        message="This project assignment will be removed."
        confirmLabel="Remove"
        variant="danger"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
