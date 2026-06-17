import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { vendorStatusSchema } from "@/lib/validation";

type VendorCodeResult = { id: string; status: string; vendorCode: string | null };

// Highest vendor-code number so far, computed NUMERICALLY (not by string order,
// which would mis-rank GNE-V-9999 above GNE-V-10000). The vendor master is small,
// so scanning the assigned codes is cheap.
async function maxCodeNumber(): Promise<number> {
  const coded = await prisma.vendor.findMany({
    where: { vendorCode: { not: null } },
    select: { vendorCode: true },
  });
  return coded.reduce((max, r) => {
    const n = parseInt((r.vendorCode ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

// Approve a vendor and assign the next sequential GNE vendor code (GNE-V-0001…).
// `updateMany ... where vendorCode: null` makes this idempotent: if the vendor was
// coded by a concurrent request, count is 0 and we return the existing code rather
// than overwriting it (which would orphan a number). The @unique column means two
// DIFFERENT vendors racing for the same number collide on P2002 — caught + retried.
async function approveAndAssignCode(id: string): Promise<VendorCodeResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `GNE-V-${String((await maxCodeNumber()) + 1).padStart(4, "0")}`;
    try {
      const res = await prisma.vendor.updateMany({
        where: { id, vendorCode: null },
        data: { status: "APPROVED", vendorCode: code },
      });
      if (res.count === 0) {
        // Already coded (concurrent approval) — return what's there, no new number.
        const existing = await prisma.vendor.findUnique({
          where: { id },
          select: { id: true, status: true, vendorCode: true },
        });
        if (existing) return existing;
      } else {
        return { id, status: "APPROVED", vendorCode: code };
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not assign a vendor code after several attempts.");
}

// POST /api/vendors/<id>/status  (admin only)
// Body: { status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }
// Approving a vendor without a code assigns one; approving one that already has a
// code keeps the existing code.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = vendorStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid status" },
      { status: 400 }
    );
  }
  const { status } = parsed.data;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, status: true, vendorCode: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  try {
    let updated;
    if (status === "APPROVED" && !vendor.vendorCode) {
      updated = await approveAndAssignCode(id);
    } else {
      updated = await prisma.vendor.update({
        where: { id },
        data: { status },
        select: { id: true, status: true, vendorCode: true },
      });
    }
    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json(
      { error: "Could not update the vendor. Please try again." },
      { status: 500 }
    );
  }
}
