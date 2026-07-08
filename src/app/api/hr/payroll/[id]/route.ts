import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { payrollSchema } from "@/lib/hr-validation";

// Updates ONLY an employee's pay / bank / statutory / deductions — the payroll
// page's write path, separate from the employee master so neither can clobber
// the other. HR_WRITE; managers are read-only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = payrollSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        totalCtc: d.totalCtc ?? null,
        salary: d.salary ?? null,
        lta: d.lta ?? null,
        specialAllowance: d.specialAllowance ?? null,
        conveyance: d.conveyance ?? null,
        bankAccountNo: d.bankAccountNo || null,
        bankName: d.bankName || null,
        ifsc: d.ifsc || null,
        uan: d.uan || null,
        panNo: d.panNo || null,
        esicNo: d.esicNo || null,
        pfDeduction: d.pfDeduction ?? null,
        esiDeduction: d.esiDeduction ?? null,
        tdsDeduction: d.tdsDeduction ?? null,
        otherDeduction: d.otherDeduction ?? null,
      },
    });
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not save the payroll details." }, { status: 500 });
  }
}
