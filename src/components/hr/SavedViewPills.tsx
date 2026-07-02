"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Segmented from "@/components/Segmented";
import { Spinner } from "@/components/ui";
import { buildQuery, type ParsedListParams } from "@/lib/hr-filters";

// "dir" was missing here — latent (no sortable list reuses this component
// yet), but any pill click would have silently reset a future ?dir= scope.
const DEFAULT_PRESERVE: (keyof ParsedListParams)[] = ["q", "category", "location", "employeeId", "sort", "dir"];

export interface SavedViewPillsProps {
  /** List page path the pills navigate within, e.g. "/hr/employees". */
  basePath: string;
  /** Query param the pills drive — defaults to "status". */
  param?: keyof ParsedListParams;
  /** Pill options; `value: ""` renders as the "All" pill. */
  views: { value: string; label: string }[];
  /** Other param names to carry through unchanged when a pill is clicked. */
  preserve?: (keyof ParsedListParams)[];
}

/**
 * Reusable "saved view" filter pills — a thin `Segmented` wrapper that
 * renders presets (e.g. status buckets) as URL navigations, built on the
 * shared `buildQuery` serializer (`@/lib/hr-filters`) so pills compose with
 * whatever else is already in the query string instead of clobbering it.
 * Navigation-only: no RBAC/mutation, safe to render for any HR viewer.
 */
export default function SavedViewPills({
  basePath,
  param = "status",
  views,
  preserve = DEFAULT_PRESERVE,
}: SavedViewPillsProps) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get(param) ?? "";
  // Local pending flag — Next's router already runs pushes inside a
  // transition (so the page's loading.tsx skeleton doesn't blow away the
  // list on a pill click), which otherwise leaves the click with zero
  // feedback of its own for the round-trip. Mirrors EmployeeSearch.tsx.
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    const patch: Record<string, string | undefined> = {};
    for (const key of preserve) {
      const value = params.get(key);
      if (value) patch[key] = value;
    }
    // Selecting a pill always resets pagination — buildQuery drops page===1.
    patch[param] = next || undefined;
    const href = buildQuery(basePath, patch as Partial<ParsedListParams>);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Segmented
        ariaLabel="Saved views"
        options={views}
        value={active}
        onChange={onChange}
        size="sm"
      />
      {isPending && <Spinner aria-hidden="true" />}
    </div>
  );
}
