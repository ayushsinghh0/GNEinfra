import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import PoForm from "@/components/bd/PoForm";
import DeleteRowButton from "@/components/bd/DeleteRowButton";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const numStr = (n: number | null) => (n !== null ? String(n) : "");

export default async function EditBdPoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { id } = await params;

  const [po, clients, enquiries] = await Promise.all([
    prisma.bdPurchaseOrder.findUnique({ where: { id }, include: { client: { select: { name: true } } } }),
    prisma.bdClient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.bdEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { client: { select: { name: true } } },
    }),
  ]);
  if (!po) notFound();

  const enquiryOptions = enquiries.map((e) => ({
    id: e.id,
    label: `${e.client.name}${e.quoteNo ? ` · ${e.quoteNo}` : ""} (${e.fiscalYear})`,
  }));

  const initial = {
    fiscalYear: po.fiscalYear,
    receivedDate: dateStr(po.receivedDate),
    projectType: po.projectType ?? "",
    clientId: po.clientId,
    activities: po.activities ?? "",
    quoteNo: po.quoteNo ?? "",
    enquiryId: po.enquiryId ?? "",
    projectQty: po.projectQty ?? "",
    projectPeriod: po.projectPeriod ?? "",
    poNumber: po.poNumber ?? "",
    poValue: numStr(po.poValue),
    poDate: dateStr(po.poDate),
    poStart: dateStr(po.poStart),
    poEnd: dateStr(po.poEnd),
    remarks: po.remarks ?? "",
  };

  return (
    <>
      <PageHeader
        title={`Edit PO · ${po.client.name}`}
        subtitle={po.poNumber ? `PO ${po.poNumber}` : "Update this tracker row"}
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "PO Tracker", href: "/bd/pos" },
          { label: po.poNumber ?? po.client.name },
        ]}
      >
        <DeleteRowButton
          endpoint={`/api/bd/pos/${po.id}`}
          redirectTo="/bd/pos"
          title="Delete this PO?"
          message="This permanently removes the PO row from the tracker."
          doneToast="PO deleted"
        />
      </PageHeader>
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <PoForm key={po.id} id={po.id} initial={initial} clients={clients} enquiries={enquiryOptions} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
