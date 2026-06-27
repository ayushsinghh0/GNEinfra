import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

// Role sets — the access matrix from the spec, in one place.
export const OVERSIGHT: Role[] = ["MANAGER", "ADMIN", "SUPERADMIN"];
export const ADMIN_AREA: Role[] = ["ADMIN", "SUPERADMIN"];
export const SUPERADMIN_ONLY: Role[] = ["SUPERADMIN"];
export const VENDOR_VIEW: Role[] = ["SCM", "MANAGER", "ADMIN", "SUPERADMIN"];
export const VENDOR_WRITE: Role[] = ["SCM", "ADMIN", "SUPERADMIN"]; // manager is read-only
export const HR_VIEW: Role[] = ["HR", "MANAGER", "ADMIN", "SUPERADMIN"];
export const HR_WRITE: Role[] = ["HR", "ADMIN", "SUPERADMIN"]; // manager read-only

// A line department's own role + the three oversight roles.
export function deptArea(dept: Role): Role[] {
  return [dept, "MANAGER", "ADMIN", "SUPERADMIN"];
}

export function roleHome(role: Role): string {
  switch (role) {
    case "BD":
      return "/bd";
    case "SCM":
      return "/scm";
    case "PROJECT":
      return "/project";
    case "FINANCE":
      return "/finance";
    case "HR":
      return "/hr";
    default:
      return "/overview"; // MANAGER, ADMIN, SUPERADMIN
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const payload = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  // Revocation: deactivation or a tokenVersion bump invalidates the cookie.
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export function hasRole(user: SessionUser | null, roles: Role[]): user is SessionUser {
  return !!user && roles.includes(user.role);
}

// For RSC pages. Redirects (never returns) on failure, so callers get a
// guaranteed non-null user. Each page still calls this itself.
export async function requirePageRole(roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}
