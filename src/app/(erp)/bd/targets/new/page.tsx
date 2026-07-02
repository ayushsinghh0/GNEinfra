import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import TargetForm from "@/components/bd/TargetForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBdTargetPage() {
  await requirePageRole(BD_WRITE);
  return (
    <>
      <PageHeader
        title="Add target"
        subtitle="A new line in the business target sheet"
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Targets", href: "/bd/targets" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-4xl">
          <CardBody>
            <TargetForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
