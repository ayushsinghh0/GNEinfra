import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { ReceiptText, PackageCheck, BadgeIndianRupee, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requirePageRole(deptArea("FINANCE"));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Finance" title="Finance Workspace" subtitle="Invoices, payments and reconciliation." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8">
        <ComingSoon items={[
          { label: "Invoice Raise", icon: ReceiptText, desc: "Create and send invoices to clients." },
          { label: "Invoice Approval", icon: PackageCheck, desc: "Review and approve pending invoices." },
          { label: "Payment", icon: BadgeIndianRupee, desc: "Record and track incoming payments." },
          { label: "Reconciliation", icon: Wallet, desc: "Reconcile accounts and bank statements." },
        ]} />
      </div>
    </>
  );
}
