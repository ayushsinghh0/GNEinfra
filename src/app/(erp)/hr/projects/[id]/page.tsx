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
  StatusChip,
  EntityLink,
  EmptyState,
  ProgressBar,
  btn,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import AssignEmployeeForm from "@/components/hr/AssignEmployeeForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";
import { projectTimeline, assignmentStats } from "@/lib/hr-projects";

export const dynamic = "force-dynamic";

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

  type AssignmentRow = (typeof project.assignments)[number];
  const rosterColumns: Column<AssignmentRow>[] = [
    {
      key: "employee",
      header: "Employee",
      titleInCard: true,
      cell: (a) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/employees/${a.employee.id}`} name={a.employee.name} code={a.employee.empId} />
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      cardLabel: "Role",
      cell: (a) => a.roleOnProject ?? "—",
    },
    {
      key: "allocation",
      header: "Allocation",
      cardLabel: "Allocation",
      cell: (a) =>
        a.allocationPct != null ? (
          <div className="w-28">
            <div className="nums mb-1 text-right text-xs text-slate-500">{a.allocationPct}%</div>
            <ProgressBar value={a.allocationPct} tone="brand" />
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "dates",
      header: "Dates",
      priority: "lg",
      cardLabel: "Dates",
      cell: (a) => (
        <span className="nums">
          {fmtDateOnly(a.startDate) ?? "—"} → {fmtDateOnly(a.endDate) ?? "Ongoing"}
        </span>
      ),
    },
  ];
  if (canWrite) {
    rosterColumns.push({
      key: "actions",
      header: "Actions",
      cardLabel: "Actions",
      cell: (a) => (
        <span className="relative z-10">
          <RemoveAssignmentButton assignmentId={a.id} />
        </span>
      ),
    });
  }

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
              <StatusChip status={project.status} />
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
            <DataTable
              rows={project.assignments}
              columns={rosterColumns}
              rowKey={(a) => a.id}
              empty={
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="No employees assigned"
                  description="No employees have been assigned to this project yet."
                />
              }
            />
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
