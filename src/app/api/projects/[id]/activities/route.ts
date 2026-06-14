import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { activitySchema, toDate } from "@/lib/project-schemas";

// POST /api/projects/[id]/activities  (admin only)
// Adds an execution activity to a project.
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
    const parsed = activitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        activity: d.activity,
        subActivity: d.subActivity,
        uom: d.uom,
        totalQty: d.totalQty,
        startDate: toDate(d.startDate),
        endDate: toDate(d.endDate),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not add the activity." },
      { status: 500 }
    );
  }
}
