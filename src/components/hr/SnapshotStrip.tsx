import Link from "next/link";
import { cn } from "@/components/ui";

function SnapshotChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors",
        "hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"
      )}
    >
      {children}
    </Link>
  );
}

// A row of small linking chips beneath the identity header — each one jumps
// straight to the tab that explains it (the "connective tissue" of the hub).
export default function SnapshotStrip({
  id,
  tenureLabel,
  casualRemaining,
  sickRemaining,
  assetsCount,
  activeProjects,
  lastPay,
}: {
  id: string;
  tenureLabel: string;
  casualRemaining: number;
  sickRemaining: number;
  assetsCount: number;
  activeProjects: number;
  lastPay: string | null;
}) {
  const base = `/hr/employees/${id}`;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white px-6 py-3 sm:px-8">
      <SnapshotChip href={base}>
        <span className="nums">Tenure {tenureLabel}</span>
      </SnapshotChip>
      <SnapshotChip href={`${base}/attendance`}>
        <span className="nums">CL {casualRemaining} left</span>
      </SnapshotChip>
      <SnapshotChip href={`${base}/attendance`}>
        <span className="nums">SL {sickRemaining} left</span>
      </SnapshotChip>
      <SnapshotChip href={`${base}/assets`}>
        <span className="nums">{assetsCount} assets</span>
      </SnapshotChip>
      <SnapshotChip href={`${base}/projects`}>
        <span className="nums">{activeProjects} projects</span>
      </SnapshotChip>
      <SnapshotChip href={`${base}/payroll`}>
        {lastPay ? <span className="nums">Last pay {lastPay}</span> : "No payslips"}
      </SnapshotChip>
    </div>
  );
}
