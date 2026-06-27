import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, roleHome } from "@/lib/rbac";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const su = await getCurrentUser();
  if (!su) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: su.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
  });

  // Re-issue the cookie with the new tokenVersion so THIS session stays valid
  // while any other sessions are invalidated.
  const token = signSession({ uid: updated.id, role: updated.role, tv: updated.tokenVersion, iat: Date.now() });
  const res = NextResponse.json({ ok: true, redirect: roleHome(updated.role) });
  if (token) {
    const secure =
      process.env.NODE_ENV === "production" ||
      (process.env.APP_BASE_URL || "").startsWith("https://");
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
