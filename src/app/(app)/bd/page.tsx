import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Briefcase, FileText, ReceiptText, PackageCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BdPage() {
  await requirePageRole(deptArea("BD"));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Business Development" title="BD Workspace" subtitle="Leads, quotations and order confirmation." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8">
        <ComingSoon items={[
          { label: "Lead", icon: Briefcase, desc: "Capture and qualify new business leads." },
          { label: "Quotation", icon: FileText, desc: "Prepare and send customer quotations." },
          { label: "Purchase Order", icon: ReceiptText, desc: "Receive and track customer POs." },
          { label: "Order Confirmation", icon: PackageCheck, desc: "Confirm orders and hand off to Project." },
        ]} />
      </div>
    </>
  );
}
