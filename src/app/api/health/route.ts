import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, ADMIN_AREA } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/health — readiness probe. Anonymous callers (uptime monitors) get the
// status boolean ONLY; deploy-config detail (SMTP/storage/cron) is disclosed to
// authenticated admins only, so the endpoint can't be used to fingerprint the
// deployment.
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  const ok = db;

  const viewer = await getCurrentUser();
  if (!viewer || !ADMIN_AREA.includes(viewer.role)) {
    return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
  }

  return NextResponse.json(
    {
      ok,
      db: db ? "up" : "down",
      sessionConfigured: !!process.env.SESSION_SECRET,
      smtpConfigured: !!process.env.SMTP_HOST,
      storage: process.env.STORAGE_DRIVER || "local",
      cronConfigured: !!process.env.CRON_SECRET,
    },
    { status: ok ? 200 : 503 }
  );
}
