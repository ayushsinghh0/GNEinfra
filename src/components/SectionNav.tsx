"use client";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
  }

  return (
    <nav aria-label="Sections" className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => go(s.id)}
          aria-current={active === s.id ? "true" : undefined}
          className={cn(
            "press shrink-0 rounded-full px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            active === s.id ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
