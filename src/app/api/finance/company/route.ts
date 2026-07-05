import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { companyProfileSchema, zodErrorMessage } from "@/lib/finance-validation";

// Upserts the CompanyProfile singleton — the "From" block printed on the Tax
// Invoice, NOPA, Approval Note and salary slips (read via getCompany()).
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = companyProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    addressLines: d.addressLines,
    gstin: d.gstin?.toUpperCase() || null,
    pan: d.pan?.toUpperCase() || null,
    cin: d.cin?.toUpperCase() || null,
    email: d.email || null,
    phone: d.phone || null,
    bankName: d.bankName || null,
    accountNo: d.accountNo || null,
    ifsc: d.ifsc?.toUpperCase() || null,
    updatedBy: user.name,
  };
  try {
    const profile = await prisma.companyProfile.upsert({
      where: { id: "company" },
      create: { id: "company", ...data },
      update: data,
    });
    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ error: "Could not save the company details." }, { status: 500 });
  }
}
