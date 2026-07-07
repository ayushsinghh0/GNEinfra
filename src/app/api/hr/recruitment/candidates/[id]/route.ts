import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { candidateSchema, stageSchema } from "@/lib/recruitment-validation";

function toDate(s?: string) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { position: { select: { id: true, title: true, code: true } } },
  });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ candidate });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);

  try {
    // A stage-only body (no `name`) is the inline stage-move control; otherwise a full edit.
    if (body && typeof body === "object" && !("name" in body)) {
      const parsed = stageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid stage" }, { status: 400 });
      }
      const candidate = await prisma.candidate.update({ where: { id }, data: { stage: parsed.data.stage } });
      return NextResponse.json({ ok: true, candidate });
    }

    const parsed = candidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;
    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        positionId: d.positionId || null,
        source: d.source || null,
        stage: d.stage,
        cvReceived: !!d.cvReceived,
        cvLink: d.cvLink || null,
        experienceYears: d.experienceYears ?? null,
        noticePeriod: d.noticePeriod || null,
        appliedOn: toDate(d.appliedOn),
        notes: d.notes || null,
      },
    });
    return NextResponse.json({ ok: true, candidate });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    await prisma.candidate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
