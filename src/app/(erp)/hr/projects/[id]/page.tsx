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
  EmptyState,
  thCls,
  theadRowCls,
  tdCls,
  trCls,
} from "@/components/ui";
import { ArrowLeft, Users } from "lucide-react";

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
            action={<Users className="h-4 w-4 text-slate-400" />}
          />
          {project.assignments.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No employees assigned"
              description="No employees have been assigned to this project yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[26%]" />
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>EMP ID</th>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Role</th>
                    <th className={thCls}>Alloc%</th>
                    <th className={thCls}>Start</th>
                    <th className={thCls}>End</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
