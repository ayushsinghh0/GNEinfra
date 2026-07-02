"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Button, Spinner, inputCls, cn } from "@/components/ui";
import { buildQuery } from "@/lib/hr-filters";

// Search box for /scm/vendors. Status filtering moved to SavedViewPills, so
// this only owns `q` — it preserves the current `?status=` scope via
// buildQuery instead of clobbering it (mirrors EmployeeSearch).
export default function VendorSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [isPending, startTransition] = useTransition();

  // Re-sync when the URL changes (e.g. a dashboard card link or "Clear
  // filters" resets it). Adjust state during render, not in an effect.
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    setQ(urlQ);
  }

  function apply(nextQ: string) {
    const href = buildQuery("/scm/vendors", {
      q: nextQ,
      status: params.get("status") ?? undefined,
    });
    startTransition(() => router.push(href));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder="Search company, contact, email, GST or PAN…"
          aria-label="Search vendors"
          className={cn(inputCls, "pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden")}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              apply("");
            }}
            aria-label="Clear search"
            className="press absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button type="submit" variant="secondary" className="shrink-0">
        {isPending ? <Spinner /> : <Search className="h-4 w-4" />}
        Search
      </Button>
    </form>
  );
}
