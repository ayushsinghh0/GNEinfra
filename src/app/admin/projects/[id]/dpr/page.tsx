import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { PageHeader, btn } from "@/components/ui";
import DprGrid from "@/components/DprGrid";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const WINDOW = 21;

// Serialize a stored DateTime to a plain YYYY-MM-DD string in UTC. The API
// parses "YYYY-MM-DD" as UTC midnight, so emitting UTC components keeps every
// cell key round-tripping to the exact same string the server understands.
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DprGridPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) return null;

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      gneId: true,
      plantName: true,
      activities: {
        orderBy: [
          { activitySerial: "asc" },
          { sortOrder: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          activity: true,
          subActivity: true,
          uom: true,
          totalQty: true,
          startDate: true,
          endDate: true,
          activitySerial: true,
          sortOrder: true,
          remarks: true,
          entries: {
            select: { date: true, qtyDone: true, kind: true },
          },
        },
      },
    },
  });
  if (!project) notFound();

  // Serialize everything to plain values — NO Date objects cross into the
  // client component.
  const activities = project.activities.map((a) => ({
    id: a.id,
    activity: a.activity,
    subActivity: a.subActivity,
    uom: a.uom,
    totalQty: a.totalQty,
    startDate: a.startDate ? ymd(a.startDate) : null,
    endDate: a.endDate ? ymd(a.endDate) : null,
    activitySerial: a.activitySerial,
    sortOrder: a.sortOrder,
    remarks: a.remarks,
    entries: a.entries.map((e) => ({
      date: ymd(e.date),
      qtyDone: e.qtyDone,
      kind: e.kind as "VALUE" | "COM" | "NONE",
    })),
  }));

  // Default window: the last WINDOW days ending today (computed server-side so
  // the initial render is stable; the grid lets you navigate from here).
  const end = new Date();
  const dates: string[] = [];
  for (let i = WINDOW - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i)
    );
    dates.push(ymd(d));
  }

  return (
    <>
      <PageHeader title="DPR daily grid" subtitle={project.gneId}>
        <Link
          href={`/admin/projects/${project.id}?tab=progress`}
          className={btn("secondary", "sm")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
      </PageHeader>

      <div className="space-y-5 p-6 lg:p-8">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {project.plantName || "Daily Progress Report"}
          </h2>
          <p className="text-sm text-slate-500">
            Enter each day&apos;s quantity per activity. Mark a day{" "}
            <span className="font-semibold text-emerald-600">Com</span> when an
            activity is complete; clear a cell to remove that day. Cumulative and
            % update live and are read-only.
          </p>
        </div>

        <DprGrid projectId={project.id} activities={activities} dates={dates} />
      </div>
    </>
  );
}
