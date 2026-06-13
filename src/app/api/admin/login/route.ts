import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, checkPassword, sessionToken } from "@/lib/auth";

// POST { password } -> sets the admin session cookie on success.
export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set a strong ADMIN_PASSWORD (8+ chars)." },
      { status: 503 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!checkPassword(String(password ?? ""))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = sessionToken();
  if (!token) {
    return NextResponse.json({ error: "Admin login is not configured." }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  // Secure when deployed over HTTPS (production or an https base URL).
  const secure =
    process.env.NODE_ENV === "production" ||
    (process.env.APP_BASE_URL || "").startsWith("https://");
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}

// DELETE -> logout.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
