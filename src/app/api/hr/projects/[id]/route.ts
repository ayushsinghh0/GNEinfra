import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { projectSchema } from "@/lib/hr-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = projectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: d.name, code: d.code, client: d.client || null, status: d.status,
        startDate: toDate(d.startDate), endDate: toDate(d.endDate),
      },
    });
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return NextResponse.json({ error: "A project with that code already exists." }, { status: 409 });
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
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
