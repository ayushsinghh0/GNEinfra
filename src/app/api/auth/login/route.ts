import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, sessionSecret, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { roleHome } from "@/lib/rbac";

// A fixed throwaway hash so we run scrypt even when the email is unknown,
// keeping login timing roughly constant (no user-enumeration oracle).
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "Q2hhbmdlVGhpc0R1bW15SGFzaFZhbHVlVG9Bbnl0aGluZ0xvbmdFbm91Z2hYWFhYWFhYWFg9";

export async function POST(req: NextRequest) {
  if (!sessionSecret()) {
    return NextResponse.json(
      { error: "Login is not configured (set a 16+ char SESSION_SECRET)." },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !ok) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = signSession({ uid: user.id, role: user.role, tv: user.tokenVersion, iat: Date.now() });
  if (!token) return NextResponse.json({ error: "Login is not configured." }, { status: 503 });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const redirect = user.mustChangePassword ? "/account/password" : roleHome(user.role);
  const res = NextResponse.json({ ok: true, redirect, mustChangePassword: user.mustChangePassword });
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
  return res;
}
