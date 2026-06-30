import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, CalendarRange, Layers, Gauge } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Chip,
  Avatar,
  ProgressBar,
  btn,
} from "@/components/ui";
import AssignEmployeeForm from "@/components/hr/AssignEmployeeForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";
import { projectTimeline, assignmentStats } from "@/lib/hr-projects";

export const dynamic = "force-dynamic";

function statusChipCls(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: {
        orderBy: { createdAt: "asc" },
        include: { employee: { select: { id: true, empId: true, name: true } } },
      },
    },
  });
  if (!project) notFound();

  const assignedIds = new Set(project.assignments.map((a) => a.employeeId));
  const assignableEmployees = canWrite
    ? (
        await prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, empId: true, name: true },
          orderBy: { name: "asc" },
        })
      ).filter((e) => !assignedIds.has(e.id))
    : [];

  const tl = projectTimeline(project.status, project.startDate, project.endDate);
  const stats = assignmentStats(project.assignments, project.startDate, project.endDate);

  return (
    <>
      <PageHeader title={project.name} subtitle={project.code}>
        <Link href="/hr/projects" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {canWrite && (
          <Link href={`/hr/projects/${id}/edit`} className={btn("primary", "sm")}>
            Edit
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={statusChipCls(project.status)}>{project.status.replace(/_/g, " ")}</Chip>
              <span className="text-sm text-slate-500">{project.client ?? "No client"}</span>
              <span className="nums ml-auto text-sm text-slate-600">
                {fmtDateOnly(project.startDate) ?? "—"} → {fmtDateOnly(project.endDate) ?? "—"}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>Timeline</span>
                <span className="font-medium text-slate-600">{tl.label}</span>
              </div>
              {tl.pct === null ? (
                <div className="h-2 rounded-full bg-slate-100" />
              ) : (
                <ProgressBar value={tl.pct} tone={tl.tone} />
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Team size" value={stats.teamSize} tone="brand" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Total allocation" value={`${stats.totalAllocation}%`} tone="blue" icon={<Gauge className="h-4 w-4" />} />
          <StatCard label="Duration" value={stats.durationDays != null ? `${stats.durationDays}d` : "—"} tone="amber" icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Roles" value={stats.roleCount} tone="emerald" icon={<Layers className="h-4 w-4" />} />
        </div>

        <Card>
          <CardHeader
            title="Team"
            subtitle={`${project.assignments.length} assigned`}
            action={<Users className="h-4 w-4 text-slate-400" />}
          />
          <CardBody>
            {project.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">No employees assigned to this project yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <Avatar name={a.employee.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/hr/employees/${a.employee.id}`}
                        className="block truncate font-medium text-slate-800 hover:text-brand-700"
                      >
                        {a.employee.name}
                      </Link>
                      <span className="nums font-mono text-xs text-slate-500">{a.employee.empId}</span>
                    </div>
                    <Chip className="bg-slate-100 text-slate-600">{a.roleOnProject ?? "—"}</Chip>
                    <div className="w-28">
                      {a.allocationPct != null ? (
                        <>
                          <div className="nums mb-1 text-right text-xs text-slate-500">{a.allocationPct}%</div>
                          <ProgressBar value={a.allocationPct} tone="brand" />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">— alloc</span>
                      )}
                    </div>
                    <span className="nums text-xs text-slate-500">
                      {fmtDateOnly(a.startDate) ?? "—"} → {fmtDateOnly(a.endDate) ?? "—"}
                    </span>
                    {canWrite && <RemoveAssignmentButton assignmentId={a.id} />}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <div className="mt-5">
                <AssignEmployeeForm projectId={project.id} employees={assignableEmployees} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
