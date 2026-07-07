"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { HIRING_STAGES, HIRING_STAGE_LABELS } from "@/lib/recruitment-validation";
import { toast } from "@/components/Toast";

// Inline stage-move control (rendered only for writers). PATCHes just the stage;
// optimistic, reverting on error.
export default function CandidateStageSelect({ id, stage }: { id: string; stage: string }) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/recruitment/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not update stage");
      toast("Stage updated");
      router.refresh();
    } catch (e) {
      setValue(prev);
      toast(e instanceof Error ? e.message : "Could not update stage");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      aria-label="Hiring stage"
      className="w-44"
    >
      {HIRING_STAGES.map((s) => (
        <option key={s} value={s}>{HIRING_STAGE_LABELS[s]}</option>
      ))}
    </Select>
  );
}
