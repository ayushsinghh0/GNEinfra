# Multi-Role ERP Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single shared-password admin gate with real per-user accounts and 8 roles, and reshape the app into role-scoped department workspaces — with the existing vendor module re-homed under SCM.

**Architecture:** A new `User`/`Role` Prisma model backs stateless signed-cookie sessions (scrypt password hashing, `crypto`-only). A central `src/lib/rbac.ts` replaces `isAdminAuthed()` everywhere; every page/route guards itself. Authenticated UI lives under a `(app)` route group with a role-driven sidebar; the five line departments are siloed, the three oversight roles cross-cut. The live vendor pages move `/admin/*` → `/scm/*`.

**Tech Stack:** Next.js 16 (App Router, async `cookies()`/params), React 19, Prisma 6 + Postgres, Node `crypto` (scrypt + HMAC), Tailwind v4 "Soft Wave" design system, `tsx` (seed + dev checks).

## Global Constraints

- **Next.js 16, App Router.** `cookies()` is async (`await cookies()`); route-handler params are `{ params }: { params: Promise<{ id: string }> }` then `await params`. Read `node_modules/next/dist/docs/` before novel Next usage (AGENTS.md).
- **No test runner exists** (CLAUDE.md). The "test" step in each task = **`npm run build`** (full TypeScript type-check) + **`npm run lint`**, plus targeted `npx tsx -e` runtime checks for pure libs and `curl`/browser checks for routes. Both gates must pass before every commit.
- **Security invariants (do not regress):** every route guards itself (the layout gate is convenience, not the boundary); rate-limit unauthenticated POST endpoints in `src/middleware.ts`; **fail closed** on missing config; constant-time compares; session cookie `httpOnly` + `Secure` in prod (needs HTTPS); CSP/headers in `next.config.mjs` unchanged; `role` is server-assigned only.
- **No new runtime dependencies** beyond `tsx` (devDependency). Hashing uses built-in `crypto.scrypt`.
- **Migrations are additive** — `prisma migrate dev`, never reset (production Neon may hold real vendor data).
- **Design system:** compose `src/components/ui.tsx` + `src/components/chrome.tsx`; light mode only; brand atmosphere only in chrome, never behind data tables; `.nums` on codes/dates; 16px inputs; 44px tap targets; gate motion on `prefers-reduced-motion`.
- **Role values** (Prisma enum, used as string literals): `SUPERADMIN, ADMIN, MANAGER, BD, SCM, PROJECT, FINANCE, HR`.
- **Spec:** `docs/superpowers/specs/2026-06-27-multi-role-erp-foundation-design.md` is the source of truth.

---

## File Structure

**New files**
- `prisma/seed.ts` — seed the first superadmin from env.
- `src/lib/password.ts` — scrypt hash/verify (pure).
- `src/lib/session.ts` — sign/verify the `gne_session` cookie (pure).
- `src/lib/rbac.ts` — `getCurrentUser`, `requirePageRole`, role-set constants, `roleHome` (the one auth authority).
- `src/lib/nav.tsx` — `navForRole(role)` → sidebar sections (client-safe; type-only Role import).
- `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts` — session login/logout.
- `src/app/api/account/password/route.ts` — change own password.
- `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts` — user CRUD (superadmin).
- `src/app/login/page.tsx` + `src/components/LoginForm.tsx` — staff login.
- `src/app/account/password/page.tsx` + `src/components/PasswordChangeForm.tsx` — forced first-login change.
- `src/components/ComingSoon.tsx` — activity-placeholder card grid.
- `src/app/(app)/layout.tsx` — authenticated shell (auth + sidebar).
- `src/app/(app)/overview/page.tsx` — oversight landing.
- `src/app/(app)/bd/page.tsx`, `.../project/page.tsx`, `.../finance/page.tsx`, `.../hr/page.tsx` — department shells.
- `src/app/(app)/admin/users/page.tsx` + `src/components/UserAdmin.tsx` — user management UI.

**Moved (git mv) into the `(app)` group**
- `src/app/admin/page.tsx` → `src/app/(app)/scm/page.tsx`
- `src/app/admin/vendors/page.tsx` → `src/app/(app)/scm/vendors/page.tsx`
- `src/app/admin/vendors/[id]/page.tsx` → `src/app/(app)/scm/vendors/[id]/page.tsx`
- `src/app/admin/invites/page.tsx` → `src/app/(app)/scm/invites/page.tsx`
- `src/app/admin/settings/page.tsx` → `src/app/(app)/admin/settings/page.tsx`

**Modified** — `prisma/schema.prisma`, `package.json`, `src/middleware.ts`, `src/components/Sidebar.tsx`, `src/app/page.tsx`, the 6 vendor/invite API routes, `src/app/api/documents/[id]/route.ts`, `src/app/api/health/route.ts`, `src/app/api/admin/test-email/route.ts`, `src/app/vendors/[id]/print/page.tsx`, `src/app/api/register/route.ts`, `src/components/VendorRow.tsx`, `src/components/VendorSearch.tsx`, env example files, `CLAUDE.md`.

**Deleted (final task)** — `src/lib/auth.ts`, `src/components/AdminLogin.tsx`, `src/app/api/admin/login/route.ts`, `src/app/admin/layout.tsx`.

---

## Task 1: Data model — `User` + `Role` + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma `Role` enum; `User` model with fields `id, name, email (unique), passwordHash, role, isActive, mustChangePassword, tokenVersion, lastLoginAt, createdById, createdAt, updatedAt`; generated `@prisma/client` types.

- [ ] **Step 1: Add the enum + model.** Append to `prisma/schema.prisma` (after the `datasource`/`generator` block, before `Vendor` is fine):

```prisma
enum Role {
  SUPERADMIN
  ADMIN
  MANAGER
  BD
  SCM
  PROJECT
  FINANCE
  HR
}

model User {
  id                 String    @id @default(cuid())
  name               String
  email              String    @unique
  passwordHash       String
  role               Role
  isActive           Boolean   @default(true)
  mustChangePassword Boolean   @default(true)
  tokenVersion       Int       @default(0)
  lastLoginAt        DateTime?
  createdById        String?
  createdBy          User?     @relation("UserCreatedBy", fields: [createdById], references: [id])
  createdUsers       User[]    @relation("UserCreatedBy")
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([role])
  @@index([isActive])
}
```

- [ ] **Step 2: Ensure a working dev DB, then create the migration.** The local `gne_erp` DB may be schema-drifted (CLAUDE.md). If `migrate dev` errors with "type already exists" / drift, create a fresh DB and point `DATABASE_URL` at it:

