import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredDocuments } from "@/lib/purge";

// POST or GET /api/cron/purge
// Deletes vendor documents whose 7-day post-download window has elapsed.
// Trigger this on a schedule (EventBridge Scheduler, cron-job.org, GitHub
// Actions cron, etc.). Protected by a shared secret so it can't be abused:
//   Authorization: Bearer <CRON_SECRET>   or   ?secret=<CRON_SECRET>
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  const fromHeader = auth?.replace(/^Bearer\s+/i, "");
  const fromQuery = req.nextUrl.searchParams.get("secret");
  if (fromHeader !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredDocuments();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
