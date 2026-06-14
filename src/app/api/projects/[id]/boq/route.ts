import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { boqSchema } from "@/lib/project-schemas";

// POST /api/projects/[id]/boq  (admin only)
// Adds a BOQ / scope line item to a project.
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
    const parsed = boqSchema.safeParse(body);
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

    await prisma.boqItem.create({
      data: {
        projectId: id,
        category: d.category,
        section: d.section,
        serialNo: d.serialNo,
        description: d.description,
        rating: d.rating,
        specification: d.specification,
        uom: d.uom,
        quantity: d.quantity,
        responsibility: d.responsibility,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not add the BOQ item." },
      { status: 500 }
    );
  }
}
