import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody, btn } from "@/components/ui";
import PayrollForm from "@/components/hr/PayrollForm";

export const dynamic = "force-dynamic";

const moneyStr = (n: number | null | undefined) => (n !== null && n !== undefined ? String(n) : "");

export default async function EmployeePayrollPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) notFound();

  const initial = {
    totalCtc: moneyStr(emp.totalCtc),
    salary: moneyStr(emp.salary),
    lta: moneyStr(emp.lta),
    specialAllowance: moneyStr(emp.specialAllowance),
    conveyance: moneyStr(emp.conveyance),
    bankAccountNo: emp.bankAccountNo ?? "",
    bankName: emp.bankName ?? "",
    ifsc: emp.ifsc ?? "",
    panNo: emp.panNo ?? "",
    uan: emp.uan ?? "",
    esicNo: emp.esicNo ?? "",
    pfDeduction: moneyStr(emp.pfDeduction),
    esiDeduction: moneyStr(emp.esiDeduction),
    tdsDeduction: moneyStr(emp.tdsDeduction),
    otherDeduction: moneyStr(emp.otherDeduction),
  };

  return (
    <>
      <PageHeader
        title={emp.name}
        subtitle={`${emp.empId}${emp.designation ? ` · ${emp.designation}` : ""}`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: emp.name }]}
      >
        <Link href={`/hr/payroll/${id}/slip/print`} className={btn("secondary", "sm")}>
          <FileText className="h-4 w-4" />
          Payment slip
        </Link>
      </PageHeader>
      <div className="p-8">
        <Card>
          <CardBody>
            {/* key={id}: remount on employee-to-employee navigation so the seeded state can't leak. */}
            <PayrollForm key={id} id={id} initial={initial} canWrite={canWrite} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
