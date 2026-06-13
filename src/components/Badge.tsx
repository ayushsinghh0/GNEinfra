const statusStyles: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  INVITED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  USED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  EXPIRED: "bg-slate-100 text-slate-400 ring-slate-400/20",
  REVOKED: "bg-rose-50 text-rose-600 ring-rose-600/20",
};

const dotStyles: Record<string, string> = {
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-amber-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
  INVITED: "bg-slate-400",
  PENDING: "bg-amber-500",
  USED: "bg-emerald-500",
  EXPIRED: "bg-slate-300",
  REVOKED: "bg-rose-500",
};

export default function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        statusStyles[value] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[value] ?? "bg-slate-400"}`} />
      {value.replace(/_/g, " ")}
    </span>
  );
}
