"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

// All HR_VIEW roles see all tabs in Phase 1 (field-level masking deferred) —
// kept as an array so per-role gating can be layered in later without
// restructuring the component.
function tabsFor(id: string) {
  const base = `/hr/employees/${id}`;
  return [
    { label: "Overview", href: base, exact: true },
    { label: "Attendance", href: `${base}/attendance`, exact: false },
    { label: "Assets", href: `${base}/assets`, exact: false },
    { label: "Projects", href: `${base}/projects`, exact: false },
    { label: "Compensation", href: `${base}/compensation`, exact: false },
  ];
}

export default function EmployeeTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const tabs = tabsFor(id);

  return (
    <nav
      aria-label="Employee sections"
      className="flex items-center gap-1 overflow-x-auto border-b border-slate-200/70 bg-white px-6 sm:px-8"
    >
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3.5 py-3 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
              active ? "text-brand-700" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </Link>
        );
      })}
    </nav>
  );
}
