import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { positionSchema } from "@/lib/recruitment-validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const positions = await prisma.jobPosition.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  });
  return NextResponse.json({ positions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = positionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const position = await prisma.jobPosition.create({
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A position with that code already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the position." }, { status: 500 });
  }
}