```bash
docker compose up -d                       # Postgres on 5433
# If the existing DB is drifted, use a fresh one:
#   create DB gne_dev, then set DATABASE_URL=...:5433/gne_dev in .env
npx prisma migrate dev --name add_user_and_roles
```

Expected: a new folder `prisma/migrations/<ts>_add_user_and_roles/` with `CREATE TYPE "Role"` + `CREATE TABLE "User"`, applied, and the client regenerated.

- [ ] **Step 3: Verify.**

```bash
npx prisma validate          # Expected: "The schema ... is valid"
npx prisma generate          # Expected: "Generated Prisma Client"
npm run build                # Expected: compiles (no consumers yet)
```

- [ ] **Step 4: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): add User model and Role enum"
```

---

## Task 2: Password hashing — `src/lib/password.ts`

**Files:**
- Create: `src/lib/password.ts`
- Modify: `package.json` (add `tsx` devDependency)

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` (returns `scrypt$N$r$p$<saltB64>$<hashB64>`); `verifyPassword(plain: string, stored: string): Promise<boolean>` (constant-time).

- [ ] **Step 1: Add `tsx` (used here and by the seed).**

```bash
npm install --save-dev tsx
```

- [ ] **Step 2: Write `src/lib/password.ts`.**

```ts
import { scrypt as _scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "crypto";
import { promisify } from "util";

// scrypt cost parameters. 128 * N * r bytes of memory (~16 MB here) — under
// Node's 32 MB default maxmem. Parameters are embedded in the stored string so
// they can be raised later without invalidating existing hashes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N0 = Number(parts[1]);
  const r0 = Number(parts[2]);
  const p0 = Number(parts[3]);
  if (!N0 || !r0 || !p0) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const derived = await scrypt(plain.normalize("NFKC"), salt, expected.length, { N: N0, r: r0, p: p0 });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
```

- [ ] **Step 3: Runtime round-trip check (stands in for a unit test).**

```bash
npx tsx -e "import('./src/lib/password.ts').then(async m => { const h = await m.hashPassword('s3cret-pass'); console.log('format', /^scrypt\\$/.test(h)); console.log('ok', await m.verifyPassword('s3cret-pass', h)); console.log('bad', await m.verifyPassword('wrong', h)); })"
```

Expected: `format true`, `ok true`, `bad false`.

- [ ] **Step 4: Verify gates + commit.**

```bash
npm run build && npm run lint
git add src/lib/password.ts package.json package-lock.json
git commit -m "feat(auth): scrypt password hashing"
```

---

## Task 3: Session cookie — `src/lib/session.ts`

**Files:**
- Create: `src/lib/session.ts`

**Interfaces:**
- Consumes: nothing at runtime (type-only `Role` from `@prisma/client`).
- Produces: `SESSION_COOKIE = "gne_session"`; `SESSION_MAX_AGE` (seconds); `sessionSecret(): string | null` (fail-closed); `type SessionPayload = { uid: string; role: Role; tv: number; iat: number }`; `signSession(p): string | null`; `verifySession(token): SessionPayload | null`.

- [ ] **Step 1: Write `src/lib/session.ts`.**

```ts
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
```

- [ ] **Step 2: Runtime check (sign/verify + tamper).**

```bash
SESSION_SECRET=this-is-a-long-enough-secret npx tsx -e "import('./src/lib/session.ts').then(m => { const t = m.signSession({uid:'u1',role:'SCM',tv:0,iat:1}); console.log('valid', !!m.verifySession(t)); console.log('tamper', m.verifySession(t.slice(0,-2)+'xx')); console.log('uid', m.verifySession(t)?.uid); })"
```

Expected: `valid true`, `tamper null`, `uid u1`. (Also confirm fail-closed: rerun **without** `SESSION_SECRET` → `signSession` returns `null`.)

- [ ] **Step 3: Verify gates + commit.**

```bash
npm run build && npm run lint
git add src/lib/session.ts
git commit -m "feat(auth): signed session cookie helpers"
```

---

## Task 4: RBAC authority — `src/lib/rbac.ts`

**Files:**
- Create: `src/lib/rbac.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`); `SESSION_COOKIE`, `verifySession` (`@/lib/session`); `cookies` (`next/headers`); `redirect` (`next/navigation`).
- Produces: `type SessionUser = { id; name; email; role: Role; mustChangePassword: boolean }`; role-set consts `OVERSIGHT, ADMIN_AREA, SUPERADMIN_ONLY, VENDOR_VIEW, VENDOR_WRITE`; `deptArea(dept: Role): Role[]`; `roleHome(role: Role): string`; `getCurrentUser(): Promise<SessionUser | null>`; `hasRole(user, roles): boolean`; `requirePageRole(roles: Role[]): Promise<SessionUser>`.

- [ ] **Step 1: Write `src/lib/rbac.ts`.**

```ts
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
```

- [ ] **Step 2: Verify + commit.**

```bash
npm run build && npm run lint
git add src/lib/rbac.ts
git commit -m "feat(auth): central RBAC (getCurrentUser, requirePageRole, role sets)"
```

---

## Task 5: Seed the first superadmin — `prisma/seed.ts`

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config + `db:seed` script)

**Interfaces:**
- Consumes: `hashPassword` (`../src/lib/password` — relative, no `@/` alias so `tsx` resolves it).
- Produces: an idempotent superadmin row from `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD`.

- [ ] **Step 1: Write `prisma/seed.ts`.**

```ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!email || password.length < 8) {
    throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (8+ chars) before seeding.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Superadmin already exists: ${existing.email} (${existing.id})`);
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: "Super Admin", email, passwordHash, role: "SUPERADMIN", mustChangePassword: true },
  });
  console.log(`Seeded superadmin: ${user.email} (${user.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Wire the seed in `package.json`.** Add a `db:seed` script and a top-level `prisma` key:

```jsonc
// in "scripts":
"db:seed": "prisma db seed",
// new top-level key (sibling of "scripts"/"dependencies"):
"prisma": { "seed": "tsx prisma/seed.ts" }
```

- [ ] **Step 3: Run + verify idempotency** (DB from Task 1 must be migrated):

```bash
SUPERADMIN_EMAIL=admin@gne.test SUPERADMIN_PASSWORD=changeme123 npm run db:seed
# Expected: "Seeded superadmin: admin@gne.test (<id>)"
SUPERADMIN_EMAIL=admin@gne.test SUPERADMIN_PASSWORD=changeme123 npm run db:seed
# Expected: "Superadmin already exists: ..."
```

- [ ] **Step 4: Verify gates + commit.**

```bash
npm run build && npm run lint
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat(auth): seed first superadmin from env"
```

---

## Task 6: Login / logout API + rate-limit — auth endpoints

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyPassword`, `signSession`/`sessionSecret`/`SESSION_COOKIE`/`SESSION_MAX_AGE`, `roleHome`.
- Produces: `POST /api/auth/login` → `{ ok, redirect, mustChangePassword }` + sets `gne_session`; `POST /api/auth/logout` → clears it.

- [ ] **Step 1: Write `src/app/api/auth/login/route.ts`.**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, sessionSecret, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { roleHome } from "@/lib/rbac";

// A fixed throwaway hash so we run scrypt even when the email is unknown,
// keeping login timing roughly constant (no user-enumeration oracle).
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "Q2hhbmdlVGhpc0R1bW15SGFzaFZhbHVlVG9Bbnl0aGluZ0xvbmdFbm91Z2hYWFhYWFhYWFg9";

export async function POST(req: NextRequest) {
  if (!sessionSecret()) {
    return NextResponse.json(
      { error: "Login is not configured (set a 16+ char SESSION_SECRET)." },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !ok) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = signSession({ uid: user.id, role: user.role, tv: user.tokenVersion, iat: Date.now() });
  if (!token) return NextResponse.json({ error: "Login is not configured." }, { status: 503 });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const redirect = user.mustChangePassword ? "/account/password" : roleHome(user.role);
  const res = NextResponse.json({ ok: true, redirect, mustChangePassword: user.mustChangePassword });
  const secure =
    process.env.NODE_ENV === "production" ||
    (process.env.APP_BASE_URL || "").startsWith("https://");
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
```

- [ ] **Step 2: Write `src/app/api/auth/logout/route.ts`.**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

- [ ] **Step 3: Update `src/middleware.ts`** — rate-limit the new login, drop the old. In the `RULES` array change `{ prefix: "/api/admin/login", ... }` to:

```ts
  { prefix: "/api/auth/login", limit: 10, windowMs: 60_000 },
```

In `config.matcher`, replace `"/api/admin/login"` with `"/api/auth/login"`.

- [ ] **Step 4: Functional check** (dev server running, superadmin seeded):

```bash
npm run build && npm run lint
# wrong password -> 401:
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@gne.test","password":"nope"}'   # 401
# correct -> 200 + JSON redirect "/account/password" (mustChangePassword):
curl -s -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@gne.test","password":"changeme123"}'   # {"ok":true,"redirect":"/account/password",...}
```

- [ ] **Step 5: Commit.**

```bash
git add src/app/api/auth src/middleware.ts
git commit -m "feat(auth): session login/logout endpoints + rate limit"
```

---

## Task 7: Login page, forced password change, public landing

**Files:**
- Create: `src/app/login/page.tsx`, `src/components/LoginForm.tsx`
- Create: `src/app/account/password/page.tsx`, `src/components/PasswordChangeForm.tsx`, `src/app/api/account/password/route.ts`
- Modify: `src/app/page.tsx` (logo + CTA → `/login`)

**Interfaces:**
- Consumes: `getCurrentUser`, `roleHome`, `/api/auth/login`, `/api/account/password`.
- Produces: working sign-in + forced first-login change; root landing points to `/login`.

- [ ] **Step 1: `src/app/api/account/password/route.ts`** (change own password, re-issue session):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, roleHome } from "@/lib/rbac";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const su = await getCurrentUser();
  if (!su) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: su.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
  });

  // Re-issue the cookie with the new tokenVersion so THIS session stays valid
  // while any other sessions are invalidated.
  const token = signSession({ uid: updated.id, role: updated.role, tv: updated.tokenVersion, iat: Date.now() });
  const res = NextResponse.json({ ok: true, redirect: roleHome(updated.role) });
  if (token) {
    const secure =
      process.env.NODE_ENV === "production" ||
      (process.env.APP_BASE_URL || "").startsWith("https://");
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
```

- [ ] **Step 2: `src/components/LoginForm.tsx`** (client). Mirrors the look of the old `AdminLogin` brand split, but adds an email field, uses the real logo, and posts to `/api/auth/login`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Eyebrow } from "@/components/ui";
import { SunGlow, Atmosphere, Wave, Blob } from "@/components/chrome";
import { LockKeyhole, AlertCircle, Mail, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Login failed");
      router.push(d.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 pt-12 pb-16 text-white lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <SunGlow className="-top-16 -right-10 h-56 w-56" animate />
        <Blob className="-bottom-12 -left-12 h-72 w-72" color="rgba(16,185,129,0.22)" />
        <Atmosphere dots grain />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-12 place-items-center rounded-2xl bg-white px-3 shadow-sm ring-1 ring-white/40">
            <Image src="/brand/gne-infra.png" alt="GNE Infra" width={108} height={32} className="h-7 w-auto" priority />
          </span>
          <div>
            <div className="font-semibold leading-tight">GNE ERP</div>
            <div className="text-xs text-white/70">Staff Console</div>
          </div>
        </div>
        <div className="relative z-10 mt-8 lg:mt-0">
          <Eyebrow className="text-white">Solar EPC · ERP</Eyebrow>
          <h2 className="font-display mt-3 max-w-sm text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-4xl">
            One workspace for every department.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/90">
            Sign in to your department workspace — BD, SCM, Project, Finance, or HR.
          </p>
        </div>
        <Wave className="absolute inset-x-0 bottom-[-1px] lg:hidden" />
      </div>

      <div className="flex items-center justify-center px-6 py-12 lg:py-0">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <Eyebrow className="text-brand-700">Secure access</Eyebrow>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.02em] text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in with your work email.</p>

          {error && (
            <div role="alert" className="animate-fade-up mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Field label="Email" htmlFor="login-email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gne.example" autoComplete="username" autoFocus className="pl-10" />
              </div>
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="login-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className="pl-10 pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="press absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>

          <Button type="submit" size="lg" disabled={loading} className="mt-6 w-full rounded-full">
            {loading ? "Signing in…" : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}
          </Button>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Staff access only · contact your administrator for an account
          </p>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: `src/app/login/page.tsx`** (server wrapper):

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "@/lib/rbac";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/account/password" : roleHome(user.role));
  return <LoginForm />;
}
```

- [ ] **Step 4: `src/components/PasswordChangeForm.tsx`** (client):

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Card, CardBody, CardHeader } from "@/components/ui";
import { AlertCircle, KeyRound } from "lucide-react";

export default function PasswordChangeForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) return setError("New passwords do not match.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not change password");
      router.push(d.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader
        title={<span className="flex items-center gap-2"><KeyRound className="h-[18px] w-[18px] text-brand" /> Set a new password</span>}
        subtitle={forced ? "Choose a new password to finish setting up your account." : "Update your account password."}
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}
          <Field label="Current password" htmlFor="cur"><Input id="cur" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password" htmlFor="new"><Input id="new" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password" htmlFor="cfm"><Input id="cfm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" size="lg" disabled={loading} className="w-full">{loading ? "Saving…" : "Save password"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 5: `src/app/account/password/page.tsx`** (server; logged-in users only, minimal chrome):

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import PasswordChangeForm from "@/components/PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <PasswordChangeForm forced={user.mustChangePassword} />
    </main>
  );
}
```

- [ ] **Step 6: Update root `src/app/page.tsx`.** Replace the gradient "GNE" tile (lines ~23-26) with the logo and point the CTA at `/login`:

Replace the tile block:
```tsx
            <div className="mx-auto -mt-9 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-lg font-extrabold tracking-tight text-white shadow-[var(--shadow-cta)] ring-4 ring-white">
              GNE
            </div>
```
with (add `import Image from "next/image";` at the top of the file):
```tsx
            <div className="mx-auto -mt-9 grid h-16 w-28 place-items-center rounded-2xl bg-white px-4 shadow-[var(--shadow-cta)] ring-4 ring-white">
              <Image src="/brand/gne-infra.png" alt="GNE Infra" width={96} height={28} className="h-7 w-auto" priority />
            </div>
```
Change the heading/copy: `GNE Vendor Portal` → `GNE ERP`, and the paragraph to `Staff sign-in to the GNE ERP. Vendors: use the registration link in your invitation email.` Change the CTA `href="/admin"` → `href="/login"` and its label `Admin Login` → `Staff Login`.

- [ ] **Step 7: Verify + commit.**

```bash
npm run build && npm run lint
git add src/app/login src/app/account src/components/LoginForm.tsx src/components/PasswordChangeForm.tsx src/app/api/account src/app/page.tsx
git commit -m "feat(auth): login page, forced password change, ERP landing"
```

---

## Task 8: App shell — `(app)` layout, role-driven sidebar, department shells, overview

**Files:**
- Create: `src/lib/nav.tsx`, `src/components/ComingSoon.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/overview/page.tsx`, `src/app/(app)/bd/page.tsx`, `src/app/(app)/project/page.tsx`, `src/app/(app)/finance/page.tsx`, `src/app/(app)/hr/page.tsx`
- Modify: `src/components/Sidebar.tsx` (props + role nav + logo + logout endpoint)

**Interfaces:**
- Consumes: `getCurrentUser`/`requirePageRole`/`roleHome`/`deptArea`/`OVERSIGHT` (rbac); `Role` (type).
- Produces: `navForRole(role: Role): NavSection[]`, `deptLabel(role: Role): string` (`@/lib/nav`); `ComingSoon` component; the authenticated shell + four department shells + overview.

- [ ] **Step 1: `src/lib/nav.tsx`** — the role→navigation map (client-safe; type-only `Role`):

```tsx
import type { Role } from "@prisma/client";
import {
  LayoutDashboard, Building2, Mail, Settings, Users, Boxes, Wallet, UserRound,
  Briefcase, ClipboardList, FileText, ReceiptText, Truck, PackageCheck,
  CalendarClock, HardHat, BadgeIndianRupee, type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
export type NavSection = { heading: string; items: NavItem[] };

const BD: NavSection = {
  heading: "Business Development",
  items: [
    { label: "Dashboard", href: "/bd", icon: LayoutDashboard },
    { label: "Lead", icon: Briefcase, soon: true },
    { label: "Quotation", icon: FileText, soon: true },
    { label: "Purchase Order", icon: ReceiptText, soon: true },
    { label: "Order Confirmation", icon: PackageCheck, soon: true },
  ],
};

const SCM: NavSection = {
  heading: "Supply Chain",
  items: [
    { label: "Dashboard", href: "/scm", icon: LayoutDashboard },
    { label: "Vendors", href: "/scm/vendors", icon: Building2 },
    { label: "Invitations", href: "/scm/invites", icon: Mail },
    { label: "Purchase Requisition", icon: ClipboardList, soon: true },
    { label: "RFQ", icon: FileText, soon: true },
    { label: "Purchase Order", icon: ReceiptText, soon: true },
    { label: "GRN", icon: Truck, soon: true },
    { label: "Inventory", icon: Boxes, soon: true },
  ],
};

const PROJECT: NavSection = {
  heading: "Project",
  items: [
    { label: "Dashboard", href: "/project", icon: LayoutDashboard },
    { label: "BOM", icon: ClipboardList, soon: true },
    { label: "Schedule Planning", icon: CalendarClock, soon: true },
    { label: "Deployment", icon: HardHat, soon: true },
    { label: "Execution", icon: HardHat, soon: true },
    { label: "DPR", icon: FileText, soon: true },
    { label: "Approval", icon: PackageCheck, soon: true },
    { label: "MRC", icon: ClipboardList, soon: true },
    { label: "Billing", icon: ReceiptText, soon: true },
  ],
};

const FINANCE: NavSection = {
  heading: "Finance",
  items: [
    { label: "Dashboard", href: "/finance", icon: LayoutDashboard },
    { label: "Invoice Raise", icon: ReceiptText, soon: true },
    { label: "Invoice Approval", icon: PackageCheck, soon: true },
    { label: "Payment", icon: BadgeIndianRupee, soon: true },
    { label: "Reconciliation", icon: Wallet, soon: true },
  ],
};

const HR: NavSection = {
  heading: "Human Resources",
  items: [
    { label: "Dashboard", href: "/hr", icon: LayoutDashboard },
    { label: "Manpower Planning", icon: Users, soon: true },
    { label: "Recruitment", icon: UserRound, soon: true },
    { label: "Attendance", icon: CalendarClock, soon: true },
    { label: "Payroll", icon: BadgeIndianRupee, soon: true },
  ],
};

const DEPT: Record<"BD" | "SCM" | "PROJECT" | "FINANCE" | "HR", NavSection> = {
  BD, SCM, PROJECT, FINANCE, HR,
};

const OVERVIEW: NavSection = {
  heading: "Overview",
  items: [{ label: "All departments", href: "/overview", icon: LayoutDashboard }],
};

export function deptLabel(role: Role): string {
  switch (role) {
    case "BD": return "Business Development";
    case "SCM": return "Supply Chain";
    case "PROJECT": return "Project";
    case "FINANCE": return "Finance";
    case "HR": return "Human Resources";
    case "MANAGER": return "Manager";
    case "ADMIN": return "Administrator";
    case "SUPERADMIN": return "Super Admin";
    default: return "ERP";
  }
}

export function navForRole(role: Role): NavSection[] {
  if (role === "BD" || role === "SCM" || role === "PROJECT" || role === "FINANCE" || role === "HR") {
    return [DEPT[role]];
  }
  // Oversight: overview + every department + administration.
  const admin: NavSection = {
    heading: "Administration",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      ...(role === "SUPERADMIN" ? [{ label: "Users", href: "/admin/users", icon: Users }] : []),
    ],
  };
  return [OVERVIEW, BD, SCM, PROJECT, FINANCE, HR, admin];
}
```

- [ ] **Step 2: `src/components/ComingSoon.tsx`** — placeholder activity grid:

```tsx
import type { LucideIcon } from "lucide-react";

export type ComingSoonItem = { label: string; icon: LucideIcon; desc?: string };

export function ComingSoon({ items }: { items: ComingSoonItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="relative flex items-start gap-3 rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{it.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Soon</span>
              </div>
              {it.desc && <p className="mt-1 text-xs leading-relaxed text-slate-500">{it.desc}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `src/components/Sidebar.tsx`** to take a `user` prop and render `navForRole`. Full replacement:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { LogOut, Menu, X } from "lucide-react";
import { navForRole, deptLabel, type NavSection } from "@/lib/nav";

type SidebarUser = { name: string; email: string; role: Role };

function NavBody({ sections, pathname, onNavigate }: { sections: NavSection[]; pathname: string; onNavigate: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {sections.map((section) => (
        <div key={section.heading} className="mb-5 last:mb-0">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.heading}</div>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              if (!item.href || item.soon) {
                return (
                  <li key={item.label}>
                    <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300" title="Available in a later phase">
                      <Icon className="h-[18px] w-[18px] shrink-0 text-slate-300" />
                      <span>{item.label}</span>
                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Soon</span>
                    </div>
                  </li>
                );
              }
              const active = item.href === "/scm" || item.href === "/bd" || item.href === "/project" || item.href === "/finance" || item.href === "/hr" || item.href === "/overview"
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.label}>
                  <Link href={item.href} onClick={onNavigate} className={`press group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
                    {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />}
                    <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 place-items-center rounded-xl bg-white px-2 ring-1 ring-slate-200">
        <Image src="/brand/gne-infra.png" alt="GNE Infra" width={92} height={26} className="h-6 w-auto" priority />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-slate-900">GNE ERP</div>
        <div className="text-[11px] text-slate-400">{subtitle}</div>
      </div>
    </div>
  );
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sections = navForRole(user.role);
  const subtitle = deptLabel(user.role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const LogoutBtn = (
    <div className="border-t border-slate-200 p-3">
      <button onClick={logout} className="press group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600">
        <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-rose-500" />
        <span>Log out</span>
      </button>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col self-start border-r border-slate-200 bg-white text-slate-600 md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5"><Brand subtitle={subtitle} /></div>
        <NavBody sections={sections} pathname={pathname} onNavigate={() => setOpen(false)} />
        {LogoutBtn}
      </aside>

      <header className="glass fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 px-4 md:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-sidebar" className="press grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <Menu className="h-5 w-5" />
        </button>
        <Image src="/brand/gne-infra.png" alt="GNE Infra" width={84} height={24} className="h-6 w-auto" priority />
      </header>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="mobile-sidebar" role="dialog" aria-modal="true" aria-label="Navigation" inert={!open || undefined} className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white text-slate-600 shadow-xl transition-transform duration-300 ease-out md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Brand subtitle={subtitle} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="press grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <NavBody sections={sections} pathname={pathname} onNavigate={() => setOpen(false)} />
        {LogoutBtn}
      </aside>
    </>
  );
}
```

> Note: the collapsed md icon-rail is dropped (the wide logo doesn't suit a 64px rail); the sidebar is now a single 64-wide (w-64) rail at md+. This is a deliberate simplification — a square brand mark can reintroduce the icon-rail later.

- [ ] **Step 4: `src/app/(app)/layout.tsx`** — the authenticated shell:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  return (
    <div className="flex min-h-dvh w-full bg-canvas">
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <main className="flex min-h-dvh flex-1 flex-col min-w-0 overflow-x-hidden pt-14 md:pt-0">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: The four department shells.** Each calls `requirePageRole(deptArea(<ROLE>))` then renders a hero + `ComingSoon`. Write all four — `src/app/(app)/bd/page.tsx`:

```tsx
import { requirePageRole, deptArea } from "@/lib/rbac";
import { BrandHero } from "@/components/chrome";
import { ComingSoon } from "@/components/ComingSoon";
import { Briefcase, FileText, ReceiptText, PackageCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BdPage() {
  await requirePageRole(deptArea("BD"));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Business Development" title="BD Workspace" subtitle="Leads, quotations and order confirmation." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8">
        <ComingSoon items={[
          { label: "Lead", icon: Briefcase, desc: "Capture and qualify new business leads." },
          { label: "Quotation", icon: FileText, desc: "Prepare and send customer quotations." },
          { label: "Purchase Order", icon: ReceiptText, desc: "Receive and track customer POs." },
          { label: "Order Confirmation", icon: PackageCheck, desc: "Confirm orders and hand off to Project." },
        ]} />
      </div>
    </>
  );
}
```

`src/app/(app)/project/page.tsx` — same shape, `deptArea("PROJECT")`, eyebrow "Project", title "Project Workspace", items: BOM (`ClipboardList`), Schedule Planning (`CalendarClock`), Deployment (`HardHat`), Execution (`HardHat`), DPR (`FileText`), Approval (`PackageCheck`), MRC (`ClipboardList`), Billing (`ReceiptText`).

`src/app/(app)/finance/page.tsx` — `deptArea("FINANCE")`, eyebrow "Finance", items: Invoice Raise (`ReceiptText`), Invoice Approval (`PackageCheck`), Payment (`BadgeIndianRupee`), Reconciliation (`Wallet`).

`src/app/(app)/hr/page.tsx` — `deptArea("HR")`, eyebrow "Human Resources", items: Manpower Planning (`Users`), Recruitment (`UserRound`), Attendance (`CalendarClock`), Payroll (`BadgeIndianRupee`).

(Import each icon from `lucide-react`.)

- [ ] **Step 6: `src/app/(app)/overview/page.tsx`** — oversight landing with live SCM counts + department tiles:

```tsx
import Link from "next/link";
import { requirePageRole, OVERSIGHT } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BrandHero } from "@/components/chrome";
import { StatCard } from "@/components/ui";
import { Building2, Briefcase, HardHat, Wallet, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requirePageRole(OVERSIGHT);
  const [vendors, awaiting] = await Promise.all([
    prisma.vendor.count(),
    prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
  ]);

  const depts: { label: string; href: string; icon: React.ReactNode; tone: "brand" | "amber" | "blue" | "emerald" | "slate"; value: React.ReactNode }[] = [
    { label: "Supply Chain — vendors", href: "/scm", icon: <Building2 className="h-[18px] w-[18px]" />, tone: "brand", value: vendors },
    { label: "SCM — awaiting review", href: "/scm/vendors?status=SUBMITTED", icon: <Building2 className="h-[18px] w-[18px]" />, tone: "amber", value: awaiting },
    { label: "Business Development", href: "/bd", icon: <Briefcase className="h-[18px] w-[18px]" />, tone: "blue", value: "—" },
    { label: "Project", href: "/project", icon: <HardHat className="h-[18px] w-[18px]" />, tone: "emerald", value: "—" },
    { label: "Finance", href: "/finance", icon: <Wallet className="h-[18px] w-[18px]" />, tone: "slate", value: "—" },
    { label: "Human Resources", href: "/hr", icon: <Users className="h-[18px] w-[18px]" />, tone: "slate", value: "—" },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="GNE ERP" title="Overview" subtitle="Every department at a glance." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="grid grid-cols-2 gap-4 p-6 sm:p-8 lg:grid-cols-3">
        {depts.map((d) => (
          <Link key={d.label} href={d.href} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            <StatCard label={d.label} value={d.value} tone={d.tone} icon={d.icon} />
          </Link>
        ))}
      </div>
    </>
  );
}
```

> Note: the `/scm` links 404 until Task 9 re-homes those pages — expected intermediate.

- [ ] **Step 7: Verify + commit.** Confirm the `BrandHero` prop names (`variant`, `size`, `wave`, `eyebrow`, `title`, `subtitle`) match `src/components/chrome.tsx`; adjust if the signature differs.

```bash
npm run build && npm run lint
git add src/lib/nav.tsx src/components/ComingSoon.tsx src/components/Sidebar.tsx "src/app/(app)"
git commit -m "feat(shell): role-driven sidebar, app shell, department workspaces"
```

---

## Task 9: Re-home the vendor module under SCM + swap its guards

**Files:**
- Move: `src/app/admin/page.tsx` → `src/app/(app)/scm/page.tsx`; `src/app/admin/vendors/page.tsx` → `src/app/(app)/scm/vendors/page.tsx`; `src/app/admin/vendors/[id]/page.tsx` → `src/app/(app)/scm/vendors/[id]/page.tsx`; `src/app/admin/invites/page.tsx` → `src/app/(app)/scm/invites/page.tsx`
- Modify: the moved pages (guards + links); `src/app/api/vendors/[id]/route.ts`, `src/app/api/vendors/[id]/status/route.ts`, `src/app/api/vendors/[id]/document-requests/route.ts`, `src/app/api/vendors/[id]/export/route.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/invites/route.ts`; `src/app/vendors/[id]/print/page.tsx`; `src/app/api/register/route.ts`; `src/components/VendorRow.tsx`, `src/components/VendorSearch.tsx`

**Interfaces:**
- Consumes: `requirePageRole`, `getCurrentUser`, `VENDOR_VIEW`, `VENDOR_WRITE` (rbac).

- [ ] **Step 1: Move the four pages.**

```bash
git mv src/app/admin/page.tsx "src/app/(app)/scm/page.tsx"
mkdir -p "src/app/(app)/scm/vendors/[id]"
git mv src/app/admin/vendors/page.tsx "src/app/(app)/scm/vendors/page.tsx"
git mv "src/app/admin/vendors/[id]/page.tsx" "src/app/(app)/scm/vendors/[id]/page.tsx"
git mv src/app/admin/invites/page.tsx "src/app/(app)/scm/invites/page.tsx"
```

- [ ] **Step 2: Swap the page guards.** In each moved page replace the import line `import { isAdminAuthed } from "@/lib/auth";` with `import { requirePageRole, VENDOR_VIEW } from "@/lib/rbac";` and replace the guard line `if (!(await isAdminAuthed())) return null;` with `await requirePageRole(VENDOR_VIEW);`.

- [ ] **Step 3: Update internal links to `/scm`.** In `src/app/(app)/scm/page.tsx` change every `/admin/vendors` → `/scm/vendors` and `/admin/invites` → `/scm/invites` (lines ~110-119, 165, 198). In `src/app/(app)/scm/vendors/[id]/page.tsx` change `/admin/vendors` → `/scm/vendors` (line ~102). In `src/app/(app)/scm/invites/page.tsx` change `/admin/vendors/${inv.vendor.id}` → `/scm/vendors/${inv.vendor.id}` (line ~83).

- [ ] **Step 4: Add a "coming soon" row to the SCM dashboard.** In `src/app/(app)/scm/page.tsx`, add imports `import { ComingSoon } from "@/components/ComingSoon";` and `import { ClipboardList, FileText, ReceiptText, Truck, Boxes } from "lucide-react";`, then render before the closing `</div>` of the content wrapper (after the "Recent vendors" card):

```tsx
        <ComingSoon items={[
          { label: "Purchase Requisition", icon: ClipboardList, desc: "Raise and track material requisitions." },
          { label: "RFQ", icon: FileText, desc: "Request quotations from vendors." },
          { label: "Purchase Order", icon: ReceiptText, desc: "Issue and manage purchase orders." },
          { label: "GRN", icon: Truck, desc: "Goods receipt against POs." },
          { label: "Inventory", icon: Boxes, desc: "Materials receipt, store and issue." },
        ]} />
```

- [ ] **Step 5: Swap the vendor/invite API guards.** In each route replace `import { isAdminAuthed } from "@/lib/auth";` with `import { getCurrentUser, <SET> } from "@/lib/rbac";` and the guard block

```ts
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```
with
```ts
  const user = await getCurrentUser();
  if (!user || !<SET>.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
```
using `<SET>` per file:

| File | `<SET>` |
|---|---|
| `src/app/api/vendors/[id]/route.ts` (PATCH, mutate) | `VENDOR_WRITE` |
| `src/app/api/vendors/[id]/status/route.ts` (mutate) | `VENDOR_WRITE` |
| `src/app/api/vendors/[id]/document-requests/route.ts` (mutate) | `VENDOR_WRITE` |
| `src/app/api/invites/route.ts` (mutate) | `VENDOR_WRITE` |
| `src/app/api/vendors/[id]/export/route.ts` (view) | `VENDOR_VIEW` |
| `src/app/api/documents/[id]/route.ts` (view) | `VENDOR_VIEW` |

- [ ] **Step 6: Print page + its back link.** In `src/app/vendors/[id]/print/page.tsx` replace the import `import { isAdminAuthed } from "@/lib/auth";` with `import { getCurrentUser, VENDOR_VIEW } from "@/lib/rbac";`, replace the guard `if (!(await isAdminAuthed())) notFound();` with:

```ts
  const viewer = await getCurrentUser();
  if (!viewer || !VENDOR_VIEW.includes(viewer.role)) notFound();
```
and change `backHref={`/admin/vendors/${v.id}`}` → `backHref={`/scm/vendors/${v.id}`}`.

- [ ] **Step 7: Email + component links.** In `src/app/api/register/route.ts` change `adminLink: `${base}/admin/vendors/${vendor.id}`` → `${base}/scm/vendors/${vendor.id}`. In `src/components/VendorRow.tsx` change `/admin/vendors/${v.id}` → `/scm/vendors/${v.id}`. In `src/components/VendorSearch.tsx` change both `/admin/vendors` occurrences → `/scm/vendors`.

- [ ] **Step 8: Verify + manual check.** Build, lint, then log in as the superadmin and confirm `/scm`, `/scm/vendors`, `/scm/invites` render and the vendor actions work; confirm a freshly-created MANAGER (Task 10) would see read-only — deferred to Task 10 check.

```bash
npm run build && npm run lint
git add -A
git commit -m "feat(scm): re-home vendor module under /scm with role guards"
```

---

## Task 10: Administration area — settings move, user management, remaining guards

**Files:**
- Move: `src/app/admin/settings/page.tsx` → `src/app/(app)/admin/settings/page.tsx`
- Create: `src/app/(app)/admin/users/page.tsx`, `src/components/UserAdmin.tsx`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/api/health/route.ts`, `src/app/api/admin/test-email/route.ts`
- Delete: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `requirePageRole`, `getCurrentUser`, `ADMIN_AREA`, `SUPERADMIN_ONLY` (rbac); `hashPassword` (password).
- Produces: `GET/POST /api/admin/users`, `PATCH /api/admin/users/[id]`; the Users admin page.

- [ ] **Step 1: Move settings + swap guard.**

```bash
mkdir -p "src/app/(app)/admin/settings"
git mv src/app/admin/settings/page.tsx "src/app/(app)/admin/settings/page.tsx"
```
In the moved file replace `import { isAdminAuthed } from "@/lib/auth";` → `import { requirePageRole, ADMIN_AREA } from "@/lib/rbac";` and `if (!(await isAdminAuthed())) return null;` → `await requirePageRole(ADMIN_AREA);`.

- [ ] **Step 2: `src/app/api/admin/users/route.ts`** (list + create, superadmin):

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SUPERADMIN_ONLY } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";

const ROLES: Role[] = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export async function GET() {
  const me = await getCurrentUser();
  if (!me || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "") as Role;
  const tempPassword = String(body?.tempPassword ?? "");
  if (!name || !email.includes("@")) return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (tempPassword.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });

  try {
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash, mustChangePassword: true, createdById: me.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the user." }, { status: 500 });
  }
}
```

- [ ] **Step 3: `src/app/api/admin/users/[id]/route.ts`** (PATCH role / active / reset password, superadmin):

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, SUPERADMIN_ONLY } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";

const ROLES: Role[] = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || !SUPERADMIN_ONLY.includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: me ? 403 : 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Prisma.UserUpdateInput = {};
  if (typeof body?.isActive === "boolean") {
    if (id === me.id && body.isActive === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    data.isActive = body.isActive;
    data.tokenVersion = { increment: 1 }; // force re-auth on deactivate/reactivate
  }
  if (typeof body?.role === "string") {
    if (!ROLES.includes(body.role as Role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (id === me.id && body.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "You cannot remove your own superadmin role." }, { status: 400 });
    }
    data.role = body.role as Role;
    data.tokenVersion = { increment: 1 };
  }
  if (typeof body?.tempPassword === "string") {
    if (body.tempPassword.length < 8) return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(body.tempPassword);
    data.mustChangePassword = true;
    data.tokenVersion = { increment: 1 };
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update the user." }, { status: 500 });
  }
}
```

- [ ] **Step 4: `src/components/UserAdmin.tsx`** (client — create form + table + row actions):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Card, CardHeader, CardBody, Table, thCls, tdCls, theadRowCls, trCls, Chip } from "@/components/ui";
import { AlertCircle, UserPlus } from "lucide-react";

