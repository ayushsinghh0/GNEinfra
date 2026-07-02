import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_WRITE } from "@/lib/rbac";
import InvoiceForm, { type ItemValues } from "@/components/finance/InvoiceForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(FINANCE_WRITE);
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();
  // Content is locked once submitted — pending/approved invoices are read-only.
  if (invoice.status !== "DRAFT" && invoice.status !== "REJECTED") {
    redirect(`/finance/invoices/${invoice.id}`);
  }

  const initial = {
    invoiceNo: invoice.invoiceNo,
    invoiceDate: dateStr(invoice.invoiceDate),
    orderNo: invoice.orderNo ?? "",
    orderDate: dateStr(invoice.orderDate),
    contactPerson: invoice.contactPerson ?? "",
    contactNumber: invoice.contactNumber ?? "",
    billTo: invoice.billTo,
    shipTo: invoice.shipTo ?? "",
    gstLabel: invoice.gstLabel,
    gstRate: String(invoice.gstRate),
    notes: invoice.notes ?? "",
  };
  const initialItems: ItemValues[] = invoice.items.map((item) => ({
    description: item.description,
    sacCode: item.sacCode ?? "",
    qty: String(item.qty),
    uom: item.uom ?? "",
    rate: String(item.rate),
  }));

  return (
    <>
      <PageHeader
        title={`Edit ${invoice.invoiceNo}`}
        subtitle={
          invoice.status === "REJECTED"
            ? "Fix the rejected invoice, then resubmit it for approval"
            : "Update the draft invoice"
        }
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: invoice.invoiceNo, href: `/finance/invoices/${invoice.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <InvoiceForm key={invoice.id} id={invoice.id} initial={initial} initialItems={initialItems} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
