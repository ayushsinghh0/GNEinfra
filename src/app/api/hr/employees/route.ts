import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { employeeSchema } from "@/lib/hr-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = employeeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const employee = await prisma.employee.create({
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
        familyMembers: d.familyMembers?.length
          ? {
              create: d.familyMembers.map((m, i) => ({
                name: m.name, relation: m.relation, dob: toDate(m.dob),
                gender: m.gender || null, occupation: m.occupation || null, contact: m.contact || null,
                isDependent: !!m.isDependent, isNominee: !!m.isNominee,
                nomineePct: m.nomineePct ?? null, sortOrder: i,
              })),
            }
          : undefined,
      },
    });
    return NextResponse.json({ ok: true, employee });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An employee with that EMP ID already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the employee." }, { status: 500 });
  }
}
