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
      select: { projectId: true },
    });
    if (!activity || activity.projectId !== id) {
      return NextResponse.json(
        { error: "Activity not found for this project" },
        { status: 404 }
      );
    }

    await prisma.dprEntry.upsert({
      where: { activityId_date: { activityId: d.activityId, date } },
      update: { qtyDone: d.qtyDone, note: d.note },
      create: {
        activityId: d.activityId,
        date,
        qtyDone: d.qtyDone,
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
