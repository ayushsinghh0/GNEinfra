import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Users, UserRound, CalendarClock, BadgeIndianRupee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  await requirePageRole(deptArea("HR"));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Workspace" subtitle="Manpower, recruitment, attendance and payroll." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8">
        <ComingSoon items={[
          { label: "Manpower Planning", icon: Users, desc: "Plan and forecast workforce requirements." },
          { label: "Recruitment", icon: UserRound, desc: "Manage job postings and candidate pipeline." },
          { label: "Attendance", icon: CalendarClock, desc: "Track employee attendance and leave." },
          { label: "Payroll", icon: BadgeIndianRupee, desc: "Process monthly payroll and disbursements." },
        ]} />
      </div>
    </>
  );
}
