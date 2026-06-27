import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { buildAttendanceWorkbook } from "@/lib/hr-excel";

export const dynamic = "force-dynamic";

// GET /api/hr/attendance/export?year=YYYY&month=M  → downloads attendance sheet as .xlsx
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Math.max(
    2000,
    Math.min(2100, Number(searchParams.get("year")) || now.getUTCFullYear())
  );
  const month = Math.max(
    1,
    Math.min(12, Number(searchParams.get("month")) || now.getUTCMonth() + 1)
  );

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, empId: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { employeeId: true, date: true, status: true },
    }),
  ]);

  const buf = await buildAttendanceWorkbook(employees, records, year, month, daysInMonth);

  const mm = String(month).padStart(2, "0");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${mm}-${year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
