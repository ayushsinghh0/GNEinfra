import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { attendanceBulkSchema } from "@/lib/hr-validation";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = attendanceBulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { year, month, entries } = parsed.data;
  try {
    await prisma.$transaction(
      entries.map((e) => {
        const date = new Date(Date.UTC(year, month - 1, e.day));
        return prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: e.employeeId, date } },
          create: { employeeId: e.employeeId, date, status: e.status, enteredById: user.id },
          update: { status: e.status, enteredById: user.id },
        });
      })
    );
    return NextResponse.json({ ok: true, count: entries.length });
  } catch {
    return NextResponse.json({ error: "Could not save attendance." }, { status: 500 });
  }
}
