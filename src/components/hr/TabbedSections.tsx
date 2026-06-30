"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/components/ui";

export type TabPanel = { id: string; label: string; panel: ReactNode };

/**
 * Real tabs (not a scroll-spy): renders a pill tablist and shows ONLY the active
 * panel — no page scrolling. Server-rendered sections are passed in as `panel`
 * nodes (their data is already fetched once on the server); switching is instant.
 */
export default function TabbedSections({ tabs }: { tabs: TabPanel[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, idx: number) {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActive(tabs[next].id);
    btnRefs.current[next]?.focus();
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-6">
      <nav
        role="tablist"
        aria-label="Sections"
        className="sticky top-[7.5rem] z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur md:top-16"
      >
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "press shrink-0 rounded-full px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                on
                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
      {current && (
        <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
          {current.panel}
        </div>
      )}
    </div>
  );
}
