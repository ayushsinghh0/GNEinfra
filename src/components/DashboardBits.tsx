import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, cn } from "@/components/ui";

// Shared building blocks of the compact single-screen dashboards (HR `/hr`,
// BD `/bd`): a small KPI tile row + slim boxes with capped, internally-
// scrolling bodies. All rem-based so browser text-size changes scale cleanly.

export function KpiTile({
  label,
  value,
  dot,
  href,
}: {
  label: string;
  value: React.ReactNode;
  dot: string; // tailwind bg-* class for the tone dot
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
        <span className="truncate text-[11px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="nums mt-1 truncate text-lg font-semibold leading-none text-slate-900">{value}</div>
    </>
  );
  const base = "min-w-0 rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-card)]";
  return href ? (
    <Link
      href={href}
      className={cn(base, "lift block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40")}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

// Slim card shell: compact header + a capped, internally-scrolling body so the
// boxes never push the page past one screen (the cap tracks the viewport so
// short 16:10 laptops still fit; long lists scroll inside the box).
export function DashBox({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <span className="truncate">{title}</span>
          {meta && <span className="nums shrink-0 text-[11px] font-medium text-slate-400">{meta}</span>}
        </h2>
        {action}
      </div>
      <div className="max-h-[min(20rem,calc(100vh-20rem))] min-h-0 flex-1 overflow-y-auto px-4 py-2.5">{children}</div>
    </Card>
  );
}

export function BoxLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="press inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-700 transition-colors hover:text-brand"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function BoxEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 py-6 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-60 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
