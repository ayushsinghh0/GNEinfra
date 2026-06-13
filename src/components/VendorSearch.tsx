"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";

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
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search company, email, GST or PAN…"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          apply(q, e.target.value);
        }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s ? s.replace(/_/g, " ") : "All statuses"}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition"
      >
        Search
      </button>
    </form>
  );
}
