import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { dprEntrySchema, toDate } from "@/lib/project-schemas";

// POST /api/projects/[id]/dpr  (admin only)
// Records one day's progress against an activity (upsert by activity+date).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => null);
    const parsed = dprEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const date = toDate(d.date);
    if (!date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    // The activity must belong to this project.
    const activity = await prisma.projectActivity.findUnique({
      where: { id: d.activityId },
      select: { projectId: true, totalQty: true, uom: true },
    });
    if (!activity || activity.projectId !== id) {
      return NextResponse.json(
        { error: "Activity not found for this project" },
        { status: 404 }
      );
    }

    // Cap cumulative progress at the planned total. Only VALUE entries are
    // additive (COM/NONE are non-additive markers), so the cap check runs only
    // for VALUE writes and the existing sum counts only VALUE entries. The
    // upsert REPLACES any existing entry on this date, so exclude that date from
    // the existing sum (otherwise editing an existing day would double-count it).
    if (d.kind === "VALUE") {
      const agg = await prisma.dprEntry.aggregate({
        where: { activityId: d.activityId, date: { not: date }, kind: "VALUE" },
        _sum: { qtyDone: true },
      });
      const others = agg._sum.qtyDone ?? 0;
      const projected = others + d.qtyDone;

      const planned = activity.totalQty;
      if (planned != null && planned > 0 && projected > planned + 1e-6) {
        const remaining = Math.max(0, planned - others);
        const uom = activity.uom ? ` ${activity.uom}` : "";
        const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString("en-IN");
        return NextResponse.json(
          {
            error:
              remaining <= 1e-6
                ? `This activity is already at its planned total of ${fmt(planned)}${uom}. No more can be logged.`
                : `Logging ${fmt(d.qtyDone)}${uom} would bring the total to ${fmt(projected)}${uom}, above the planned ${fmt(planned)}${uom}. You can log at most ${fmt(remaining)}${uom} more for this date.`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.dprEntry.upsert({
      where: { activityId_date: { activityId: d.activityId, date } },
      update: { qtyDone: d.qtyDone, kind: d.kind, note: d.note },
      create: {
        activityId: d.activityId,
        date,
        qtyDone: d.qtyDone,
        kind: d.kind,
        note: d.note,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not save the DPR entry." },
      { status: 500 }
    );
  }
}
