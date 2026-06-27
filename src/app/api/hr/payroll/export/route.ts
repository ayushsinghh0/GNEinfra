import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";
import { buildPayrollWorkbook } from "@/lib/hr-excel";

export const dynamic = "force-dynamic";

// GET /api/hr/payroll/export?year=YYYY&month=M  → downloads payroll sheet as .xlsx
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

  const records = await prisma.payrollRecord.findMany({
    where: { periodYear: year, periodMonth: month },
    include: {
      employee: { select: { empId: true, name: true } },
    },
    orderBy: { employee: { name: "asc" } },
  });

  const buf = await buildPayrollWorkbook(records, year, month);

  const mm = String(month).padStart(2, "0");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payroll-${mm}-${year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
