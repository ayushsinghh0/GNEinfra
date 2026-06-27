import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SUPERADMIN_ONLY } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";

const ROLES: Role[] = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Prisma.UserUpdateInput = {};
  if (typeof body?.isActive === "boolean") {
    if (id === me.id && body.isActive === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    data.isActive = body.isActive;
    data.tokenVersion = { increment: 1 }; // force re-auth on deactivate/reactivate
  }
  if (typeof body?.role === "string") {
    if (!ROLES.includes(body.role as Role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (id === me.id && body.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "You cannot remove your own superadmin role." }, { status: 400 });
    }
    data.role = body.role as Role;
    data.tokenVersion = { increment: 1 };
  }
  if (typeof body?.tempPassword === "string") {
    if (body.tempPassword.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(body.tempPassword);
    data.mustChangePassword = true;
    data.tokenVersion = { increment: 1 };
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update the user." }, { status: 500 });
  }
}
