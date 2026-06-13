"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, Select, inputCls, cn } from "@/components/ui";

const STATUSES = ["", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

export default function VendorSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  // Keep inputs in sync if the URL changes (e.g. dashboard card link).
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setStatus(params.get("status") ?? "");
  }, [params]);

  function apply(nextQ: string, nextStatus: string) {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextStatus) sp.set("status", nextStatus);
    const qs = sp.toString();
    router.push(qs ? `/admin/vendors?${qs}` : "/admin/vendors");
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
          placeholder="Search company, email, GST or PAN…"
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
            {s ? s.replace(/_/g, " ") : "All statuses"}
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
