import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { positionSchema } from "@/lib/recruitment-validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const position = await prisma.jobPosition.findUnique({
    where: { id },
    include: { candidates: { orderBy: { createdAt: "desc" } } },
  });
  if (!position) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ position });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = positionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const position = await prisma.jobPosition.update({
      where: { id },
      data: {
        title: d.title,
        code: d.code || null,
        department: d.department || null,
        band: d.band || null,
        location: d.location || null,
        employmentType: d.employmentType || null,
        openings: d.openings,
        jobDescription: d.jobDescription || null,
        status: d.status,
      },
    });
    return NextResponse.json({ ok: true, position });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return NextResponse.json({ error: "Position code already in use." }, { status: 409 });
      if (e.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  try {
    // Candidates keep their history (onDelete: SetNull) — deleting a position is safe.
    await prisma.jobPosition.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
