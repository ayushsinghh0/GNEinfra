"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { X } from "lucide-react";

export default function RemoveAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Remove this project assignment?")) return;
    setBusy(true);
    try {
      await fetch(`/api/hr/assignments/${assignmentId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={busy}
      title="Remove assignment"
      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}
