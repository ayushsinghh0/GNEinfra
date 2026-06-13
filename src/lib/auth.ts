import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// Phase 1 admin protection: a single shared password (ADMIN_PASSWORD). This is
// intentionally simple — replace with real per-user auth in a later phase.
//
// Hardening:
//  - Fail CLOSED: if ADMIN_PASSWORD is unset, a known placeholder, or too short,
//    no login is possible (rather than silently allowing a default password).
//  - The cookie stores an HMAC-derived token, never the password itself.
//  - All comparisons are constant-time.

export const ADMIN_COOKIE = "gne_admin";

const PLACEHOLDERS = new Set([
  "change-me",
  "CHANGE-ME-strong-admin-password",
  "change-me-to-a-long-random-string",
]);

// The configured password, or null if it is missing / insecure.
export function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || PLACEHOLDERS.has(p) || p.length < 8) return null;
  return p;
}

export function adminConfigured(): boolean {
  return adminPassword() !== null;
}

// Opaque session token derived from the password — changes if the password
// changes (invalidating old cookies), and is not reversible to the password.
export function sessionToken(): string | null {
  const p = adminPassword();
  if (!p) return null;
  return createHmac("sha256", p).update("gne-admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const p = adminPassword();
  if (!p) return false;
  return safeEqual(input, p);
}

export async function isAdminAuthed(): Promise<boolean> {
  const expected = sessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value;
  return !!got && safeEqual(got, expected);
}
