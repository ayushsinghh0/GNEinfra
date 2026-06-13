import { cookies } from "next/headers";

// Phase 1 admin protection: a single shared password (ADMIN_PASSWORD) stored in
// an httpOnly cookie after login. This is intentionally simple — replace with
// real per-user authentication in a later ERP phase.

export const ADMIN_COOKIE = "gne_admin";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "change-me";
}

export async function isAdminAuthed() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === adminPassword();
}
