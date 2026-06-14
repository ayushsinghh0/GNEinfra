import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { activityPct } from "@/lib/projects";
import { fmtDateOnly } from "@/lib/format";
import RecordForm from "@/components/RecordForm";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  ProgressBar,
  EmptyState,
  Table,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
  btn,
  cn,
} from "@/components/ui";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtNum(n?: number | null) {
  return n == null ? "—" : n.toLocaleString("en-IN");
}

function Kpi({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

export default async function ActivityDetail({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  if (!(await isAdminAuthed())) return null;

  const { id, activityId } = await params;

  const activity = await prisma.projectActivity.findUnique({
    where: { id: activityId },
    include: {
      entries: { orderBy: { date: "asc" } },
      project: { select: { id: true, gneId: true, plantName: true } },
    },
  });
  if (!activity || activity.projectId !== id) notFound();

  const done = activity.entries.reduce((s, e) => s + e.qtyDone, 0);
  const pct = activityPct(done, activity.totalQty);

  // Running cumulative total over the entries (already ordered by date asc).
  const rows = activity.entries.reduce<
    { entry: (typeof activity.entries)[number]; cumulative: number }[]
  >((acc, e) => {
    const cumulative = (acc[acc.length - 1]?.cumulative ?? 0) + e.qtyDone;
    acc.push({ entry: e, cumulative });
    return acc;
  }, []);

  return (
    <>
      <PageHeader title="Activity" subtitle={activity.project.gneId}>
        <Link
          href={`/admin/projects/${id}?tab=progress`}
          className={btn("secondary", "sm")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Activity summary + KPIs */}
        <Card>
          <CardHeader
            title={activity.activity}
            subtitle={activity.subActivity ?? undefined}
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Total qty">
                {fmtNum(activity.totalQty)}
                {activity.uom && (
                  <span className="ml-1 text-slate-400">{activity.uom}</span>
                )}
              </Kpi>
              <Kpi label="Done">
                {fmtNum(done)}
                {activity.uom && (
                  <span className="ml-1 text-slate-400">{activity.uom}</span>
                )}
              </Kpi>
              <Kpi label="% complete">
                <div className="flex items-center gap-2">
                  <ProgressBar
                    value={pct}
                    tone={pct >= 100 ? "emerald" : "brand"}
                    className="w-24"
                  />
                  <span className="tabular-nums font-semibold text-slate-700">
                    {pct}%
                  </span>
                </div>
              </Kpi>
              <Kpi label="UOM">{activity.uom || "—"}</Kpi>
              <Kpi label="Start / End">
                {fmtDateOnly(activity.startDate) || "—"}
                <span className="mx-1 text-slate-300">→</span>
                {fmtDateOnly(activity.endDate) || "—"}
              </Kpi>
            </div>
          </CardBody>
        </Card>

        {/* Daily progress log */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Daily progress log"
            subtitle={`${activity.entries.length} entr${
              activity.entries.length === 1 ? "y" : "ies"
            }`}
            action={
              <RecordForm
                title="Log day"
                triggerLabel="Log day"
                triggerIcon={<Plus className="h-4 w-4" />}
                endpoint={`/api/projects/${id}/dpr`}
                hidden={{ activityId }}
                fields={[
                  { name: "date", label: "Date", type: "date", required: true },
                  {
                    name: "qtyDone",
                    label: "Quantity done",
                    type: "number",
                    required: true,
                  },
                  { name: "note", label: "Note" },
                ]}
              />
            }
          />
          {rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No progress logged yet"
              description="Log a day's progress to start tracking this activity."
            />
          ) : (
            <Table>
              <thead>
                <tr className={theadRowCls}>
                  <th className={thCls}>Date</th>
                  <th className={cn(thCls, "text-right")}>Quantity</th>
                  <th className={cn(thCls, "text-right")}>Cumulative</th>
                  <th className={thCls}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, cumulative }) => (
                  <tr key={entry.id} className={trCls}>
                    <td className={cn(tdCls, "font-medium text-slate-900")}>
                      {fmtDateOnly(entry.date)}
                    </td>
                    <td className={cn(tdCls, "text-right tabular-nums")}>
                      {fmtNum(entry.qtyDone)}
                    </td>
                    <td className={cn(tdCls, "text-right tabular-nums text-slate-500")}>
                      {fmtNum(cumulative)}
                    </td>
                    <td className={tdCls}>
                      <div className="truncate" title={entry.note ?? ""}>
                        {entry.note || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
