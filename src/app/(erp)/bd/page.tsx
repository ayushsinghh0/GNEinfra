import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { Briefcase, FileText, ReceiptText, PackageCheck, Workflow } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BdPage() {
  await requirePageRole(deptArea("BD"));
  return (
    <>
      <BrandHero
        variant="teal"
        size="md"
        eyebrow="Business Development"
        title="BD Workspace"
        subtitle="Leads, quotations and order confirmation — from first contact to a confirmed order."
        className="px-6 pb-12 pt-10 sm:px-8"
      >
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white ring-1 ring-inset ring-white/25">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" aria-hidden="true" />
          In development
        </span>
      </BrandHero>

      <div className="grid grid-cols-1 items-start gap-6 p-6 sm:p-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ComingSoon
            items={[
              { label: "Lead", icon: Briefcase, desc: "Capture and qualify new business leads." },
              { label: "Quotation", icon: FileText, desc: "Prepare and send customer quotations." },
              { label: "Purchase Order", icon: ReceiptText, desc: "Receive and track customer POs." },
              { label: "Order Confirmation", icon: PackageCheck, desc: "Confirm orders and hand off to Project." },
            ]}
          />
        </div>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Workflow className="h-4 w-4" />
                </span>
                Where BD fits
              </span>
            }
          />
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-600">
              BD is the front door of the pipeline: leads become quotations, quotations become
              purchase orders, and confirmed orders hand off to the <b>Project</b> department for
              execution — with materials sourced through <b>SCM</b>.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
