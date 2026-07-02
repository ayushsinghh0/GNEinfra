"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/hr-validation";
import { cn } from "@/components/ui";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Year-rollover-aware month neighbors, shared by the arrow-key scrub and the
// (now Link-based, prefetching) month grid.
function prevOf(y: number, m: number) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
function nextOf(y: number, m: number) {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}

export default function MonthPicker({
  year,
  month,
  basePath,
}: {
  year: number;
  month: number; // 1-12
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(y: number, m: number) {
    setOpen(false);
    router.push(`${basePath}?year=${y}&month=${m}`);
  }

  // Left/Right = previous/next month, but only while focus is inside this
  // widget (the trigger, or the open popover) — the handler is on THIS
  // component's own subtree, so keydowns elsewhere on the page never reach
  // it; the text-input check is extra insurance if a future popover control
  // needs one. Modifier combos (Cmd/Ctrl/Alt+Arrow) are left alone — those
  // are browser/OS shortcuts, not month-scrub gestures.
  function onWidgetKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const { y, m } = prevOf(year, month);
      go(y, m);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const { y, m } = nextOf(year, month);
      go(y, m);
    }
  }

  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  const thisMonthHref = `${basePath}?year=${curYear}&month=${curMonth}`;

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="relative" ref={ref} onKeyDown={onWidgetKeyDown}>
        <button
          type="button"
          onClick={() => { setViewYear(year); setOpen((o) => !o); }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="press inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="nums">{MONTHS[month - 1]} {year}</span>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 motion-safe:transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Choose month"
            className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-pop)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => Math.max(2000, y - 1))}
                aria-label="Previous year"
                className="press grid h-7 w-7 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="nums text-sm font-semibold text-slate-800">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => Math.min(2100, y + 1))}
                aria-label="Next year"
                className="press grid h-7 w-7 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SHORT.map((label, i) => {
                const m = i + 1;
                const isCurrent = viewYear === year && m === month;
                return (
                  <Link
                    key={label}
                    href={`${basePath}?year=${viewYear}&month=${m}`}
                    prefetch
                    onClick={() => setOpen(false)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "press rounded-lg py-1.5 text-center text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                      isCurrent
                        ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick-reset: jump straight to the current UTC month, from anywhere.
          Prefetched like the month grid above for a snappy landing. */}
      <Link
        href={thisMonthHref}
        prefetch
        title="Jump to the current month"
        className="press inline-flex h-8 items-center whitespace-nowrap rounded-xl px-2.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        This month
      </Link>
    </div>
  );
}
