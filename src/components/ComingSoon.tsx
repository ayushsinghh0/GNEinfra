import type { LucideIcon } from "lucide-react";

export type ComingSoonItem = { label: string; icon: LucideIcon; desc?: string };

export function ComingSoon({ items }: { items: ComingSoonItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="relative flex items-start gap-3 rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{it.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Soon</span>
              </div>
              {it.desc && <p className="mt-1 text-xs leading-relaxed text-slate-500">{it.desc}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
