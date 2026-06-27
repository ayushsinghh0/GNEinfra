import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { ClipboardList, CalendarClock, HardHat, FileText, PackageCheck, ReceiptText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectPage() {
  await requirePageRole(deptArea("PROJECT"));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Project" title="Project Workspace" subtitle="BOM, scheduling, deployment and billing." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8">
        <ComingSoon items={[
          { label: "BOM", icon: ClipboardList, desc: "Define bill of materials for each project." },
          { label: "Schedule Planning", icon: CalendarClock, desc: "Plan and track project timelines." },
          { label: "Deployment", icon: HardHat, desc: "Manage on-site deployment activities." },
          { label: "Execution", icon: HardHat, desc: "Track execution progress and milestones." },
          { label: "DPR", icon: FileText, desc: "Daily progress reports for active projects." },
          { label: "Approval", icon: PackageCheck, desc: "Submit and approve project deliverables." },
          { label: "MRC", icon: ClipboardList, desc: "Material requisition and consumption tracking." },
          { label: "Billing", icon: ReceiptText, desc: "Raise and manage project billing." },
        ]} />
      </div>
    </>
  );
}
