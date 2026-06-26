import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { vendorEditSchema } from "@/lib/validation";

// PATCH /api/vendors/<id>  (admin only)
// Corrects a vendor's own detail fields (company / statutory / bank). Validation
// is identical to registration via vendorEditSchema; `updatedAt` bumps itself.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = vendorEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // dateOfIncorporation arrives as an ISO date string (or undefined). Mirror the
  // register route: store a valid Date, otherwise null.
  const doi = d.dateOfIncorporation ? new Date(d.dateOfIncorporation) : null;

  try {
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        companyName: d.companyName,
        contactPerson: d.contactPerson,
        mobileNumber: d.mobileNumber,
        email: d.email,
        address: d.address ?? null,
        state: d.state ?? null,
        country: d.country ?? null,
        pinCode: d.pinCode ?? null,
        website: d.website ?? null,
        dateOfIncorporation: doi && !isNaN(doi.getTime()) ? doi : null,
        yearsOfService: d.yearsOfService ?? null,
        annualTurnover: d.annualTurnover ?? null,
        gstNo: d.gstNo ?? null,
        panNo: d.panNo ?? null,
        // Legacy pre-GST tax fields (excise/TIN/VAT/CST/service-tax) were removed from
        // the edit form. Omit them from the update so any retained DB values are
        // preserved rather than silently nulled by an absent form field.
        msmeNo: d.msmeNo ?? null,
        bankName: d.bankName ?? null,
        bankBranchAddress: d.bankBranchAddress ?? null,
        bankAccountNo: d.bankAccountNo ?? null,
        bankBranchCode: d.bankBranchCode ?? null,
        ifscCode: d.ifscCode ?? null,
        swiftCode: d.swiftCode ?? null,
        ibanCode: d.ibanCode ?? null,
      },
    });
    return NextResponse.json({ ok: true, vendor });
  } catch (e) {
    // P2025 = record to update not found.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not save the changes. Please try again." },
      { status: 500 }
    );
  }
}
