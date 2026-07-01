// Pure URL list-filter helpers shared by every HR list page (employees, assets,
// attendance, payout, projects). Reads/writes the query string that drives
// search + status/category/location/employee filters + sort + pagination.
// Framework-agnostic (no React) so it works from both RSC pages (parsing
// `searchParams`) and client components (building `href`s for filter links).
//
// `status` is intentionally NOT whitelisted here — each HR list has its own
// status enum (employee ACTIVE/INACTIVE, project ACTIVE/ON_HOLD/COMPLETED,
// attendance PRESENT/ABSENT/…); callers validate against their own domain.

export interface ParsedListParams {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  employeeId?: string;
  sort?: string;
  dir: "asc" | "desc";
  page: number;
}

type RawSearchParams = Record<string, string | undefined>;

/** Trims a raw query-string value; empty/whitespace-only collapses to undefined. */
function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Parses raw `searchParams` (as handed to RSC pages, string values only) into
 * typed, trimmed list-filter state with sane defaults (`dir: "asc"`, `page: 1`).
 */
export function parseListParams(sp: RawSearchParams): ParsedListParams {
  return {
    q: trimmedOrUndefined(sp.q),
    status: trimmedOrUndefined(sp.status),
    category: trimmedOrUndefined(sp.category),
    location: trimmedOrUndefined(sp.location),
    employeeId: trimmedOrUndefined(sp.employeeId),
    sort: trimmedOrUndefined(sp.sort),
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
  };
}

/**
 * Serializes a list-filter patch onto `base`, dropping empty/undefined values
 * and defaults that add no signal (`page: 1`, `dir: "asc"`) so URLs stay
 * clean and shareable. Returns `base` unchanged (no trailing `?`) when the
 * patch carries no filters worth encoding.
 */
export function buildQuery(base: string, patch: Partial<ParsedListParams>): string {
  const usp = new URLSearchParams();

  const setIfPresent = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) usp.set(key, trimmed);
  };

  setIfPresent("q", patch.q);
  setIfPresent("status", patch.status);
  setIfPresent("category", patch.category);
  setIfPresent("location", patch.location);
  setIfPresent("employeeId", patch.employeeId);
  setIfPresent("sort", patch.sort);

  if (patch.dir === "desc") usp.set("dir", "desc");
  if (typeof patch.page === "number" && patch.page > 1) usp.set("page", String(patch.page));

  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}
