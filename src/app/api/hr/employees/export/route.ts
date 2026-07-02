import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { buildEmployeesWorkbook } from "@/lib/hr-excel";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["ACTIVE", "INACTIVE"]);

// GET /api/hr/employees/export?q=&status=&category=&location=
// Downloads employees as .xlsx, filtered identically to /hr/employees —
// mirrors the `where` built in employees/page.tsx so an export always
// matches what the user is currently looking at (an unfiltered export
// after filtering to e.g. "Active" was both a does-what-I-see violation
// and an unintended PII leak of inactive employees' bank/PAN data).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const status = sp.get("status");
  const category = sp.get("category");
  const location = sp.get("location");

  const where: Prisma.EmployeeWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.EmployeeWhereInput["status"];
  }
  if (category && category.trim()) {
    where.empCategory = category.trim();
  }
  if (location && location.trim()) {
    where.location = location.trim();
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { empId: { contains: term, mode: "insensitive" } },
      { designation: { contains: term, mode: "insensitive" } },
      { mailId: { contains: term, mode: "insensitive" } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
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
