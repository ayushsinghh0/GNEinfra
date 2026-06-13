import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { purgeExpiredDocuments } from "@/lib/purge";

// POST /api/cron/purge
// Deletes vendor documents whose post-download window has elapsed. Trigger on a
// schedule (host cron, EventBridge, cron-job.org, etc.). Protected by a shared
// secret in the Authorization header:  Authorization: Bearer <CRON_SECRET>
function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!constantTimeMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredDocuments();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: "Purge failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export const POST = handle;
