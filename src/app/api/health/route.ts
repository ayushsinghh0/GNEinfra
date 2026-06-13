import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/health — lightweight readiness probe. Returns booleans only (no
// secrets), and a 503 if something essential is misconfigured/down. Use it for
// uptime monitoring and to catch a broken production config early.
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  const admin = adminConfigured();
  const ok = db && admin;

  return NextResponse.json(
    {
      ok,
      db: db ? "up" : "down",
      adminConfigured: admin,
      smtpConfigured: !!process.env.SMTP_HOST,
      storage: process.env.STORAGE_DRIVER || "local",
      cronConfigured: !!process.env.CRON_SECRET,
    },
    { status: ok ? 200 : 503 }
  );
}
