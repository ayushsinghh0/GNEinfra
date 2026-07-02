import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Card, CardHeader, CardBody } from "@/components/ui";
import {
  ClipboardList,
  CalendarClock,
  HardHat,
  FileText,
  PackageCheck,
  ReceiptText,
  Workflow,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectPage() {
  await requirePageRole(deptArea("PROJECT"));
  return (
    <>
      <BrandHero
        variant="teal"
        size="md"
        eyebrow="Project"
        title="Project Workspace"
        subtitle="BOM, scheduling, deployment and billing — everything between a confirmed order and a commissioned site."
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
              { label: "BOM", icon: ClipboardList, desc: "Define bill of materials for each project." },
              { label: "Schedule Planning", icon: CalendarClock, desc: "Plan and track project timelines." },
              { label: "Deployment", icon: HardHat, desc: "Manage on-site deployment activities." },
              { label: "Execution", icon: HardHat, desc: "Track execution progress and milestones." },
              { label: "DPR", icon: FileText, desc: "Daily progress reports for active projects." },
              { label: "Approval", icon: PackageCheck, desc: "Submit and approve project deliverables." },
              { label: "MRC", icon: ClipboardList, desc: "Material requisition and consumption tracking." },
              { label: "Billing", icon: ReceiptText, desc: "Raise and manage project billing." },
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
                Where Project fits
              </span>
            }
          />
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-600">
              Project picks up orders confirmed by <b>BD</b>, draws materials through <b>SCM</b>,
              staffs sites with people from <b>HR</b>, and hands billed milestones to{" "}
              <b>Finance</b>.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
