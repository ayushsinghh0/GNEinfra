import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, HR_WRITE } from "@/lib/rbac";
import { policySchema } from "@/lib/hr-validation";

function toDate(s?: string) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !HR_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = policySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const policy = await prisma.companyPolicy.create({
      data: {
        title: d.title,
        category: d.category || null,
        content: d.content,
        effectiveFrom: toDate(d.effectiveFrom),
        isActive: d.isActive ?? true,
      },
    });
    return NextResponse.json({ ok: true, policy });
  } catch {
    return NextResponse.json({ error: "Could not save the policy." }, { status: 500 });
  }
}
