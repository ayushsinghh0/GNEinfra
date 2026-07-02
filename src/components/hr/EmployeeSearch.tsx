"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Select, Spinner, inputCls, cn } from "@/components/ui";
import { buildQuery } from "@/lib/hr-filters";

const STATUSES = ["", "ACTIVE", "INACTIVE"];

export default function EmployeeSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStatus = params.get("status") ?? "";
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(urlQ);
  const [status, setStatus] = useState(urlStatus);

  // Re-sync inputs when the URL changes (e.g. a dashboard card link sets a
  // filter). React pattern: adjust state during render, not in an effect.
  const [seen, setSeen] = useState(`${urlQ}|${urlStatus}`);
  if (seen !== `${urlQ}|${urlStatus}`) {
    setSeen(`${urlQ}|${urlStatus}`);
    setQ(urlQ);
    setStatus(urlStatus);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel a pending search debounce on unmount so an orphaned timer can't fire
  // router.push() after the user has navigated away — mirrors ProjectFilters.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function apply(nextQ: string, nextStatus: string) {
    // Any explicit apply (Enter / status change) cancels a still-pending debounce,
    // so a stale timer can't clobber the value just applied.
    if (timer.current) clearTimeout(timer.current);
    // Preserve any ?category=/?location= scope the page arrived with (e.g. a
    // dashboard composition-bar deep-link) — a search/status change must not
    // silently drop it, mirroring AssetStatusFilter/ProjectFilters.
    const category = params.get("category") ?? undefined;
    const location = params.get("location") ?? undefined;
    const href = buildQuery("/hr/employees", {
      q: nextQ || undefined,
      status: nextStatus || undefined,
      category,
      location,
    });
    // Next's router already runs navigations inside a transition, which is
    // exactly why the page's loading.tsx fallback does NOT show for a
    // same-route searchParams change (that's the point — it avoids blowing
    // away the list with a full-page skeleton on every keystroke-triggered
    // search). But that leaves zero feedback of its own, so this control
    // wraps the push in its own useTransition to drive a local spinner
    // while the round-trip is in flight.
    startTransition(() => {
      router.push(href);
    });
  }

  // Debounced auto-apply as the user types — mirrors AssetSearch/ProjectFilters
  // (300ms). Enter still applies immediately via the form's onSubmit.
  function onQChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(v, status), 300);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q, status);
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
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search name, EMP ID, designation or email…"
          aria-label="Search employees"
          className={cn(inputCls, "pl-9")}
        />
      </div>
      <Select
        value={status}
        disabled={isPending}
        onChange={(e) => {
          setStatus(e.target.value);
          apply(q, e.target.value);
        }}
        className="sm:w-48"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s ? s : "All statuses"}
          </option>
        ))}
      </Select>
    </form>
  );
}
