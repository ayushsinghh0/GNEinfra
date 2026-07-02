import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui";

export type ComingSoonItem = { label: string; icon: LucideIcon; desc?: string };

// Planned-module roadmap: a numbered timeline instead of a flat grid, so an
// empty department reads as "this workflow is being built, in this order"
// rather than a page of gray placeholders.
export function ComingSoon({
  items,
  title = "Planned modules",
  subtitle = "This workflow is being built — each step goes live here as it ships.",
}: {
  items: ComingSoonItem[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <ol className="relative">
          {/* the rail connecting the steps */}
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-5 top-5 w-px border-l border-dashed border-slate-200"
          />
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <li key={it.label} className="relative flex items-start gap-4 pb-6 last:pb-0">
                <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="nums font-mono text-[11px] text-slate-300">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{it.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Soon
                    </span>
                  </div>
                  {it.desc && <p className="mt-1 text-xs leading-relaxed text-slate-500">{it.desc}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
