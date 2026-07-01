import { statusMeta } from "@/lib/hr-status";

export default function Badge({ value }: { value: string }) {
  const m = statusMeta(value);
  const ring = m.ring ?? "ring-slate-500/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.chip} ${ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {value.replace(/_/g, " ")}
    </span>
  );
}
