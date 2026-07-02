import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import EnquiryForm from "@/components/bd/EnquiryForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBdEnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { clientId } = await searchParams;

  const clients = await prisma.bdClient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const valid = clientId && clients.some((c) => c.id === clientId);

  return (
    <>
      <PageHeader
        title="New enquiry"
        subtitle="A new row in the Query & Quote tracker"
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Enquiries & Quotes", href: "/bd/enquiries" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <EnquiryForm
              key={valid ? clientId : "blank"}
              clients={clients}
              initial={valid ? { clientId: clientId! } : undefined}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
