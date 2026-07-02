import { requirePageRole, FINANCE_WRITE } from "@/lib/rbac";
import { nextInvoiceNo } from "@/lib/finance-numbers";
import InvoiceForm from "@/components/finance/InvoiceForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  await requirePageRole(FINANCE_WRITE);
  const suggestedNo = await nextInvoiceNo();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Raise invoice"
        subtitle="All fields are entered manually — totals are computed for you"
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <InvoiceForm initial={{ invoiceNo: suggestedNo, invoiceDate: today }} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
