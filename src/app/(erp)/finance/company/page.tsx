import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { fmtDate } from "@/lib/format";
import CompanyForm, { CompanyValues } from "@/components/finance/CompanyForm";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);

  const row = await prisma.companyProfile.findUnique({ where: { id: "company" } });
  const initial: CompanyValues = row
    ? {
        name: row.name,
        addressLines: row.addressLines,
        gstin: row.gstin ?? "",
        pan: row.pan ?? "",
        cin: row.cin ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        bankName: row.bankName ?? "",
        accountNo: row.accountNo ?? "",
        ifsc: row.ifsc ?? "",
      }
    : {
        name: COMPANY.name,
        addressLines: COMPANY.addressLines.join("\n"),
        gstin: COMPANY.gstin,
        pan: COMPANY.pan,
        cin: COMPANY.cin,
        email: COMPANY.email,
        phone: COMPANY.phone,
        bankName: COMPANY.bank.name,
        accountNo: COMPANY.bank.accountNo,
        ifsc: COMPANY.bank.ifsc,
      };

  return (
    <>
      <PageHeader
        title="Company details"
        subtitle="The From block printed on the Tax Invoice, NOPA, Approval Note and salary slips"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Company details" }]}
      />
      <div className="p-8">
        <Card className="max-w-4xl">
          <CardBody>
            <CompanyForm
              key={row ? String(row.updatedAt.getTime()) : "defaults"}
              initial={initial}
              canWrite={canWrite}
              updatedInfo={row ? `${row.updatedBy ?? "—"} · ${fmtDate(row.updatedAt)}` : null}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
