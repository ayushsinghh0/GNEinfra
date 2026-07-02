import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, BD_WRITE } from "@/lib/rbac";
import { enquirySchema } from "@/lib/bd-validation";
import { enquiryData } from "@/lib/bd-mappers";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = enquirySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const enquiry = await prisma.bdEnquiry.create({ data: enquiryData(parsed.data) });
    return NextResponse.json({ ok: true, enquiry });
  } catch {
    return NextResponse.json({ error: "Could not create the enquiry." }, { status: 500 });
  }
}
