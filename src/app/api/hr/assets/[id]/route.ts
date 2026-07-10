import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { assetSchema } from "@/lib/hr-validation";

const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

const assetPatchSchema = assetSchema.extend({ returnedAt: optDate });

function toDate(s?: string) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const parsed = assetPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const asset = await prisma.employeeAsset.update({
      where: { id },
      data: {
        employeeId: d.employeeId,
        hasLaptop: !!d.hasLaptop, laptopBag: !!d.laptopBag, mouse: !!d.mouse,
        charger: !!d.charger, idCard: !!d.idCard,
        assetType: d.assetType || null, lpSerialNo: d.lpSerialNo || null,
        makeModel: d.makeModel || null, lpCategory: d.lpCategory || null,
        oemName: d.oemName || null, assetTag: d.assetTag || null,
        condition: d.condition || null,
        purchaseValue: d.purchaseValue ?? null,
        purchaseDate: toDate(d.purchaseDate),
        allocatedAt: toDate(d.allocatedAt) ?? undefined,
        remarks: d.remarks || null,
        returnedAt: toDate(d.returnedAt),
      },
    });
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
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
    await prisma.employeeAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
