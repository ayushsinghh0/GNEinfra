import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Chip,
  btn,
  thCls,
  theadRowCls,
  tdCls,
  trCls,
} from "@/components/ui";
import { ArrowLeft, Users } from "lucide-react";
import AssignEmployeeForm from "@/components/hr/AssignEmployeeForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-44 shrink-0 text-[13px] font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

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
        include: {
          employee: { select: { id: true, empId: true, name: true } },
        },
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
          <CardHeader
            title="Project Details"
            action={
              <Chip className={statusChipCls(project.status)}>
                {project.status.replace(/_/g, " ")}
              </Chip>
            }
          />
          <CardBody>
            <div className="divide-y divide-slate-100">
              <Row label="Code" value={<span className="nums font-mono text-xs">{project.code}</span>} />
              <Row label="Name" value={project.name} />
              <Row label="Client" value={project.client} />
              <Row label="Start Date" value={fmtDateOnly(project.startDate)} />
              <Row label="End Date" value={fmtDateOnly(project.endDate)} />
              <Row label="Created" value={fmtDateOnly(project.createdAt)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Assigned Employees"
            subtitle={`${project.assignments.length} assigned`}
            action={<Users className="h-4 w-4 text-slate-400" />}
          />
          <CardBody>
            {project.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">No employees assigned to this project yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>EMP ID</th>
                      <th className={thCls}>Name</th>
                      <th className={thCls}>Role</th>
                      <th className={thCls}>Alloc%</th>
                      <th className={thCls}>Start</th>
                      <th className={thCls}>End</th>
                      {canWrite && <th className={thCls}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {project.assignments.map((a) => (
                      <tr key={a.id} className={trCls}>
                        <td className={tdCls}>
                          <span className="nums font-mono text-xs text-slate-600">{a.employee.empId}</span>
                        </td>
                        <td className={tdCls}>
                          <Link
                            href={`/hr/employees/${a.employee.id}`}
                            className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
                          >
                            {a.employee.name}
                          </Link>
                        </td>
                        <td className={tdCls}>{a.roleOnProject ?? "—"}</td>
                        <td className={tdCls}>
                          <span className="nums">{a.allocationPct != null ? `${a.allocationPct}%` : "—"}</span>
                        </td>
                        <td className={tdCls}>
                          <span className="nums">{fmtDateOnly(a.startDate) ?? "—"}</span>
                        </td>
                        <td className={tdCls}>
                          <span className="nums">{fmtDateOnly(a.endDate) ?? "—"}</span>
                        </td>
                        {canWrite && (
                          <td className={tdCls}>
                            <RemoveAssignmentButton assignmentId={a.id} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canWrite && <AssignEmployeeForm projectId={project.id} employees={assignableEmployees} />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