type Row = { id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null };
const ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export default function UserAdmin({ initialUsers, meId }: { initialUsers: Row[]; meId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("BD");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, tempPassword }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not create user");
      setName(""); setEmail(""); setTempPassword(""); setRole("BD");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Update failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><UserPlus className="h-[18px] w-[18px] text-brand" /> Add a user</span>} subtitle="Create an account with a temporary password the user changes on first login." />
        <CardBody>
          {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" htmlFor="u-name"><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email" htmlFor="u-email"><Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Role" htmlFor="u-role"><Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
            <Field label="Temp password" htmlFor="u-pass"><Input id="u-pass" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={busy} className="w-full">Create</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Users" />
        <CardBody className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <thead><tr className={theadRowCls}><th className={thCls}>Name</th><th className={thCls}>Email</th><th className={thCls}>Role</th><th className={thCls}>Status</th><th className={thCls}>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={trCls}>
                    <td className={tdCls}>{u.name}</td>
                    <td className={tdCls}><span className="text-slate-600">{u.email}</span></td>
                    <td className={tdCls}>
                      <Select value={u.role} disabled={busy || u.id === meId} onChange={(e) => patch(u.id, { role: e.target.value })} className="h-8 py-0 text-xs">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </td>
                    <td className={tdCls}>{u.isActive ? <Chip className="bg-emerald-50 text-emerald-600">Active</Chip> : <Chip className="bg-slate-100 text-slate-400">Disabled</Chip>}</td>
                    <td className={tdCls}>
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={() => { const p = prompt("New temporary password (8+ chars):"); if (p) patch(u.id, { tempPassword: p }); }} className="press text-xs font-medium text-brand-700 hover:text-brand disabled:opacity-50">Reset password</button>
                        {u.id !== meId && <button disabled={busy} onClick={() => patch(u.id, { isActive: !u.isActive })} className="press text-xs font-medium text-slate-500 hover:text-rose-600 disabled:opacity-50">{u.isActive ? "Disable" : "Enable"}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/(app)/admin/users/page.tsx`** (server; superadmin):

```tsx
import { requirePageRole, SUPERADMIN_ONLY } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BrandHero } from "@/components/chrome";
import UserAdmin from "@/components/UserAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePageRole(SUPERADMIN_ONLY);
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true },
  });
  const initialUsers = rows.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null }));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Administration" title="Users" subtitle="Manage staff accounts and roles." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8"><UserAdmin initialUsers={initialUsers} meId={me.id} /></div>
    </>
  );
}
```

- [ ] **Step 6: Swap the remaining admin-area guards.** `src/app/api/admin/test-email/route.ts`: replace `import { isAdminAuthed } from "@/lib/auth";` → `import { getCurrentUser, ADMIN_AREA } from "@/lib/rbac";` and the guard block to the `getCurrentUser` + `ADMIN_AREA` pattern (status `user ? 403 : 401`). `src/app/api/health/route.ts`: replace `import { adminConfigured, isAdminAuthed } from "@/lib/auth";` → `import { getCurrentUser, ADMIN_AREA } from "@/lib/rbac";`; replace `if (!(await isAdminAuthed())) {` gate that returns the public `{ ok }` with:

```ts
  const viewer = await getCurrentUser();
  if (!viewer || !ADMIN_AREA.includes(viewer.role)) {
    return NextResponse.json({ ok: true });
  }
```
and remove any `adminConfigured()` usage in the full-config payload (drop that field, or report `sessionConfigured: !!process.env.SESSION_SECRET`).

- [ ] **Step 7: Delete the obsolete admin layout** (all `/admin/*` pages now live in the `(app)` group):

```bash
git rm src/app/admin/layout.tsx
```

- [ ] **Step 8: Verify + manual role checks.**

```bash
npm run build && npm run lint
```
Manual: as superadmin create one MANAGER and one SCM user; confirm MANAGER can open `/scm/vendors` (read) but a `PATCH /api/vendors/<id>/status` returns 403; SCM user can mutate; BD user visiting `/scm` is redirected to `/bd`.

- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "feat(admin): user management, settings move, admin-area guards"
```

---

## Task 11: Retire legacy auth + env/docs + final sweep

**Files:**
- Delete: `src/lib/auth.ts`, `src/components/AdminLogin.tsx`, `src/app/api/admin/login/route.ts`
- Modify: `.env.example`, `.env.production.example`, `deploy/.env.server.example`, `CLAUDE.md`

**Interfaces:** none produced; this finalizes the cutover.

- [ ] **Step 1: Confirm no remaining references**, then delete the legacy files:

```bash
grep -rn "isAdminAuthed\|ADMIN_COOKIE\|adminConfigured\|/api/admin/login\|AdminLogin" src   # expect: no matches
git rm src/lib/auth.ts src/components/AdminLogin.tsx src/app/api/admin/login/route.ts
```
If any match remains, fix that call site first (it should already be swapped by Tasks 9-10).

- [ ] **Step 2: Update `.env.example`.** Replace the `ADMIN_PASSWORD` block (lines ~78-81) with:

```bash
# ── Auth / sessions ───────────────────────────────────────────────────────
# Signs the staff session cookie. REQUIRED: 16+ random chars or login is
# disabled (fails closed). Generate one with:  openssl rand -base64 32
SESSION_SECRET=""

# The first superadmin, created by `npm run db:seed` (idempotent). 8+ char
# password; the account must change it on first login.
SUPERADMIN_EMAIL="admin@gne.example"
SUPERADMIN_PASSWORD=""
```
Apply the same change to `.env.production.example` and `deploy/.env.server.example` (remove `ADMIN_PASSWORD`, add the three vars). Keep all other vars.

- [ ] **Step 3: Update `CLAUDE.md`** Auth section to describe the new model in one paragraph: per-user accounts + `Role`; `src/lib/rbac.ts` (`getCurrentUser`/`requirePageRole`) is the authority; `src/lib/session.ts` signs the `gne_session` cookie with `SESSION_SECRET` (fails closed); first superadmin via `prisma db seed`; the `Secure`-cookie/HTTPS gotcha still applies. Note `/admin/*` vendor pages moved to `/scm/*`.

- [ ] **Step 4: Full verification.**

```bash
npm run build && npm run lint
```
Manual end-to-end: visit `/` → Staff Login → `/login`; sign in as seeded superadmin → forced to `/account/password` → set new password → land on `/overview`; create users for each role; sign in as each and confirm they land in (and are confined to) their own workspace; vendor flows under `/scm` work; the emailed `adminLink` points to `/scm/vendors/<id>`.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "chore(auth): retire shared-password admin auth; update env + docs"
```

---

## Self-Review (completed during planning)

**Spec coverage** — every spec section maps to a task: §4 data model → T1; §5 auth/sessions/bootstrap → T2,T3,T5,T6,T7; §3/§6 RBAC + matrix (incl. manager read-only on vendor master) → T4 (`VENDOR_VIEW`/`VENDOR_WRITE`), enforced in T9; §7 routing/re-home → T7 (root,login), T8 (shell,departments,overview), T9 (SCM), T10 (admin/users/settings); §8 role-driven sidebar → T8; §9 workspace contents → T8 (`ComingSoon`, shells, overview) + T9 (SCM dashboard + soon row) + T10 (users); §10 branding → T7 (login,root) + T8 (sidebar); §11 security (rate-limit, fail-closed, self-guarding, read/write split) → T6, T4, T9, T10; §12 env → T11; §14 migration/rollout → T1,T5,T11.

**Placeholder scan** — no "TBD/TODO"; the only "coming soon" text is intentional product UI. The four department shells in T8 Step 5 give BD in full and specify each other shell's exact icons/labels/role (repeat the BD shape) — not "similar to".

**Type consistency** — `SessionUser`, `SessionPayload`, role-set constant names (`VENDOR_VIEW`, `VENDOR_WRITE`, `OVERSIGHT`, `ADMIN_AREA`, `SUPERADMIN_ONLY`), `roleHome`, `deptArea`, `navForRole`, `deptLabel`, `SESSION_COOKIE`, `SESSION_MAX_AGE`, and the `hashPassword`/`verifyPassword`/`signSession`/`verifySession` signatures are defined once (T2-T4) and consumed with the same names/types throughout (T6-T11).

**Known intermediate states** (acceptable, each task still builds): overview's `/scm` links 404 until T9; `/admin/settings` keeps the old shared-password layout only until its move in T10 (its guard swaps in the same task). Legacy `auth.ts` survives until T11 after all 15 `isAdminAuthed` call sites are swapped.
