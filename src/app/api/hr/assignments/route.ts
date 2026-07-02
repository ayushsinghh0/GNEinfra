import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { assignmentSchema } from "@/lib/hr-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = assignmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  // Server-authoritative guardrail: an employee can't be committed over 100%
  // across concurrent (active) project assignments. Null incoming allocation
  // never blocks (it doesn't add to anyone's committed %).
  if (typeof d.allocationPct === "number") {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const agg = await prisma.projectAssignment.aggregate({
      where: {
        employeeId: d.employeeId,
        OR: [{ endDate: null }, { endDate: { gte: todayUTC } }],
      },
      _sum: { allocationPct: true },
    });
    const committed = agg._sum.allocationPct ?? 0;
    if (committed + d.allocationPct > 100) {
      return NextResponse.json(
        {
          error: `Over-allocated: employee is already committed at ${committed}% across active projects; ${d.allocationPct}% more exceeds 100%.`,
        },
        { status: 409 },
      );
    }
  }

  try {
    const assignment = await prisma.projectAssignment.create({
      data: {
        employeeId: d.employeeId, projectId: d.projectId,
        roleOnProject: d.roleOnProject || null, allocationPct: d.allocationPct ?? null,
        startDate: toDate(d.startDate)!, endDate: toDate(d.endDate),
      },
    });
    return NextResponse.json({ ok: true, assignment });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This employee is already assigned to that project." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the assignment." }, { status: 500 });
  }
}
