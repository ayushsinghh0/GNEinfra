import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import EmployeeForm from "@/components/hr/EmployeeForm";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | null | undefined): string {
  if (!d) return "";
  // Format as YYYY-MM-DD in UTC so date inputs aren't shifted by timezone.
  return d.toISOString().slice(0, 10);
}

function toMoneyStr(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(n);
}

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_WRITE);
  const { id } = await params;

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) notFound();

  const initial = {
    empId: emp.empId,
    name: emp.name,
    designation: emp.designation,
    empCategory: emp.empCategory ?? "",
    location: emp.location ?? "",
    dateOfJoining: toDateStr(emp.dateOfJoining),
    payrollType: emp.payrollType ?? "",
    mailId: emp.mailId ?? "",
    emergencyNumber: emp.emergencyNumber ?? "",
    bloodGroup: emp.bloodGroup ?? "",
    iCardNo: emp.iCardNo ?? "",
    dob: toDateStr(emp.dob),
    offerLetterDate: toDateStr(emp.offerLetterDate),
    leavingDate: toDateStr(emp.leavingDate),
    totalCtc: toMoneyStr(emp.totalCtc),
    salary: toMoneyStr(emp.salary),
    lta: toMoneyStr(emp.lta),
    specialAllowance: toMoneyStr(emp.specialAllowance),
    conveyance: toMoneyStr(emp.conveyance),
    casualLeaveQuota: String(emp.casualLeaveQuota),
    sickLeaveQuota: String(emp.sickLeaveQuota),
    bankAccountNo: emp.bankAccountNo ?? "",
    uan: emp.uan ?? "",
    panNo: emp.panNo ?? "",
  };

  return (
    <>
      <PageHeader title={`Edit — ${emp.name}`} subtitle={emp.empId} />
      <div className="p-8">
        <Card>
          <CardBody>
            <EmployeeForm id={id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
