import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { clientSchema } from "@/lib/bd-validation";
import { clientData } from "@/lib/bd-mappers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_VIEW.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const clients = await prisma.bdClient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, industry: true, serviceType: true, plantType: true },
  });
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !BD_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = clientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const client = await prisma.bdClient.create({ data: clientData(parsed.data) });
    return NextResponse.json({ ok: true, client });
  } catch {
    return NextResponse.json({ error: "Could not create the client." }, { status: 500 });
  }
}
