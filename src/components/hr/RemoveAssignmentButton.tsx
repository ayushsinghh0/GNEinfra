"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
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
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        title="Remove assignment"
        aria-label="Remove assignment"
        className="press touch-manipulation inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 outline-none transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none"
      >
        <UserMinus className="h-4 w-4" aria-hidden="true" />
      </button>
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
