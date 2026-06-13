// Dependency-free, server-rendered charts (just divs + CSS) — no client JS,
// no chart library, keeping the bundle and server light.

export function MonthlyBars({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums text-slate-600">
            {d.value || ""}
          </span>
          <div
            className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-300"
            style={{ height: `${d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0}%` }}
          />
          <span className="text-[11px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_BAR: Record<string, string> = {
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-amber-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
};

export function StatusBars({
  data,
}: {
  data: { label: string; status: string; value: number }[];
}) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.status}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium tabular-nums text-slate-700">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${STATUS_BAR[d.status] ?? "bg-slate-400"}`}
              style={{ width: `${(d.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
