import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import ClientForm from "@/components/bd/ClientForm";
import DeleteRowButton from "@/components/bd/DeleteRowButton";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditBdClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { id } = await params;
  const client = await prisma.bdClient.findUnique({ where: { id } });
  if (!client) notFound();

  const initial = {
    name: client.name,
    industry: client.industry ?? "",
    serviceType: client.serviceType ?? "",
    plantType: client.plantType ?? "",
    contactPerson: client.contactPerson ?? "",
    contactNumber: client.contactNumber ?? "",
    notes: client.notes ?? "",
  };

  return (
    <>
      <PageHeader
        title={`Edit ${client.name}`}
        subtitle="Update this client's details"
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Clients", href: "/bd/clients" },
          { label: client.name, href: `/bd/clients/${client.id}` },
          { label: "Edit" },
        ]}
      >
        <DeleteRowButton
          endpoint={`/api/bd/clients/${client.id}`}
          redirectTo="/bd/clients"
          title="Delete this client?"
          message={`This permanently removes ${client.name} from the client list. Clients with enquiries or POs on record cannot be deleted.`}
          doneToast="Client deleted"
        />
      </PageHeader>
      <div className="p-8">
        <Card className="max-w-4xl">
          <CardBody>
            <ClientForm key={client.id} id={client.id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
