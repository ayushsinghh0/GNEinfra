import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import EmployeeForm from "@/components/hr/EmployeeForm";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requirePageRole(HR_WRITE);
  return (
    <>
      <PageHeader title="Add employee" />
      <div className="p-8">
        <Card>
          <CardBody>
            <EmployeeForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
