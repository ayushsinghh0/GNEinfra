import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import ClientForm from "@/components/bd/ClientForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBdClientPage() {
  await requirePageRole(BD_WRITE);
  return (
    <>
      <PageHeader
        title="Add client"
        subtitle="A new entry in the BD client list"
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Clients", href: "/bd/clients" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-4xl">
          <CardBody>
            <ClientForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
