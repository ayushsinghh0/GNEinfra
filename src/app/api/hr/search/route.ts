import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/hr/search?q=  → Cmd-K palette entity search.
// Returns a SHAPED payload only — never raw Employee rows (they carry
// salary/bank/PAN/UAN/ESIC).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ employees: [], assets: [], projects: [] });
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [employees, assets, projects] = await Promise.all([
    prisma.employee.findMany({
      where: { OR: [{ name: contains }, { empId: contains }] },
      select: { id: true, empId: true, name: true, designation: true },
      take: 5,
    }),
    prisma.employeeAsset.findMany({
      where: { OR: [{ lpSerialNo: contains }, { makeModel: contains }, { oemName: contains }] },
      select: { id: true, employeeId: true, lpSerialNo: true, makeModel: true },
      take: 5,
    }),
    prisma.project.findMany({
      where: { OR: [{ name: contains }, { code: contains }] },
      select: { id: true, code: true, name: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    employees,
    assets: assets.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      label: [a.lpSerialNo, a.makeModel].filter(Boolean).join(" · "),
    })),
    projects,
  });
}
