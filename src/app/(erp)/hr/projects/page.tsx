import Link from "next/link";
import { Briefcase, FolderKanban, CircleDot, Users, Gauge } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, StatCard, EmptyState, btn } from "@/components/ui";
import { projectStats, statusCounts } from "@/lib/hr-projects";
import ProjectFilters from "@/components/hr/ProjectFilters";
import ProjectCard from "@/components/hr/ProjectCard";
import ScopedFilterChip from "@/components/hr/ScopedFilterChip";

export const dynamic = "force-dynamic";

const VALID = new Set(["ACTIVE", "ON_HOLD", "COMPLETED"]);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; employeeId?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { status, q, employeeId: rawEmployeeId } = await searchParams;
  const employeeId = rawEmployeeId?.trim() || undefined;

  const [allProjects, scopedEmployee] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignments: { include: { employee: { select: { id: true, name: true } } } } },
    }),
    employeeId
      ? prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, empId: true } })
      : Promise.resolve(null),
  ]);

  // Scoped to the projects that employee is assigned to (stats/counts below
  // then reflect just their project footprint, matching the deep-link intent).
  const projects = employeeId
    ? allProjects.filter((p) => p.assignments.some((a) => a.employee.id === employeeId))
    : allProjects;

  const stats = projectStats(projects);
  const counts = statusCounts(projects);

  const statusFilter = status && VALID.has(status) ? status : "";
  const term = (q ?? "").trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (term && !`${p.name} ${p.code} ${p.client ?? ""}`.toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Projects" subtitle={`${projects.length} project(s)`}>
        {canWrite && (
          <Link href="/hr/projects/new" className={btn("primary", "sm")}>
            + Add project
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {scopedEmployee && (
          <ScopedFilterChip
            name={scopedEmployee.name}
            empId={scopedEmployee.empId}
            employeeHref={`/hr/employees/${employeeId}`}
            clearHref="/hr/projects"
          />
        )}
        {projects.length === 0 ? (
          <Card className="overflow-hidden">
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title={scopedEmployee ? "No project assignments" : "No projects yet"}
              description={
                scopedEmployee
                  ? "This employee has not been assigned to any projects."
                  : "Add your first project to get started."
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total projects" value={stats.total} tone="brand" icon={<FolderKanban className="h-4 w-4" />} />
              <StatCard label="Active" value={stats.active} tone="emerald" icon={<CircleDot className="h-4 w-4" />} />
              <StatCard label="People assigned" value={stats.peopleAssigned} tone="blue" icon={<Users className="h-4 w-4" />} />
              <StatCard label="Avg team size" value={stats.avgTeam} tone="amber" icon={<Gauge className="h-4 w-4" />} />
            </div>

            <Card>
              <div className="p-4">
                <ProjectFilters counts={counts} />
              </div>
            </Card>

            {filtered.length === 0 ? (
              <Card className="overflow-hidden">
                <EmptyState
                  icon={<Briefcase className="h-6 w-6" />}
                  title="No projects match these filters"
                  description="Try a different status or search term."
                  action={
                    <Link href="/hr/projects" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
