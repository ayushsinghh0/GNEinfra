const statusStyles: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  INVITED: "bg-slate-50 text-slate-600 border-slate-200",
  PENDING: "bg-slate-50 text-slate-600 border-slate-200",
  USED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-slate-50 text-slate-400 border-slate-200",
  REVOKED: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        statusStyles[value] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
