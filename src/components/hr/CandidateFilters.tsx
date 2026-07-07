"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";
import { HIRING_STAGES, HIRING_STAGE_LABELS, CANDIDATE_SOURCES } from "@/lib/recruitment-validation";

// Stage / source / position dropdowns for the candidates list. Each preserves the
// other params (incl. the search `q`), so filters compose.
export default function CandidateFilters({ positions }: { positions: { id: string; title: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `/hr/recruitment/candidates?${qs}` : "/hr/recruitment/candidates"));
  }

  const stage = params.get("stage") ?? "";
  const source = params.get("source") ?? "";
  const positionId = params.get("positionId") ?? "";

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={stage} disabled={isPending} onChange={(e) => setParam("stage", e.target.value)} aria-label="Filter by stage" className="sm:w-44">
        <option value="">All stages</option>
        {HIRING_STAGES.map((s) => <option key={s} value={s}>{HIRING_STAGE_LABELS[s]}</option>)}
      </Select>
      <Select value={source} disabled={isPending} onChange={(e) => setParam("source", e.target.value)} aria-label="Filter by source" className="sm:w-40">
        <option value="">All sources</option>
        {CANDIDATE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Select value={positionId} disabled={isPending} onChange={(e) => setParam("positionId", e.target.value)} aria-label="Filter by position" className="sm:w-52">
        <option value="">All positions</option>
        {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </Select>
    </div>
  );
}
