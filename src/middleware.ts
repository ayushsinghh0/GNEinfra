import { NextRequest, NextResponse } from "next/server";

// Lightweight in-memory rate limiter for the sensitive endpoints. Sufficient
// for a single-instance deployment (the VPS/Oracle setup). For a multi-instance
// deployment, swap the Map for a shared store (Redis).
//
// Limits brute-forcing the admin login and spamming the public register/invite
// endpoints (which would otherwise cost email + storage).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// path prefix -> { limit per window, window ms }
const RULES: { prefix: string; limit: number; windowMs: number }[] = [
  { prefix: "/api/admin/login", limit: 10, windowMs: 60_000 },
  { prefix: "/api/register", limit: 20, windowMs: 60_000 },
  { prefix: "/api/reupload", limit: 20, windowMs: 60_000 },
  { prefix: "/api/invites", limit: 30, windowMs: 60_000 },
];

// Reject obviously-oversized upload bodies early (defense-in-depth). The reverse
// proxy enforces the hard cap; Content-Length is omitted for chunked bodies, so
// this is a cheap first gate, not the sole control.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // The reverse proxy (Caddy) APPENDS the real client IP, so the RIGHTMOST
    // entry is trustworthy. The leftmost is client-supplied and spoofable — using
    // it would let an attacker rotate it to defeat the rate limiter entirely.
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/register") || path.startsWith("/api/reupload")) {
    const cl = Number(req.headers.get("content-length") || 0);
    if (cl > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload too large." }, { status: 413 });
    }
  }

  const rule = RULES.find((r) => path.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const now = Date.now();
  const key = `${rule.prefix}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, b);
  }
  b.count++;

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  if (b.count > rule.limit) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/login",
    "/api/register/:path*",
    "/api/reupload/:path*",
    "/api/invites/:path*",
  ],
};
