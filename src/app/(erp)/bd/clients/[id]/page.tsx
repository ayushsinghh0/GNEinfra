import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ReceiptText, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { SERVICE_TYPE_LABELS, PLANT_TYPE_LABELS } from "@/lib/bd-validation";
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
  Avatar,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BdClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);
  const { id } = await params;

  const client = await prisma.bdClient.findUnique({
    where: { id },
    include: {
      enquiries: { orderBy: { createdAt: "desc" }, take: 25 },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!client) notFound();

  const poValue = client.purchaseOrders.reduce((s, p) => s + (p.poValue ?? 0), 0);
  const openEnquiries = client.enquiries.filter((e) => e.finalStatus === "OPEN").length;

  type Enq = (typeof client.enquiries)[number];
  const enquiryColumns: Column<Enq>[] = [
    {
      key: "quote",
      header: "Enquiry",
      titleInCard: true,
      cell: (e) => (
        <span className="relative z-10">
          <EntityLink
            href={`/bd/enquiries/${e.id}`}
            name={e.projectType ?? e.activities ?? "Enquiry"}
            code={e.quoteNo ?? undefined}
          />
        </span>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      cardLabel: "Value",
      cell: (e) => <span className="nums">{fmtINR(e.value)}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cardLabel: "Stage",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.stage} />
        </span>
      ),
    },
    {
      key: "final",
      header: "Outcome",
      priority: "md",
      cardLabel: "Outcome",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.finalStatus} />
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      priority: "lg",
      cardLabel: "Date",
      cell: (e) => <span className="nums text-slate-500">{fmtDateOnly(e.enquiryDate) ?? "—"}</span>,
    },
  ];

  type Po = (typeof client.purchaseOrders)[number];
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
    {
      key: "period",
      header: "Period",
      priority: "lg",
      cardLabel: "Period",
      cell: (p) => p.projectPeriod ?? "—",
    },
  ];

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={client.industry ?? "Client"}
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Clients", href: "/bd/clients" },
          { label: client.name },
        ]}
      >
        {canWrite && (
          <>
            <Link href={`/bd/enquiries/new?clientId=${client.id}`} className={btn("secondary", "sm")}>
              + Enquiry
            </Link>
            <Link href={`/bd/pos/new?clientId=${client.id}`} className={btn("secondary", "sm")}>
              + PO
            </Link>
            <Link href={`/bd/clients/${client.id}/edit`} className={btn("primary", "sm")}>
              Edit
            </Link>
          </>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Identity + facts */}
        <Card>
          <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex items-center gap-4">
              <Avatar name={client.name} size="md" />
              <div>
                <div className="text-lg font-bold tracking-tight text-slate-900">{client.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span className="nums">{openEnquiries} open enquiries</span>
                  <span aria-hidden="true">·</span>
                  <span className="nums">{client.purchaseOrders.length} POs worth {fmtINR(poValue)}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 sm:border-l sm:border-slate-200 sm:pl-6">
              <KeyValue
                cols={2}
                items={[
                  { label: "Industry", value: client.industry ?? "—" },
                  { label: "Type of service", value: client.serviceType ? SERVICE_TYPE_LABELS[client.serviceType] : "—" },
                  { label: "Type of plant", value: client.plantType ? PLANT_TYPE_LABELS[client.plantType] : "—" },
                  { label: "Contact person", value: client.contactPerson ?? "—" },
                  { label: "Contact number", value: client.contactNumber ?? "—", mono: true },
                  { label: "Notes", value: client.notes ?? "—" },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FileText className="h-[18px] w-[18px] text-brand" />
                Enquiries & quotes
              </span>
            }
            subtitle={`${client.enquiries.length} on record`}
          />
          <DataTable
            rows={client.enquiries}
            columns={enquiryColumns}
            rowKey={(e) => e.id}
            href={(e) => `/bd/enquiries/${e.id}`}
            empty={
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="No enquiries for this client"
                action={
                  canWrite ? (
                    <Link href={`/bd/enquiries/new?clientId=${client.id}`} className={btn("primary", "sm")}>
                      + Record enquiry
                    </Link>
                  ) : undefined
                }
              />
            }
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ReceiptText className="h-[18px] w-[18px] text-brand" />
                Purchase orders
              </span>
            }
            subtitle={`${client.purchaseOrders.length} on record`}
          />
          <DataTable
            rows={client.purchaseOrders}
            columns={poColumns}
            rowKey={(p) => p.id}
            href={canWrite ? (p) => `/bd/pos/${p.id}/edit` : undefined}
            empty={
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="No POs from this client yet"
                action={
                  canWrite ? (
                    <Link href={`/bd/pos/new?clientId=${client.id}`} className={btn("primary", "sm")}>
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
