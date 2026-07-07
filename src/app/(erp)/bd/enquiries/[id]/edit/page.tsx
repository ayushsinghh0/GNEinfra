import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import EnquiryForm from "@/components/bd/EnquiryForm";
import DeleteRowButton from "@/components/bd/DeleteRowButton";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const numStr = (n: number | null) => (n !== null ? String(n) : "");

export default async function EditBdEnquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { id } = await params;

  const [enquiry, clients] = await Promise.all([
    prisma.bdEnquiry.findUnique({ where: { id }, include: { client: { select: { name: true } } } }),
    prisma.bdClient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!enquiry) notFound();

  const initial = {
    fiscalYear: enquiry.fiscalYear,
    enquiryDate: dateStr(enquiry.enquiryDate),
    enquiryType: enquiry.enquiryType ?? "",
    clientId: enquiry.clientId,
    personName: enquiry.personName ?? "",
    contactNo: enquiry.contactNo ?? "",
    location: enquiry.location ?? "",
    projectType: enquiry.projectType ?? "",
    activities: enquiry.activities ?? "",
    unit: enquiry.unit ?? "",
    qty: numStr(enquiry.qty),
    quoteNo: enquiry.quoteNo ?? "",
    submissionDate: dateStr(enquiry.submissionDate),
    projectStatus: enquiry.projectStatus ?? "",
    probabilityPct: numStr(enquiry.probabilityPct),
    forecastedRevenue: numStr(enquiry.forecastedRevenue),
    stage: enquiry.stage,
    expectedClosure: dateStr(enquiry.expectedClosure),
    finalStatus: enquiry.finalStatus,
    customerContact: enquiry.customerContact ?? "",
    value: numStr(enquiry.value),
    notes: enquiry.notes ?? "",
    technology: enquiry.technology ?? "",
    serviceCategory: enquiry.serviceCategory ?? "",
    quotationStatus: enquiry.quotationStatus,
    submittedTo: enquiry.submittedTo ?? "",
    quoteValidUntil: dateStr(enquiry.quoteValidUntil),
    quoteRevision: enquiry.quoteRevision ?? "",
    enquirySource: enquiry.enquirySource ?? "",
    nextFollowUpDate: dateStr(enquiry.nextFollowUpDate),
  };

  return (
    <>
      <PageHeader
        title={`Edit enquiry · ${enquiry.client.name}`}
        subtitle={enquiry.quoteNo ? `Quote ${enquiry.quoteNo}` : "Update this tracker row"}
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Enquiries & Quotes", href: "/bd/enquiries" },
          { label: enquiry.quoteNo ?? enquiry.client.name, href: `/bd/enquiries/${enquiry.id}` },
          { label: "Edit" },
        ]}
      >
        <DeleteRowButton
          endpoint={`/api/bd/enquiries/${enquiry.id}`}
          redirectTo="/bd/enquiries"
          title="Delete this enquiry?"
          message="This permanently removes the tracker row. Any linked PO keeps its record."
          doneToast="Enquiry deleted"
        />
      </PageHeader>
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <EnquiryForm key={enquiry.id} id={enquiry.id} initial={initial} clients={clients} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
