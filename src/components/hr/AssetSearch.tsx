"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, Spinner, inputCls, cn } from "@/components/ui";
import { buildQuery } from "@/lib/hr-filters";

/**
 * Free-text search for the asset register (`?q=`), mirroring EmployeeSearch's
 * pattern: local editable input resynced from the URL, submitted via
 * buildQuery so the `employeeId`/`status` scope is preserved rather than
 * dropped.
 */
export default function AssetSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(urlQ);

  // Re-sync the input when the URL changes underneath us (e.g. a "Clear
  // filter" link resets `q`) — adjust state during render, not in an effect.
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    setQ(urlQ);
  }

  function apply(nextQ: string) {
    const employeeId = params.get("employeeId") ?? undefined;
    const status = params.get("status") ?? undefined;
    const href = buildQuery("/hr/assets", { q: nextQ || undefined, employeeId, status });
    startTransition(() => {
      router.push(href);
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        {isPending ? (
          <Spinner className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search serial, make/model, OEM or employee…"
          className={cn(inputCls, "pl-9")}
        />
      </div>
      <Button type="submit" variant="primary" className="sm:w-auto" disabled={isPending}>
        {isPending ? <Spinner className="border-white/40 border-t-white" /> : <Search className="h-4 w-4" />}
        Search
      </Button>
    </form>
  );
}
