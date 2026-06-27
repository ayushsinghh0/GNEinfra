import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { assetSchema } from "@/lib/hr-validation";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = assetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const asset = await prisma.employeeAsset.create({
      data: {
        employeeId: d.employeeId,
        hasLaptop: !!d.hasLaptop, laptopBag: !!d.laptopBag, mouse: !!d.mouse,
        charger: !!d.charger, idCard: !!d.idCard,
        lpSerialNo: d.lpSerialNo || null, makeModel: d.makeModel || null,
        lpCategory: d.lpCategory || null, oemName: d.oemName || null,
      },
    });
    return NextResponse.json({ ok: true, asset });
  } catch {
    return NextResponse.json({ error: "Could not save the asset." }, { status: 500 });
  }
}
