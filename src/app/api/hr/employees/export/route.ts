import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { buildEmployeesWorkbook } from "@/lib/hr-excel";

export const dynamic = "force-dynamic";

// GET /api/hr/employees/export  → downloads all employees as .xlsx
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const employees = await prisma.employee.findMany({
    orderBy: { empId: "asc" },
  });

  const buf = await buildEmployeesWorkbook(employees);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employees.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
