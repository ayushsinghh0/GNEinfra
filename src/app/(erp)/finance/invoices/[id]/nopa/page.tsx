import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, FINANCE_WRITE } from "@/lib/rbac";
import { nextNopaNo } from "@/lib/finance-numbers";
import { numberInWords } from "@/lib/number-to-words";
import { getCompany } from "@/lib/company";
import NopaForm, { type NopaLineValues } from "@/components/finance/NopaForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function InvoiceNopaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(FINANCE_WRITE);
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      nopa: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!invoice) notFound();
  // An approved invoice can't be resubmitted.
  if (invoice.status === "APPROVED") {
    redirect(`/finance/invoices/${invoice.id}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  let initial: Record<string, string>;
  let initialLines: NopaLineValues[];

  if (invoice.nopa) {
    // Editing / resubmitting — start from the saved NOPA.
    const n = invoice.nopa;
    initial = {
      nopaNo: n.nopaNo,
      nopaDate: dateStr(n.nopaDate) || today,
      companyName: n.companyName,
      plantName: n.plantName ?? "",
      partyName: n.partyName ?? "",
      itemDescription: n.itemDescription ?? "",
      poRef: n.poRef ?? "",
      gstRate: String(n.gstRate),
      advancePaid: n.advancePaid ? String(n.advancePaid) : "",
      advanceRequest: n.advanceRequest ? String(n.advanceRequest) : "",
      dueDate: dateStr(n.dueDate),
      bankName: n.bankName ?? "",
      accountNo: n.accountNo ?? "",
      ifsc: n.ifsc ?? "",
      branchName: n.branchName ?? "",
      initiatedBy: n.initiatedBy ?? viewer.name,
      checkedBy: n.checkedBy ?? "",
    };
    initialLines = n.lines.map((l) => ({
      description: l.description,
      qtyWords: l.qtyWords ?? "",
      uom: l.uom ?? "",
      unitPrice: l.unitPrice ? String(l.unitPrice) : "",
      amount: l.amount ? String(l.amount) : "",
    }));
  } else {
    // First submit — prefill everything we can from the invoice itself.
    initial = {
      nopaNo: await nextNopaNo(),
      nopaDate: today,
      companyName: (await getCompany()).name,
      plantName: "",
      partyName: invoice.billTo.split("\n")[0] ?? "",
      itemDescription: invoice.items[0]?.description ?? "",
      poRef: invoice.orderNo ?? "",
      gstRate: String(invoice.gstRate),
      advancePaid: "",
      advanceRequest: "",
      dueDate: "",
      bankName: "",
      accountNo: "",
      ifsc: "",
      branchName: "",
      initiatedBy: viewer.name,
      checkedBy: "",
    };
    initialLines = invoice.items.map((item) => ({
      description: item.description,
      qtyWords: `${Number.isInteger(item.qty) ? numberInWords(item.qty) : String(item.qty)}${item.uom ? ` ${item.uom}` : ""}`,
      uom: item.uom ?? "",
      unitPrice: String(item.rate),
      amount: String(item.amount),
    }));
  }

  const resubmit = invoice.status === "REJECTED" || invoice.status === "PENDING_APPROVAL";

  return (
    <>
      <PageHeader
        title="Note on payment approval"
        subtitle={`For invoice ${invoice.invoiceNo} — submitting sends it to Manager / Admin / Superadmin`}
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: invoice.invoiceNo, href: `/finance/invoices/${invoice.id}` },
          { label: "NOPA" },
        ]}
      />
      <div className="p-8">
        <Card className="max-w-5xl">
          <CardBody>
            <NopaForm
              key={invoice.id}
              invoiceId={invoice.id}
              initial={initial}
              initialLines={initialLines}
              resubmit={resubmit}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
