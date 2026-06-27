import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "gne_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours, in seconds

const SECRET_MIN = 16;

// Fail closed: no/short SESSION_SECRET ⇒ no valid sessions can be issued or read.
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < SECRET_MIN) return null;
  return s;
}

export type SessionPayload = { uid: string; role: Role; tv: number; iat: number };

export function signSession(payload: SessionPayload): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!p || typeof p.uid !== "string" || typeof p.tv !== "number") return null;
    return p;
  } catch {
    return null;
  }
}
