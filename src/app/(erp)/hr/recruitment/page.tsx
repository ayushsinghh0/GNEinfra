import Link from "next/link";
import { Briefcase, Users, UserCheck, ClipboardList, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { StatCard, Card, CardHeader, CardBody, EmptyState, btn } from "@/components/ui";
import { BarList } from "@/components/Charts";
import { HIRING_STAGES, HIRING_STAGE_LABELS } from "@/lib/recruitment-validation";

export const dynamic = "force-dynamic";

export default async function RecruitmentDashboard() {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const [totalPositions, openAgg, totalCandidates, byStage] = await Promise.all([
    prisma.jobPosition.count(),
    prisma.jobPosition.aggregate({ where: { status: "OPEN" }, _count: { _all: true }, _sum: { openings: true } }),
    prisma.candidate.count(),
    prisma.candidate.groupBy({ by: ["stage"], _count: { _all: true } }),
  ]);

  const openPositions = openAgg._count._all;
  const manpowerRequired = openAgg._sum.openings ?? 0;
  const stageCounts = new Map(byStage.map((r) => [r.stage, r._count._all]));
  const hired = stageCounts.get("HIRED") ?? 0;

  const stageBars = HIRING_STAGES.map((s) => ({
    label: HIRING_STAGE_LABELS[s],
    value: stageCounts.get(s) ?? 0,
    href: `/hr/recruitment/candidates?stage=${s}`,
  }));

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="Human Resources"
        title="Recruitment"
        subtitle="Open roles, sourcing and the hiring pipeline — at a glance."
        className="px-4 pb-6 pt-8 sm:px-6"
      >
        {canWrite && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/hr/recruitment/positions/new" className={btn("primary", "sm")}>+ Add position</Link>
            <Link href="/hr/recruitment/candidates/new" className={btn("secondary", "sm")}>+ Add candidate</Link>
          </div>
        )}
      </BrandHero>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open positions" value={openPositions} tone="brand" icon={<Briefcase className="h-4 w-4" />} href="/hr/recruitment/positions?status=OPEN" />
          <StatCard label="Manpower required" value={manpowerRequired} tone="amber" icon={<ClipboardList className="h-4 w-4" />} href="/hr/recruitment/positions" />
          <StatCard label="Candidates" value={totalCandidates} tone="blue" icon={<Users className="h-4 w-4" />} href="/hr/recruitment/candidates" />
          <StatCard label="Hired" value={hired} tone="emerald" icon={<UserCheck className="h-4 w-4" />} href="/hr/recruitment/candidates?stage=HIRED" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Pipeline" subtitle="Candidates by hiring stage" />
            <CardBody className="px-6 py-5">
              {totalCandidates === 0 ? (
                <EmptyState icon={<Users className="h-6 w-6" />} title="No candidates yet" description="Add candidates to see the pipeline funnel." />
              ) : (
                <BarList items={stageBars} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Positions"
              subtitle={`${totalPositions} role(s)`}
              action={<Link href="/hr/recruitment/positions" className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand">All positions<ChevronRight className="h-4 w-4" /></Link>}
            />
            <CardBody className="px-6 py-5">
              <div className="grid grid-cols-1 gap-3">
                <Link href="/hr/recruitment/positions" className="group flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><Briefcase className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">Manage positions</span><span className="block text-xs text-slate-500">Roles, JDs and manpower requirement</span></span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />
                </Link>
                <Link href="/hr/recruitment/candidates" className="group flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><Users className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">Manage candidates</span><span className="block text-xs text-slate-500">Sourcing, CV tracker and hiring status</span></span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
