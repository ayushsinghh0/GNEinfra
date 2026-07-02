"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, FormEvent } from "react";
import { Search } from "lucide-react";
import { inputCls, cn } from "@/components/ui";
import { buildQuery } from "@/lib/hr-filters";

/**
 * Free-text search for the asset register (`?q=`). Auto-applies on a 300ms
 * debounce (mirrors ProjectFilters — the module's standard auto-apply search
 * pattern) rather than requiring an explicit "Search" button click, while
 * still preserving the `employeeId`/`status` scope via buildQuery so a
 * search edit never clobbers an active filter, and vice versa.
 */
export default function AssetSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";

  const [q, setQ] = useState(urlQ);

  // Re-sync the input when the URL changes underneath us (e.g. a "Clear
  // filter" link resets `q`) — adjust state during render, not in an effect.
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    setQ(urlQ);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel a pending debounce on unmount so an orphaned timer can't fire
  // router.push() after the user has navigated away from this page.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(nextQ: string) {
    if (timer.current) clearTimeout(timer.current);
    const employeeId = params.get("employeeId") ?? undefined;
    const status = params.get("status") ?? undefined;
    router.push(buildQuery("/hr/assets", { q: nextQ.trim() || undefined, employeeId, status }));
  }

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v), 300);
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        push(q);
      }}
      className="relative sm:w-72"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search serial, make/model, OEM or employee…"
        aria-label="Search assets"
        className={cn(inputCls, "pl-9")}
      />
    </form>
  );
}
