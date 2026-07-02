import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText, StickyNote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  KeyValue,
  DetailSection,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BdEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);
  const { id } = await params;

  const enquiry = await prisma.bdEnquiry.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      purchaseOrders: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!enquiry) notFound();

  type Po = (typeof enquiry.purchaseOrders)[number];
  const poColumns: Column<Po>[] = [
    {
      key: "po",
      header: "PO",
      titleInCard: true,
      cell: (p) => (
        <span className="relative z-10">
          <EntityLink
            href={`/bd/pos/${p.id}/edit`}
            name={p.projectType ?? p.activities ?? "Purchase order"}
            code={p.poNumber ?? undefined}
          />
        </span>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      cardLabel: "Value",
      cell: (p) => <span className="nums">{fmtINR(p.poValue)}</span>,
    },
    {
      key: "poDate",
      header: "PO date",
      priority: "md",
      cardLabel: "PO date",
      cell: (p) => <span className="nums text-slate-500">{fmtDateOnly(p.poDate) ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={enquiry.client.name}
        subtitle={enquiry.quoteNo ? `Quote ${enquiry.quoteNo} · ${enquiry.fiscalYear}` : enquiry.fiscalYear}
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Enquiries & Quotes", href: "/bd/enquiries" },
          { label: enquiry.quoteNo ?? enquiry.client.name },
        ]}
      >
        {canWrite && enquiry.finalStatus !== "WON" && (
          <Link
            href={`/bd/pos/new?enquiryId=${enquiry.id}`}
            className={btn("secondary", "sm")}
          >
            + Record PO
          </Link>
        )}
        {canWrite && (
          <Link href={`/bd/enquiries/${enquiry.id}/edit`} className={btn("primary", "sm")}>
            Edit
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Status band */}
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <StatusChip status={enquiry.stage} />
            <StatusChip status={enquiry.finalStatus} />
            {enquiry.probabilityPct !== null && (
              <span className="nums rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {enquiry.probabilityPct}% probability
              </span>
            )}
            {enquiry.value !== null && (
              <span className="nums rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Quoted {fmtINR(enquiry.value)}
              </span>
            )}
            {enquiry.forecastedRevenue !== null && (
              <span className="nums rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Forecast {fmtINR(enquiry.forecastedRevenue)}
              </span>
            )}
            <span className="ml-auto text-[12px] text-slate-400">
              Client:{" "}
              <Link href={`/bd/clients/${enquiry.client.id}`} className="font-medium text-brand-700 hover:text-brand">
                {enquiry.client.name}
              </Link>
            </span>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DetailSection title="Enquiry">
            <KeyValue
              cols={2}
              items={[
                { label: "Fiscal year", value: enquiry.fiscalYear },
                { label: "Enquiry date", value: fmtDateOnly(enquiry.enquiryDate) ?? "—" },
                { label: "Type", value: enquiry.enquiryType ?? "—" },
                { label: "Person", value: enquiry.personName ?? "—" },
                { label: "Contact no", value: enquiry.contactNo ?? "—", mono: true },
                { label: "Location", value: enquiry.location ?? "—" },
                { label: "Customer contact", value: enquiry.customerContact ?? "—" },
              ]}
            />
          </DetailSection>

          <DetailSection title="Scope & quote">
            <KeyValue
              cols={2}
              items={[
                { label: "Project type", value: enquiry.projectType ?? "—" },
                { label: "Qty", value: enquiry.qty !== null ? `${enquiry.qty} ${enquiry.unit ?? ""}`.trim() : "—" },
                { label: "Quote no", value: enquiry.quoteNo ?? "—", mono: true },
                { label: "Submitted", value: fmtDateOnly(enquiry.submissionDate) ?? "—" },
                { label: "Status of project", value: enquiry.projectStatus ?? "—" },
                { label: "Expected closure", value: fmtDateOnly(enquiry.expectedClosure) ?? "—" },
                { label: "Activities", value: enquiry.activities ?? "—" },
              ]}
            />
          </DetailSection>
        </div>

        {enquiry.notes && (
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <StickyNote className="h-[18px] w-[18px] text-brand" />
                  Notes
                </span>
              }
            />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{enquiry.notes}</p>
            </CardBody>
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ReceiptText className="h-[18px] w-[18px] text-brand" />
                POs from this enquiry
              </span>
            }
            subtitle={`${enquiry.purchaseOrders.length} linked`}
          />
          <DataTable
            rows={enquiry.purchaseOrders}
            columns={poColumns}
            rowKey={(p) => p.id}
            href={canWrite ? (p) => `/bd/pos/${p.id}/edit` : undefined}
            empty={
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title="No PO linked yet"
                description="When this quote converts, record the PO and link it here."
                action={
                  canWrite ? (
                    <Link href={`/bd/pos/new?enquiryId=${enquiry.id}`} className={btn("primary", "sm")}>
                      + Record PO
                    </Link>
                  ) : undefined
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
