import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { weatherSchema, toDate } from "@/lib/project-schemas";

// POST /api/projects/[id]/weather  (admin only)
// Logs a rain / weather day that impacted the construction schedule.
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
    const parsed = weatherSchema.safeParse(body);
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.weatherLog.create({
      data: {
        projectId: id,
        date,
        intensity: d.intensity,
        fromTime: d.fromTime,
        toTime: d.toTime,
        totalHours: d.totalHours,
        daysImpacted: d.daysImpacted,
        note: d.note,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not log the weather day." },
      { status: 500 }
    );
  }
}
