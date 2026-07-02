"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Segmented from "@/components/Segmented";
import { buildQuery, type ParsedListParams } from "@/lib/hr-filters";

const DEFAULT_PRESERVE = ["q", "category", "location", "employeeId", "sort"];

export interface SavedViewPillsProps {
  /** List page path the pills navigate within, e.g. "/hr/employees". */
  basePath: string;
  /** Query param the pills drive — defaults to "status". */
  param?: string;
  /** Pill options; `value: ""` renders as the "All" pill. */
  views: { value: string; label: string }[];
  /** Other param names to carry through unchanged when a pill is clicked. */
  preserve?: string[];
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

  function onChange(next: string) {
    const patch: Record<string, string | undefined> = {};
    for (const key of preserve) {
      const value = params.get(key);
      if (value) patch[key] = value;
    }
    // Selecting a pill always resets pagination — buildQuery drops page===1.
    patch[param] = next || undefined;
    router.push(buildQuery(basePath, patch as Partial<ParsedListParams>));
  }

  return (
    <Segmented
      ariaLabel="Saved views"
      options={views}
      value={active}
      onChange={onChange}
      size="sm"
    />
  );
}
