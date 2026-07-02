"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Select, Spinner, inputCls, cn } from "@/components/ui";
import { buildQuery, type ParsedListParams } from "@/lib/hr-filters";

type FilterParam = "status" | "stage" | "fy" | "category" | "location";

export type ListSelect = {
  param: FilterParam;
  ariaLabel: string;
  /** Label of the empty option, e.g. "All stages". */
  allLabel: string;
  options: { value: string; label: string }[];
};

const ALL_PARAMS: (keyof ParsedListParams)[] = [
  "q", "status", "category", "location", "employeeId", "fy", "stage", "sort", "dir",
];

/**
 * Generic list search bar for the BD/Finance lists — a debounced free-text
 * input plus optional filter selects, all writing URL state via `buildQuery`
 * so every control composes with the page's other params (pills, sort, …).
 * Mirrors EmployeeSearch's debounce/transition/URL-resync behaviors.
 */
export default function ListSearch({
  basePath,
  placeholder,
  ariaLabel,
  selects = [],
}: {
  basePath: string;
  placeholder: string;
  ariaLabel: string;
  selects?: ListSelect[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQ = params.get("q") ?? "";
  const urlSelects = selects.map((s) => params.get(s.param) ?? "");

  const [q, setQ] = useState(urlQ);
  const [vals, setVals] = useState<string[]>(urlSelects);

  // Re-sync when the URL changes underneath us (pill click, dashboard link) —
  // adjust state during render, the same pattern as EmployeeSearch.
  const urlKey = [urlQ, ...urlSelects].join("|");
  const [seen, setSeen] = useState(urlKey);
  if (seen !== urlKey) {
    setSeen(urlKey);
    setQ(urlQ);
    setVals(urlSelects);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function apply(nextQ: string, nextVals: string[]) {
    if (timer.current) clearTimeout(timer.current);
    // Start from everything already in the URL so scopes never get dropped,
    // then overlay this bar's controls.
    const patch: Record<string, string | undefined> = {};
    for (const key of ALL_PARAMS) {
      const value = params.get(key);
      if (value) patch[key] = value;
    }
    patch.q = nextQ || undefined;
    selects.forEach((s, i) => {
      patch[s.param] = nextVals[i] || undefined;
    });
    startTransition(() => {
      router.push(buildQuery(basePath, patch as Partial<ParsedListParams>));
    });
  }

  function onQChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(value, vals), 300);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q, vals);
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
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(inputCls, "pl-9")}
        />
      </div>
      {selects.map((s, i) => (
        <Select
          key={s.param}
          value={vals[i]}
          disabled={isPending}
          aria-label={s.ariaLabel}
          onChange={(e) => {
            const next = vals.map((val, j) => (j === i ? e.target.value : val));
            setVals(next);
            apply(q, next);
          }}
          className="sm:w-44"
        >
          <option value="">{s.allLabel}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
    </form>
  );
}
