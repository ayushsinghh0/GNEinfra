import Link from "next/link";
import { FolderKanban, Sun, Gauge, IndianRupee, Plus, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import {
  STAGE_LABELS,
  STAGE_TONE,
  fmtCapacity,
  fmtCr,
  milestonePct,
} from "@/lib/projects";
import {
  PageHeader,
  Card,
  StatCard,
  EmptyState,
  ProgressBar,
  Table,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
  btn,
  cn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  if (!(await isAdminAuthed())) return null;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { select: { status: true } },
      _count: { select: { boqItems: true, activities: true, materials: true } },
    },
  });

  const liveOrHandover = projects.filter(
    (p) => p.stage === "LIVE" || p.stage === "HANDOVER"
  ).length;
  const totalAc = projects.reduce((sum, p) => sum + (p.capacityAcMw ?? 0), 0);
  const totalPo = projects.reduce((sum, p) => sum + (p.poValueCr ?? 0), 0);

  const newProjectLink = (
    <Link href="/admin/projects/new" className={btn("primary")}>
      <Plus className="h-4 w-4" />
      New project
    </Link>
  );

  return (
    <>
      <PageHeader title="Projects" subtitle={`${projects.length} project(s)`}>
        <Link href="/admin/projects/summary" className={btn("secondary")}>
          <TrendingUp className="h-4 w-4" />
          Activity summary
        </Link>
        {newProjectLink}
      </PageHeader>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total projects"
            value={projects.length}
            icon={<FolderKanban className="h-[18px] w-[18px]" />}
            tone="brand"
          />
          <StatCard
            label="Live / Handover"
            value={liveOrHandover}
            icon={<Sun className="h-[18px] w-[18px]" />}
            tone="emerald"
          />
          <StatCard
            label="AC capacity"
            value={`${+totalAc.toFixed(2)} MWac`}
            icon={<Gauge className="h-[18px] w-[18px]" />}
            tone="blue"
          />
          <StatCard
            label="PO value"
            value={fmtCr(+totalPo.toFixed(2))}
            icon={<IndianRupee className="h-[18px] w-[18px]" />}
            tone="amber"
          />
        </div>

        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="No projects yet"
              description="Create your first EPC project to start tracking BOQ, activities and milestones."
              action={newProjectLink}
            />
          ) : (
            <div className="overflow-hidden">
              <Table>
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[24%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>GNE ID</th>
                    <th className={thCls}>Plant</th>
                    <th className={thCls}>Capacity</th>
                    <th className={thCls}>Sub-partner</th>
                    <th className={thCls}>Stage</th>
                    <th className={thCls}>Progress</th>
                    <th className={cn(thCls, "text-right")}>PO value</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const pct = milestonePct(p.milestones);
                    return (
                      <tr key={p.id} className={cn(trCls, "group")}>
                        <td className={tdCls}>
                          <Link
                            href={`/admin/projects/${p.id}`}
                            className="font-mono text-[13px] font-medium text-brand-700 hover:text-brand-800 hover:underline"
                          >
                            {p.gneId}
                          </Link>
                        </td>
                        <td className={tdCls}>
                          <div className="truncate font-medium text-slate-900">
                            {p.plantName || "—"}
                          </div>
                          {p.clientName && (
                            <div className="truncate text-xs text-slate-400">
                              {p.clientName}
                            </div>
                          )}
                        </td>
                        <td className={cn(tdCls, "text-slate-600")}>
                          <span className="truncate">
                            {fmtCapacity(p.capacityAcMw, p.capacityDcMw)}
                          </span>
                        </td>
                        <td className={cn(tdCls, "text-slate-600")}>
                          <div className="truncate">{p.subPartner || "—"}</div>
                        </td>
                        <td className={tdCls}>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                              STAGE_TONE[p.stage] ??
                                "bg-slate-100 text-slate-600 ring-slate-500/20"
                            )}
                          >
                            {STAGE_LABELS[p.stage] ?? p.stage}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <ProgressBar value={pct} className="w-20 shrink-0" />
                            <span className="shrink-0 text-xs tabular-nums text-slate-500">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td
                          className={cn(
                            tdCls,
                            "text-right tabular-nums text-slate-700"
                          )}
                        >
                          {fmtCr(p.poValueCr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
