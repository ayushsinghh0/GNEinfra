import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import PolicyForm from "@/components/hr/PolicyForm";

export const dynamic = "force-dynamic";

export default async function NewPolicyPage() {
  await requirePageRole(HR_WRITE);
  return (
    <>
      <PageHeader
        title="Add policy"
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Policies", href: "/hr/policies" }, { label: "New" }]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            <PolicyForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
