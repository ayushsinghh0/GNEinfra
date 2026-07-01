import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { payrollSchema, computePayrollTotals } from "@/lib/hr-validation";

const batchSchema = z.object({
  rows: z.array(payrollSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = batchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const rows = parsed.data.rows;
  try {
    const results = await prisma.$transaction(
      rows.map((d) => {
        const t = computePayrollTotals(d);
        const data = {
          code: d.code || null, role: d.role || null, designation: d.designation || null,
          ctc: d.ctc ?? null,
          basic: d.basic, hra: d.hra, cca: d.cca, personalPay: d.personalPay,
          conveyance: d.conveyance, lta: d.lta, specialAllowance: d.specialAllowance,
          pla: d.pla, medicalReimb: d.medicalReimb,
          tds: d.tds, loanAdv: d.loanAdv, epf: d.epf, esi: d.esi,
          totalEarnings: t.totalEarnings, totalDeductions: t.totalDeductions, payableAmount: t.payableAmount,
          remarks: d.remarks || null,
          extraLines: d.extraLines ?? [],
        };
        return prisma.payrollRecord.upsert({
          where: { employeeId_periodYear_periodMonth: { employeeId: d.employeeId, periodYear: d.year, periodMonth: d.month } },
          create: { employeeId: d.employeeId, periodYear: d.year, periodMonth: d.month, ...data },
          update: data,
        });
      })
    );
    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({ employeeId: r.employeeId, id: r.id })),
    });
  } catch {
    return NextResponse.json({ error: "Could not save the payslips." }, { status: 500 });
  }
}
