"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Spinner, inputCls, cn } from "@/components/ui";

// Debounced free-text search that preserves every other query param (stage /
// source / status / positionId filters). Shared by the positions + candidates lists.
export default function RecruitmentSearch({
  basePath,
  placeholder,
}: {
  basePath: string;
  placeholder: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(urlQ);

  // Re-sync when the URL q changes from elsewhere (adjust during render).
  const [seen, setSeen] = useState(urlQ);
  if (seen !== urlQ) {
    setSeen(urlQ);
    setQ(urlQ);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function apply(nextQ: string) {
    if (timer.current) clearTimeout(timer.current);
    const sp = new URLSearchParams(params.toString());
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    else sp.delete("q");
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(v), 300);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(q);
  }

  return (
    <form onSubmit={onSubmit} className="relative flex-1">
      {isPending ? (
        <Spinner className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className={cn(inputCls, "pl-9")}
      />
    </form>
  );
}
