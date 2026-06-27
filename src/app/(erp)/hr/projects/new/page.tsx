import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import ProjectForm from "@/components/hr/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requirePageRole(HR_WRITE);
  return (
    <>
      <PageHeader title="Add project" />
      <div className="p-8">
        <Card>
          <CardBody>
            <ProjectForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
