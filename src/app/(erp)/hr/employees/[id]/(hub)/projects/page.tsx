import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import { DetailSection, EntityLink, EmptyState, btn } from "@/components/ui";
import AssignProjectForm from "@/components/hr/AssignProjectForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

export default async function EmployeeProjectsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { id } = await params;

  const [emp, activeProjects] = await Promise.all([
    getEmployee(id),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!emp) notFound();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link className={btn("secondary", "sm")} href={`/hr/projects?employeeId=${id}`}>
          View in projects →
        </Link>
      </div>

      <DetailSection title="Project Assignments" icon={<FolderKanban className="h-4 w-4 text-slate-400" />}>
        {emp.projectAssignments.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="No project assignments"
            description="This employee has not been assigned to any projects."
          />
        ) : (
          <div className="space-y-2">
            {emp.projectAssignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 text-sm"
              >
                <EntityLink
                  href={`/hr/projects/${a.project.id}`}
                  name={a.project.name}
                  code={a.project.code}
                  avatar={false}
                  icon={<FolderKanban className="h-4 w-4" />}
                />
                <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                  {a.roleOnProject && <span>{a.roleOnProject}</span>}
                  {a.allocationPct != null && <span className="nums">{a.allocationPct}%</span>}
                  <span className="nums text-slate-400">
                    {fmtDateOnly(a.startDate)} – {a.endDate ? fmtDateOnly(a.endDate) : "Ongoing"}
                  </span>
                  {canWrite && <RemoveAssignmentButton assignmentId={a.id} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {canWrite && <AssignProjectForm employeeId={id} projects={activeProjects} />}
      </DetailSection>
    </div>
  );
}
