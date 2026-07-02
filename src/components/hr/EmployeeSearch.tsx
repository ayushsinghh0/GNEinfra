"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, Select, inputCls, cn } from "@/components/ui";
import { buildQuery } from "@/lib/hr-filters";

const STATUSES = ["", "ACTIVE", "INACTIVE"];

export default function EmployeeSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStatus = params.get("status") ?? "";

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

  function apply(nextQ: string, nextStatus: string) {
    // Preserve any ?category=/?location= scope the page arrived with (e.g. a
    // dashboard composition-bar deep-link) — a search/status change must not
    // silently drop it, mirroring AssetStatusFilter/ProjectFilters.
    const category = params.get("category") ?? undefined;
    const location = params.get("location") ?? undefined;
    router.push(
      buildQuery("/hr/employees", {
        q: nextQ || undefined,
        status: nextStatus || undefined,
        category,
        location,
      })
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q, status);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, EMP ID, designation or email…"
          className={cn(inputCls, "pl-9")}
        />
      </div>
      <Select
        value={status}
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
      <Button type="submit" variant="primary" className="sm:w-auto">
        <Search className="h-4 w-4" />
        Search
      </Button>
    </form>
  );
}
