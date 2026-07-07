import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wallet, Landmark, IdCard } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { KeyValue, DetailSection } from "@/components/ui";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

// See (hub)/page.tsx's generateMetadata comment — same per-tab title fix.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = await getEmployee(id);
  return { title: emp ? `${emp.name} · Compensation` : "Employee" };
}

export default async function EmployeeCompensationTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <DetailSection title="Pay Structure" icon={<Wallet className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "Band", value: emp.band },
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

      <DetailSection title="Bank Details" icon={<Landmark className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "Bank A/C No", value: emp.bankAccountNo, mono: true, copy: true },
            { label: "Bank Name", value: emp.bankName },
            { label: "IFSC", value: emp.ifsc, mono: true, copy: true },
          ]}
        />
      </DetailSection>

      <DetailSection title="Statutory IDs" icon={<IdCard className="h-4 w-4 text-slate-400" />}>
        <KeyValue
          items={[
            { label: "PAN", value: emp.panNo, mono: true, copy: true },
            { label: "UAN (PF)", value: emp.uan, mono: true, copy: true },
            { label: "ESIC No", value: emp.esicNo, mono: true, copy: true },
          ]}
        />
      </DetailSection>
    </div>
  );
}
