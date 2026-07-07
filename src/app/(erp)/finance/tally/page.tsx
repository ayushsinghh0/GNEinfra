import { requirePageRole, FINANCE_VIEW, FINANCE_WRITE } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTallySettings } from "@/lib/tally-settings";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui";
import TallyExport from "@/components/finance/TallyExport";
import TallySettingsForm from "@/components/finance/TallySettingsForm";

export const dynamic = "force-dynamic";

export default async function TallyPage() {
  const viewer = await requirePageRole(FINANCE_VIEW);
  const canWrite = FINANCE_WRITE.includes(viewer.role);

  const [effective, row] = await Promise.all([
    getTallySettings(),
    prisma.tallySettings.findUnique({ where: { id: "tally" } }),
  ]);
  const initial = {
    tallyCompanyName: effective.tallyCompanyName,
    salesLedger: effective.salesLedger,
    gstLedger: effective.gstLedger,
    bankLedger: effective.bankLedger,
  };

  return (
    <>
      <PageHeader
        title="Tally export"
        subtitle="Export approved invoices and paid receipts as Tally XML vouchers"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Tally export" }]}
      />
      <div className="space-y-6 p-8">
        <TallyExport />
        <Card className="max-w-4xl">
          <CardHeader
            title="Ledger mapping"
            subtitle="Ledger names used in the exported vouchers — a blank field falls back to the Tally default"
          />
          <CardBody className="px-6 py-5">
            <TallySettingsForm
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
