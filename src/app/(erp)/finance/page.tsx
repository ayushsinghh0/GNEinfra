import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { ReceiptText, PackageCheck, BadgeIndianRupee, Wallet, Workflow } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requirePageRole(deptArea("FINANCE"));
  return (
    <>
      <BrandHero
        variant="teal"
        size="md"
        eyebrow="Finance"
        title="Finance Workspace"
        subtitle="Invoices, payments and reconciliation — closing the loop on every project."
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
              { label: "Invoice Raise", icon: ReceiptText, desc: "Create and send invoices to clients." },
              { label: "Invoice Approval", icon: PackageCheck, desc: "Review and approve pending invoices." },
              { label: "Payment", icon: BadgeIndianRupee, desc: "Record and track incoming payments." },
              { label: "Reconciliation", icon: Wallet, desc: "Reconcile accounts and bank statements." },
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
                Where Finance fits
              </span>
            }
          />
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-600">
              Finance closes the loop: it bills the milestones the <b>Project</b> department
              delivers, settles vendors onboarded through <b>SCM</b>, and reconciles everything
              back to the books.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
