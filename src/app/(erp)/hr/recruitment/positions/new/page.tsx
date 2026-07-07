import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import PositionForm from "@/components/hr/PositionForm";

export const dynamic = "force-dynamic";

export default async function NewPositionPage() {
  await requirePageRole(HR_WRITE);
  return (
    <>
      <PageHeader
        title="Add position"
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Positions", href: "/hr/recruitment/positions" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            <PositionForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
