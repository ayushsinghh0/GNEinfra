import Link from "next/link";
import { Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader,
  Card,
  EmptyState,
  Chip,
  thCls,
  theadRowCls,
  tdCls,
  trCls,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function statusChipCls(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default async function ProjectsPage() {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { assignments: true } } },
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

      <div className="p-8">
        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="No projects yet"
              description="Add your first project to get started."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>Code</th>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Client</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Assigned</th>
                    <th className={thCls}>Start</th>
                    <th className={thCls}>End</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className={trCls}>
                      <td className={tdCls}>
                        <span className="nums font-mono text-xs text-slate-600">{p.code}</span>
                      </td>
                      <td className={tdCls}>
                        <Link
                          href={`/hr/projects/${p.id}`}
                          className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className={tdCls}>{p.client ?? "—"}</td>
                      <td className={tdCls}>
                        <Chip className={statusChipCls(p.status)}>
                          {p.status.replace(/_/g, " ")}
                        </Chip>
                      </td>
                      <td className={tdCls}>
                        <span className="nums">{p._count.assignments}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="nums">{fmtDateOnly(p.startDate) ?? "—"}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="nums">{fmtDateOnly(p.endDate) ?? "—"}</span>
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
