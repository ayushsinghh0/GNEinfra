import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import {
  milestoneCreateSchema,
  milestonePatchSchema,
  toDate,
} from "@/lib/project-schemas";

// POST /api/projects/[id]/milestones  (admin only)
// Creates a milestone, appended at the end of the current sort order.
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
    const parsed = milestoneCreateSchema.safeParse(body);
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

    const last = await prisma.milestone.findFirst({
      where: { projectId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    await prisma.milestone.create({
      data: {
        projectId: id,
        name: d.name,
        category: d.category,
        plannedDate: toDate(d.plannedDate),
        sortOrder,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not create the milestone." },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/milestones  (admin only)
// Updates a milestone's status / dates. Marking DONE without an explicit
// actualDate stamps the current time.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => null);
    const parsed = milestonePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // The milestone must belong to this project.
    const milestone = await prisma.milestone.findUnique({
      where: { id: d.milestoneId },
      select: { projectId: true },
    });
    if (!milestone || milestone.projectId !== id) {
      return NextResponse.json(
        { error: "Milestone not found for this project" },
        { status: 404 }
      );
    }

    let actualDate = toDate(d.actualDate);
    if (d.status === "DONE" && !actualDate) {
      actualDate = new Date();
    }

    await prisma.milestone.update({
      where: { id: d.milestoneId },
      data: {
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.plannedDate !== undefined
          ? { plannedDate: toDate(d.plannedDate) }
          : {}),
        ...(actualDate ? { actualDate } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not update the milestone." },
      { status: 500 }
    );
  }
}
