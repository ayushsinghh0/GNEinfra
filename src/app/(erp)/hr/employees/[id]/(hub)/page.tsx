import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Laptop, FolderKanban, BadgeIndianRupee, IdCard, Contact, Wallet, Landmark } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR, fmtDateOnly } from "@/lib/format";
import { MONTHS } from "@/lib/hr-validation";
import { KeyValue, DetailSection, EntityLink, EmptyState } from "@/components/ui";
import { getEmployee } from "./_data";

export const dynamic = "force-dynamic";

// Per-tab document title — the hub's <h1> always renders emp.name regardless
// of active tab, so without this, switching Overview→Attendance→Assets→
// Projects→Payroll never changed document.title, giving assistive tech no
// cue the page changed under the route-tabs. getEmployee is React-cache()d,
// so this second call dedupes with the page body's below (one query/request).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = await getEmployee(id);
  return { title: emp ? `${emp.name} · Overview` : "Employee" };
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="press inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition-colors hover:text-brand"
    >
      View all
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export default async function EmployeeOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailSection title="Identity & Role" icon={<IdCard className="h-4 w-4 text-slate-400" />}>
          <KeyValue
            items={[
              { label: "EMP ID", value: emp.empId, mono: true, copy: true },
              { label: "Name", value: emp.name },
              { label: "Designation", value: emp.designation },
              { label: "Category", value: emp.empCategory },
              { label: "Location", value: emp.location },
              { label: "Payroll Type", value: emp.payrollType },
              { label: "I-Card No", value: emp.iCardNo, mono: true },
            ]}
          />
        </DetailSection>

        <DetailSection title="Contact & Personal" icon={<Contact className="h-4 w-4 text-slate-400" />}>
          <KeyValue
            items={[
              { label: "Mail ID", value: emp.mailId },
              { label: "Emergency Number", value: emp.emergencyNumber },
              { label: "Blood Group", value: emp.bloodGroup },
              { label: "Date of Birth", value: fmtDateOnly(emp.dob) },
              { label: "Date of Joining", value: fmtDateOnly(emp.dateOfJoining) },
              { label: "Offer Letter Date", value: fmtDateOnly(emp.offerLetterDate) },
              { label: "Leaving Date", value: fmtDateOnly(emp.leavingDate) },
            ]}
          />
        </DetailSection>

        <DetailSection title="Compensation" icon={<Wallet className="h-4 w-4 text-slate-400" />}>
          <KeyValue
            items={[
              { label: "Total CTC", value: fmtINR(emp.totalCtc) },
              { label: "Salary", value: fmtINR(emp.salary) },
              { label: "LTA", value: fmtINR(emp.lta) },
              { label: "Special Allowance", value: fmtINR(emp.specialAllowance) },
              { label: "Conveyance", value: fmtINR(emp.conveyance) },
            ]}
          />
          {emp.totalCtc != null && (
            <p className="nums mt-2.5 px-1 text-xs text-slate-400">
              Monthly gross ≈ {fmtINR(Math.round(emp.totalCtc / 12))}
            </p>
          )}
        </DetailSection>

        <DetailSection title="Statutory & Leave" icon={<Landmark className="h-4 w-4 text-slate-400" />}>
          <KeyValue
            items={[
              { label: "Bank A/C No", value: emp.bankAccountNo, mono: true, copy: true },
              { label: "Bank Name", value: emp.bankName },
              { label: "IFSC", value: emp.ifsc, mono: true, copy: true },
              { label: "PAN", value: emp.panNo, mono: true, copy: true },
              { label: "UAN", value: emp.uan, mono: true, copy: true },
              { label: "ESIC No", value: emp.esicNo, mono: true, copy: true },
            ]}
          />
        </DetailSection>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DetailSection title="Assets" action={<ViewAll href={`/hr/employees/${id}/assets`} />}>
          {emp.assets.length === 0 ? (
            <EmptyState icon={<Laptop className="h-5 w-5" />} title="No assets assigned" />
          ) : (
            <div className="space-y-2">
              {emp.assets.slice(0, 3).map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-700">
                    {a.makeModel || (a.hasLaptop ? "Laptop" : "Asset")}
                  </p>
                  {a.lpSerialNo && <p className="nums font-mono text-xs text-slate-400">{a.lpSerialNo}</p>}
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Projects" action={<ViewAll href={`/hr/employees/${id}/projects`} />}>
          {emp.projectAssignments.length === 0 ? (
            <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="No project assignments" />
          ) : (
            <div className="space-y-2">
              {emp.projectAssignments.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                >
                  <EntityLink
                    href={`/hr/projects/${a.project.id}`}
                    name={a.project.name}
                    code={a.project.code}
                    avatar={false}
                    icon={<FolderKanban className="h-4 w-4" />}
                  />
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    {a.roleOnProject && <p>{a.roleOnProject}</p>}
                    {a.allocationPct != null && <p className="nums">{a.allocationPct}%</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Payslips" action={<ViewAll href={`/hr/employees/${id}/payroll`} />}>
          {emp.payrolls.length === 0 ? (
            <EmptyState icon={<BadgeIndianRupee className="h-5 w-5" />} title="No payslips yet" />
          ) : (
            <div className="space-y-2">
              {emp.payrolls.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/hr/payout/${p.id}/print`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">
                    {MONTHS[p.periodMonth - 1]} {p.periodYear}
                  </span>
                  <span className="nums text-slate-600">{fmtINR(p.payableAmount)}</span>
                </Link>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
