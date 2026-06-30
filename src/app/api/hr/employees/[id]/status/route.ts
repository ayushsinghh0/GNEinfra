import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { employeeStatusSchema } from "@/lib/hr-validation";

function toDate(s?: string | null) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = employeeStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data:
        d.action === "leave"
          ? { status: "INACTIVE", leavingDate: toDate(d.leavingDate) ?? todayUTC }
          : { status: "ACTIVE", leavingDate: null },
    });
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update status." }, { status: 500 });
  }
}
