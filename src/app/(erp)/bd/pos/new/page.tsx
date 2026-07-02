import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import PoForm from "@/components/bd/PoForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBdPoPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; enquiryId?: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { clientId, enquiryId } = await searchParams;

  const [clients, enquiries, sourceEnquiry] = await Promise.all([
    prisma.bdClient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.bdEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { client: { select: { name: true } } },
    }),
    enquiryId
      ? prisma.bdEnquiry.findUnique({
          where: { id: enquiryId },
          include: { client: { select: { id: true } } },
        })
      : Promise.resolve(null),
  ]);

  const enquiryOptions = enquiries.map((e) => ({
    id: e.id,
    label: `${e.client.name}${e.quoteNo ? ` · ${e.quoteNo}` : ""} (${e.fiscalYear})`,
  }));

  // Deep-linked from an enquiry ("Record PO") — pre-fill everything we know.
  let initial: Record<string, string> | undefined;
  if (sourceEnquiry) {
    initial = {
      fiscalYear: sourceEnquiry.fiscalYear,
      clientId: sourceEnquiry.clientId,
      enquiryId: sourceEnquiry.id,
      quoteNo: sourceEnquiry.quoteNo ?? "",
      projectType: sourceEnquiry.projectType ?? "",
      activities: sourceEnquiry.activities ?? "",
    };
  } else if (clientId && clients.some((c) => c.id === clientId)) {
    initial = { clientId };
  }

  return (
    <>
      <PageHeader
        title="Record PO"
        subtitle="A new row in the PO Received tracker"
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "PO Tracker", href: "/bd/pos" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <PoForm
              key={sourceEnquiry?.id ?? clientId ?? "blank"}
              clients={clients}
              enquiries={enquiryOptions}
              initial={initial}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
