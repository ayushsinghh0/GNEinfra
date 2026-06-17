import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { activityPct, valueDone, isCompleted } from "@/lib/projects";
import {
  PageHeader,
  Card,
  EmptyState,
  Table,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
  btn,
  cn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function rowKey(activity: string, subActivity?: string | null) {
  return `${activity}||${subActivity || ""}`;
}

function pctCls(pct: number) {
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  if (pct > 0) return "text-slate-600";
  return "text-slate-300";
}

export default async function ProjectsSummaryPage() {
  if (!(await isAdminAuthed())) return null;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      activities: {
        include: { entries: { select: { qtyDone: true, kind: true } } },
      },
    },
  });

  // Collect unique row keys preserving first-seen order.
  const rows: { key: string; activity: string; subActivity: string }[] = [];
  const seen = new Set<string>();
  // Per-project map of row-key -> pct.
  const pctByProject: Record<string, Map<string, number>> = {};

  for (const p of projects) {
    const map = new Map<string, number>();
    for (const a of p.activities) {
      const key = rowKey(a.activity, a.subActivity);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          key,
          activity: a.activity,
          subActivity: a.subActivity || "",
        });
      }
      const done = valueDone(a.entries);
      const pct = isCompleted(a.entries) ? 100 : activityPct(done, a.totalQty);
      map.set(key, pct);
    }
    pctByProject[p.id] = map;
  }

  const backLink = (
    <Link href="/admin/projects" className={btn("secondary", "sm")}>
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Activity summary"
        subtitle="% completion across projects"
      >
        {backLink}
      </PageHeader>

      <div className="p-8 space-y-6">
        {projects.length === 0 ? (
          <Card className="overflow-hidden">
            <EmptyState
              icon={<TrendingUp className="h-6 w-6" />}
              title="No projects yet"
              description="Create projects and log DPR entries to see cross-project activity completion here."
              action={backLink}
            />
          </Card>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {projects.length} project(s) · {rows.length} activit
              {rows.length === 1 ? "y" : "ies"}
            </p>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>Activity</th>
                      <th className={thCls}>Sub-Activity</th>
                      {projects.map((p) => (
                        <th
                          key={p.id}
                          className={cn(thCls, "text-right whitespace-nowrap")}
                        >
                          {p.plantName || p.gneId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className={trCls}>
                        <td
                          className={cn(
                            tdCls,
                            "font-medium text-slate-900 whitespace-nowrap"
                          )}
                        >
                          {r.activity}
                        </td>
                        <td className={cn(tdCls, "text-slate-600 whitespace-nowrap")}>
                          {r.subActivity || "—"}
                        </td>
                        {projects.map((p) => {
                          const pct = pctByProject[p.id]?.get(r.key);
                          if (pct == null) {
                            return (
                              <td
                                key={p.id}
                                className={cn(
                                  tdCls,
                                  "text-right tabular-nums text-slate-300"
                                )}
                              >
                                —
                              </td>
                            );
                          }
                          return (
                            <td
                              key={p.id}
                              className={cn(
                                tdCls,
                                "text-right tabular-nums font-medium",
                                pctCls(pct)
                              )}
                            >
                              {pct > 0 ? `${pct}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
