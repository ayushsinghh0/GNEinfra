"use client";

import { useRouter } from "next/navigation";
import Segmented from "@/components/Segmented";

type ViewValue = "" | "pending" | "saved";

/**
 * All/Pending/Saved saved-view pills for the payout list. Payout URLs are
 * keyed on `year`/`month`/`employeeId` — outside `hr-filters`'s `buildQuery`
 * whitelist — so this does NOT route through `buildQuery` (which would
 * silently drop them). Instead it pushes a manually-built payout URL that
 * always preserves the month + employee scope, only ever changing `view`.
 * Navigation-only: no RBAC/mutation, safe for MANAGER (read-only) viewers.
 */
export default function PayoutViewPills({
  year,
  month,
  employeeId,
  view,
  counts,
}: {
  year: number;
  month: number;
  employeeId?: string;
  view?: string;
  counts?: { all: number; pending: number; saved: number };
}) {
  const router = useRouter();
  const active: ViewValue = view === "pending" || view === "saved" ? view : "";

  function push(next: ViewValue) {
    router.push(
      `/hr/payout?year=${year}&month=${month}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ""}${next ? `&view=${next}` : ""}`
    );
  }

  const label = (base: string, n?: number) => (typeof n === "number" ? `${base} ${n}` : base);

  return (
    <Segmented
      ariaLabel="Saved views"
      size="sm"
      value={active}
      onChange={push}
      options={[
        { value: "", label: label("All", counts?.all) },
        { value: "pending", label: label("Pending", counts?.pending) },
        { value: "saved", label: label("Saved", counts?.saved) },
      ]}
    />
  );
}
