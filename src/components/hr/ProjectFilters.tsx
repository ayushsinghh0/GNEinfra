"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { Search } from "lucide-react";
import { inputCls, cn } from "@/components/ui";
import Segmented from "@/components/Segmented";

type Status = "" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export default function ProjectFilters({
  counts,
}: {
  counts: { all: number; ACTIVE: number; ON_HOLD: number; COMPLETED: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStatus = (params.get("status") ?? "") as Status;
  const employeeId = params.get("employeeId");

  const [q, setQ] = useState(urlQ);

  // Re-sync the input when the URL changes (e.g. an external link sets a filter).
  // React pattern: adjust state during render, not in an effect.
  const [seen, setSeen] = useState(`${urlQ}|${urlStatus}`);
  if (seen !== `${urlQ}|${urlStatus}`) {
    setSeen(`${urlQ}|${urlStatus}`);
    setQ(urlQ);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel a pending search debounce on unmount so an orphaned timer can't fire
  // router.push() after the user has navigated away (e.g. clicked a project card).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(nextQ: string, nextStatus: Status) {
    // Any explicit navigation (pill click / submit) cancels a still-pending debounce,
    // so a stale timer can't revert the status the user just chose.
    if (timer.current) clearTimeout(timer.current);
    const sp = new URLSearchParams();
    // Preserve an active ?employeeId= scope (Task 10) — a status/search change must
    // not silently drop the deep-link scope, mirroring AssetStatusFilter (Task 15).
    if (employeeId) sp.set("employeeId", employeeId);
    if (nextStatus) sp.set("status", nextStatus);
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    const qs = sp.toString();
    router.push(qs ? `/hr/projects?${qs}` : "/hr/projects");
  }

  function onQChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v, urlStatus), 300);
  }

  const options: { value: Status; label: string }[] = [
    { value: "", label: `All ${counts.all}` },
    { value: "ACTIVE", label: `Active ${counts.ACTIVE}` },
    { value: "ON_HOLD", label: `On Hold ${counts.ON_HOLD}` },
    { value: "COMPLETED", label: `Completed ${counts.COMPLETED}` },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Segmented
        ariaLabel="Filter projects by status"
        options={options}
        value={urlStatus}
        onChange={(v) => push(q, v)}
        size="sm"
      />
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          push(q, urlStatus);
        }}
        className="relative sm:w-72"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Search name, code or client…"
          aria-label="Search projects"
          className={cn(inputCls, "pl-9")}
        />
      </form>
    </div>
  );
}
