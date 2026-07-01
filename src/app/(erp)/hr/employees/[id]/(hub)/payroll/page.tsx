import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeIndianRupee } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
import { DetailSection, EmptyState, btn } from "@/components/ui";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

export default async function EmployeePayrollTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  // `emp.payrolls` is already ordered [periodYear desc, periodMonth desc], so
  // grouping preserves most-recent-year-first without a re-sort.
  const byYear = new Map<number, typeof emp.payrolls>();
  for (const p of emp.payrolls) {
    const arr = byYear.get(p.periodYear);
    if (arr) arr.push(p);
    else byYear.set(p.periodYear, [p]);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link className={btn("secondary", "sm")} href={`/hr/payout?employeeId=${id}`}>
          Open payout →
        </Link>
      </div>

      {emp.payrolls.length === 0 ? (
        <DetailSection title="Payslips">
          <EmptyState
            icon={<BadgeIndianRupee className="h-5 w-5" />}
            title="No payslips yet"
            description="No payroll records have been processed for this employee."
          />
        </DetailSection>
      ) : (
        [...byYear.entries()].map(([year, slips]) => (
          <DetailSection key={year} title={String(year)}>
            <div className="space-y-2">
              {slips.map((p) => (
                <Link
                  key={p.id}
                  href={`/hr/payout/${p.id}/print`}
                  className="group flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm transition-colors hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700 group-hover:text-brand-700">
                    {MONTHS[p.periodMonth - 1]} {year}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="nums text-slate-600">{fmtINR(p.payableAmount)}</span>
                    <span className="text-xs font-medium text-brand-600 group-hover:underline">Slip →</span>
                  </div>
                </Link>
              ))}
            </div>
          </DetailSection>
        ))
      )}
    </div>
  );
}
