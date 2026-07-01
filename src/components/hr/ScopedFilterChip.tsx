import Link from "next/link";
import { X } from "lucide-react";

/**
 * Compact on-system banner rendered at the top of an HR list page's content
 * area when the page is deep-linked with `?employeeId=` (from the employee
 * detail page or, later, the employee-360 hub). Server component — no client
 * JS needed, just two links.
 */
export default function ScopedFilterChip({
  name,
  empId,
  employeeHref,
  clearHref,
}: {
  name: string;
  empId: string;
  employeeHref: string;
  clearHref: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm ring-1 ring-inset ring-slate-200">
      <span className="text-slate-500">Filtered to</span>
      <Link href={employeeHref} className="font-semibold text-brand-700 hover:underline">
        {name}
      </Link>
      <span className="nums font-mono text-xs text-slate-400">{empId}</span>
      <span className="text-slate-300">·</span>
      <Link
        href={clearHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </Link>
    </div>
  );
}
