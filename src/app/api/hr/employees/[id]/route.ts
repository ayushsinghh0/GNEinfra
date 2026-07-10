import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { employeeSchema } from "@/lib/hr-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, include: { assets: true } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = employeeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        empId: d.empId, name: d.name, designation: d.designation, band: d.band || null,
        empCategory: d.empCategory,
        department: d.department || null,
        location: d.location, dateOfJoining: toDate(d.dateOfJoining)!,
        payrollType: d.payrollType || null, mailId: d.mailId || null,
        emergencyNumber: d.emergencyNumber || null, bloodGroup: d.bloodGroup || null,
        dob: toDate(d.dob), offerLetterDate: toDate(d.offerLetterDate),
        leavingDate: toDate(d.leavingDate),
        status: toDate(d.leavingDate) ? "INACTIVE" : "ACTIVE",
        bankAccountNo: d.bankAccountNo || null, bankName: d.bankName || null, ifsc: d.ifsc || null,
        panNo: d.panNo || null, uan: d.uan || null, esicNo: d.esicNo || null,
        // Pay structure (CTC/salary/deductions) is set later on /hr/payroll, not here.
        // Full replace of the family set — delete all then recreate in one
        // atomic update (avoids diffing rows the client can reorder freely).
        familyMembers: {
          deleteMany: {},
          create: (d.familyMembers ?? []).map((m, i) => ({
            name: m.name, relation: m.relation, dob: toDate(m.dob),
            gender: m.gender || null, occupation: m.occupation || null, contact: m.contact || null,
            isDependent: !!m.isDependent, isNominee: !!m.isNominee,
            nomineePct: m.nomineePct ?? null, sortOrder: i,
          })),
        },
      },
    });
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return NextResponse.json({ error: "EMP ID already in use." }, { status: 409 });
      if (e.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  try {
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (e.code === "P2003") return NextResponse.json({ error: "Cannot delete an employee with attendance or payroll history. Set a leaving date to deactivate instead." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
