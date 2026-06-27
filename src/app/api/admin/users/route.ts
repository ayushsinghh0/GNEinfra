import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SUPERADMIN_ONLY } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";

const ROLES: Role[] = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "") as Role;
  const tempPassword = String(body?.tempPassword ?? "");
  if (!name || !email.includes("@")) return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (tempPassword.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });

  try {
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash, mustChangePassword: true, createdById: me.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the user." }, { status: 500 });
  }
}
