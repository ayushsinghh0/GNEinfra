import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { candidateSchema } from "@/lib/recruitment-validation";

function toDate(s?: string) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const candidates = await prisma.candidate.findMany({
    orderBy: { createdAt: "desc" },
    include: { position: { select: { id: true, title: true, code: true } } },
  });
  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = candidateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const candidate = await prisma.candidate.create({
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
  } catch {
    return NextResponse.json({ error: "Could not create the candidate." }, { status: 500 });
  }
}
