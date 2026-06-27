# Multi-Role ERP — Foundation (RBAC + Department Workspaces)

**Date:** 2026-06-27
**Branch:** `multi-role-erp` (cut from `vendor-only` @ `97f74d1`)
**Status:** Design — approved verbally, pending written-spec review
**Source of requirements:** GNE Infra "Department, Teams & Activity Flow" chart + product owner

---

## 1. Goal

Turn the single-purpose vendor-registration app into the **identity + role foundation** of a
full GNE ERP: real per-user logins, 8 roles, and a role-scoped app shell where each role lands in
its **own workspace**. The five line departments are siloed; the three oversight roles
(manager / admin / superadmin) are the connected layer that sees across departments.

This phase ships the **skeleton that every later department vertical hangs off**. It does **not**
build the department activities themselves (those are separate, later specs — see §13).

### The 8 roles (from the chart + owner)

| Role | Kind | Scope |
|---|---|---|
| `BD` | Line dept | Business Development — Lead, Quotation, PO, Order Confirmation |
| `SCM` | Line dept | Supply Chain — PR, RFQ, PO, GRN, Inventory **+ the existing vendor master** |
| `PROJECT` | Line dept | Design/Eng, Planning, Deployment, Execution, DPR, Approval, MRC, Billing |
| `FINANCE` | Line dept | Invoice raise/approval, Payment, Reconciliation |
| `HR` | Line dept | Manpower Planning, Recruitment, Attendance, Payroll |
| `MANAGER` | Oversight | Cross-department visibility + sign-offs; mostly read |
| `ADMIN` | Oversight | Read/write across all departments + approvals; **no** user/system mgmt |
| `SUPERADMIN` | Oversight | Everything, incl. managing users/roles and system settings |

The 5 line roles map 1:1 to the 5 departments. We do **not** add a separate `Department` table
yet (YAGNI) — `role` encodes the department for line users. We add a `Department` entity only when
a record must be owned by a department independently of who is viewing it (a later vertical's
concern).

---

## 2. Current state (what we're building on)

- **Auth:** a single shared `ADMIN_PASSWORD`, HMAC-of-password stored in the `gne_admin` cookie
  (`src/lib/auth.ts`). No `User` / `Role` concept anywhere. One gate in `src/app/admin/layout.tsx`.
- **Routing:** `/admin/*` (dashboard, vendors, vendors/[id], invites, settings) behind that gate;
  public token flows `/register/[token]`, `/reupload/[token]`; root `/` is a public landing whose
  only CTA is "Admin Login → /admin".
- **The `/admin` dashboard is already 100% vendor/SCM content** (vendor counts, registrations
  chart, invite form, recent vendors) — so it becomes SCM's home almost verbatim.
- **Data model:** entirely `Vendor`-centric (`prisma/schema.prisma`).
- **UI:** "Soft Wave" design system; `Sidebar.tsx` has a hardcoded nav + a "Coming soon" stub list
  (Procurement, Inventory, Finance, HR) — the multi-module direction is already foreshadowed.
- **Security baseline (preserve):** every route guards itself; rate-limiting in `middleware.ts`;
  magic-byte upload sniffing; fail-closed auth config; locked CSP in `next.config.mjs`.

---

## 3. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Scope | What to build this phase | **Foundation only** — auth, roles, 8 workspaces, vendor master under SCM |
| Login | How users authenticate | **Per-user accounts**; an admin/superadmin creates each account with a temp password the user must change on first login |
| Oversight | manager vs admin vs superadmin | **Tiered:** manager (read + sign-off, cross-dept) ▸ admin (read/write all depts, no user/system mgmt) ▸ superadmin (everything incl. user/role mgmt) |
| Siloing | Line-role visibility | Line roles see **only their own** department; only the 3 oversight roles cross boundaries |
| ① Hashing | Password storage | **Node `crypto.scrypt`** + per-user salt (no new dependency) |
| ② Bootstrap | First superadmin | **Idempotent `prisma db seed`** from `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` env (fails closed) |
| ③ Vendor home | Where vendor module lives | **Entirely under SCM** — re-homed to `/scm/*` |
| Branding | App logo | Real **gne infra** logo (`public/brand/gne-infra.png`) replaces the text "GNE" block app-wide |

---

## 4. Data model (additive Prisma changes)

No existing model is altered; we only add. Migration is a normal additive
`prisma migrate dev` (no reset — production Neon may hold real vendor data).

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
  id                 String   @id @default(cuid())
  name               String
  email              String   @unique
  passwordHash       String   // scrypt: "scrypt$N$r$p$<saltB64>$<hashB64>"
  role               Role
  isActive           Boolean  @default(true)
  mustChangePassword Boolean  @default(true)  // temp password set by admin
  tokenVersion       Int      @default(0)     // bump to revoke all sessions
  lastLoginAt        DateTime?
  createdById        String?                  // who created this account
  createdBy          User?    @relation("UserCreatedBy", fields: [createdById], references: [id])
  createdUsers       User[]   @relation("UserCreatedBy")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([role])
  @@index([isActive])
}
```

**Password hash format** (`src/lib/password.ts`): `scrypt$<N>$<r>$<p>$<saltB64>$<derivedB64>`,
verified in constant time via `crypto.timingSafeEqual`. Parameters embedded so they can evolve.

---

## 5. Auth & sessions

New modules; the old shared-password admin auth is retired.

- **`src/lib/password.ts`** — `hashPassword(plain)` / `verifyPassword(plain, stored)` (scrypt).
- **`src/lib/session.ts`** — stateless **signed** cookie `gne_session`:
  - Payload `{ uid, role, tv, iat }` → `base64url(payload) + "." + HMAC_SHA256(payload, SESSION_SECRET)`.
  - `httpOnly`, `Secure` (prod), `SameSite=Lax`, ~12h expiry.
  - `SESSION_SECRET` **fails closed** if unset/short — mirrors today's `ADMIN_PASSWORD` discipline.
- **`src/lib/rbac.ts`** — the one authority every page/route calls:
  - `getCurrentUser()` → verifies the cookie signature, loads the `User`, checks `isActive` and
    `tokenVersion === tv` (so deactivation / forced-logout takes effect immediately). Returns the
    user or `null`. One DB read per guarded request (fine for ERP traffic; consistent with the
    app's existing per-request RSC queries).
  - `requireUser()` → `getCurrentUser()` or `redirect("/login")` (RSC) / `401` (API).
  - `requireRole(roles[])` → `requireUser()` then 403/redirect if `role ∉ roles`.
  - `roleHome(role)` → landing path after login (§7).
  - `canSeeDepartment(role, dept)` / capability helpers driven by the matrix in §6.

**Login flow**

1. `/login` (public) → POST `/api/auth/login` `{ email, password }`.
2. Verify user exists, `isActive`, password matches → set `gne_session` cookie, stamp `lastLoginAt`.
3. If `mustChangePassword` → redirect `/account/password` (forced change; nav suppressed until done).
4. Else redirect to `roleHome(role)`.
5. Logout → DELETE `/api/auth/logout` clears the cookie.

`/api/auth/login` is added to the `middleware.ts` rate-limit rules (same 10/min as today's
`/api/admin/login`, which is removed).

**Bootstrap (decision ②):** `prisma/seed.ts` upserts one `SUPERADMIN` from `SUPERADMIN_EMAIL` +
`SUPERADMIN_PASSWORD` (`mustChangePassword = true`). Idempotent; run on deploy. The legacy
`ADMIN_PASSWORD` env is retired.

---

## 6. Access-control matrix

Each cell = can a role enter / act. Line roles: own department only. This drives both route guards
(§7) and the role-built sidebar (§8).

| Capability \ Role | BD | SCM | PROJECT | FINANCE | HR | MANAGER | ADMIN | SUPERADMIN |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| BD workspace | RW | — | — | — | — | R | RW | RW |
| SCM workspace (incl. vendor master) | — | RW | — | — | — | R | RW | RW |
| PROJECT workspace | — | — | RW | — | — | R | RW | RW |
| FINANCE workspace | — | — | — | RW | — | R | RW | RW |
| HR workspace | — | — | — | — | RW | R | RW | RW |
| Cross-dept overview (`/overview`) | — | — | — | — | — | ✓ | ✓ | ✓ |
| Settings (`/admin/settings`) | — | — | — | — | — | — | ✓ | ✓ |
| User management (`/admin/users`) | — | — | — | — | — | — | — | ✓ |

> "R" (manager) = read + sign-off only; the actual sign-off *actions* are per-vertical and arrive
> in later phases. This phase wires the **access** (manager can open any department read-only); the
> approve buttons themselves come with each vertical.
>
> **Read vs write on the vendor master (the one live module).** Because SCM's vendor master already
> has mutating actions, manager's read-only must be enforced *there* now, not deferred:
> - **View** (pages, `GET /api/vendors/*`, document download, workbook export): `SCM, MANAGER, ADMIN, SUPERADMIN`.
> - **Mutate** (vendor status change, create invite, create document-request): `SCM, ADMIN, SUPERADMIN` — **manager excluded**.
> The UI hides mutate controls for manager; the endpoints enforce it regardless (defense in depth).

---

## 7. Routing & re-home map

**Pages**

| Current | New | Guard |
|---|---|---|
| `/` (public landing, CTA → `/admin`) | `/` (public landing, CTA → `/login`) | public |
| — | `/login` | public |
| — | `/account/password` (forced first-login change) | any logged-in user |
| `/admin` (vendor dashboard) | `/scm` (SCM home — same content) | SCM + oversight |
| `/admin/vendors` | `/scm/vendors` | SCM + oversight |
| `/admin/vendors/[id]` | `/scm/vendors/[id]` | SCM + oversight |
| `/admin/invites` | `/scm/invites` | SCM + oversight |
| `/vendors/[id]/print` | `/vendors/[id]/print` (unchanged path) | SCM + oversight |
| `/admin/settings` | `/admin/settings` (unchanged) | ADMIN + SUPERADMIN |
| — | `/admin/users` (+ create/edit) | SUPERADMIN |
| — | `/overview` (cross-dept landing) | oversight |
| — | `/bd`, `/project`, `/finance`, `/hr` (shells) | own role + oversight |

`roleHome`: `BD→/bd`, `SCM→/scm`, `PROJECT→/project`, `FINANCE→/finance`, `HR→/hr`,
`MANAGER/ADMIN/SUPERADMIN→/overview`.

**API routes**

| Current | New | Guard |
|---|---|---|
| `/api/admin/login` (POST/DELETE) | `/api/auth/login` (POST), `/api/auth/logout` (DELETE) | public / self |
| `/api/admin/test-email` | unchanged path | ADMIN + SUPERADMIN |
| `/api/vendors/[id]` (GET), `/api/documents/[id]`, `/api/vendors/[id]/export` | unchanged paths | `requireRole([SCM,MANAGER,ADMIN,SUPERADMIN])` (view) |
| `/api/vendors/[id]/status`, `/api/invites`, `/api/vendors/[id]/document-requests` | unchanged paths | `requireRole([SCM,ADMIN,SUPERADMIN])` (mutate — **no manager**) |
| `/api/register`, `/api/reupload`, `/api/health`, `/api/cron/purge` | unchanged | public / token / cron-secret (unchanged) |
| — | `/api/admin/users/*` (CRUD, reset password, activate) | SUPERADMIN |

Public vendor-facing flows (`/register`, `/reupload`) are **completely untouched** — vendors never
log in.

---

## 8. App shell & navigation

`src/app/admin/layout.tsx`'s single gate is replaced by a shared authenticated shell (a route
group, e.g. `(app)`, or per-section layouts) that:

1. Calls `getCurrentUser()`; `null` → `/login`; `mustChangePassword` → `/account/password`.
2. Renders the role-driven `Sidebar`.

**`Sidebar.tsx` becomes data-driven.** The hardcoded `nav` array is replaced by a nav built from
`currentUser.role` via an `rbac` helper:

- **Line role** → only their department's section (workspace home + its activity sub-items).
- **Oversight** → Overview + all five department sections; **admin/superadmin** also get an
  **Administration** group (Settings for admin+superadmin; Users for superadmin).
- The hardcoded "Coming soon" block is removed; "coming soon" now lives inside each workspace (§9).
- The header text "GNE" block → real logo; subtitle is **role-aware** (shows the department/role
  name, e.g. "SCM", "Finance", "Administration").

---

## 9. Workspace contents — this phase

- **SCM (`/scm`)** — the **real, working** vendor master, re-homed unchanged: dashboard
  (`/scm`), vendors list + detail, invites, exports, document-requests, print. Plus "coming soon"
  cards for **PR · RFQ · PO · GRN · Inventory (Materials Receipt / Store / Issue)**.
- **BD (`/bd`)** — shell dashboard; "coming soon" cards: **Lead · Quotation · PO · Order Confirmation**.
- **PROJECT (`/project`)** — cards: **BOM · Schedule Planning · Deployment · Execution · DPR ·
  Approval · MRC · Billing**.
- **FINANCE (`/finance`)** — cards: **Invoice raise · Invoice Approval · Payment · Reconciliation**.
- **HR (`/hr`)** — cards: **Manpower Planning · Recruitment · Attendance · Payroll**.
- **Overview (`/overview`)** — oversight landing: per-department summary tiles linking into each
  workspace; this phase shows the vendor KPIs for SCM (reuse the dashboard queries) and placeholder
  tiles for the not-yet-built departments.
- **Administration** — `/admin/users` (superadmin: list, create, edit role, activate/deactivate,
  reset password) and `/admin/settings` (existing).

A reusable **`ComingSoon`** card-grid component (`src/components/ComingSoon.tsx`) renders the
activity placeholders consistently, reusing the existing "Soon" pill styling from `Sidebar.tsx`.

---

## 10. Branding

- Replace the text "GNE" `LogoBlock` (in `Sidebar.tsx`) and the gradient "GNE" tile (in `/` and the
  login card) with `public/brand/gne-infra.png` via Next `<Image>`.
- Surfaces: sidebar header (rail + mobile drawer), mobile top bar, `/login` card, root `/` hero.
- The logo is a wide multi-colour gradient mark; it sits on light/white surfaces directly, and on
  any coloured hero band gets a white rounded chip behind it for contrast (keeps WCAG legibility).
- Root `/` and login copy updated from "Vendor Portal" → "GNE ERP" / "Staff sign-in"; the
  "Are you a vendor? use your invite link" hint stays.

---

## 11. Security invariants (must not regress)

- **Every route guards itself** — each new RSC page and API route calls `requireRole(...)`;
  the shell layout gate is convenience, not the boundary (same rule as today).
- **Rate-limit `/api/auth/login`** in `middleware.ts` (brute-force defense), like the old login.
- **Fail closed** — missing/short `SESSION_SECRET` ⇒ no valid sessions; no seed env ⇒ no superadmin.
- **scrypt** hashing, **constant-time** compares (passwords + cookie signature).
- Session cookie stays `httpOnly` + `Secure` (prod needs HTTPS — same cookie gotcha as today).
- CSP / headers / upload magic-byte sniffing / Zod whitelists — **unchanged**.
- `role` is **server-assigned only** (never client-settable); user-management endpoints are
  superadmin-gated and validate the target role against the `Role` enum.

---

## 12. Environment variables

| Var | Purpose | Notes |
|---|---|---|
| `SESSION_SECRET` | Signs the session cookie | **New.** 32+ random bytes; fails closed if unset |
| `SUPERADMIN_EMAIL` | Seed first superadmin | **New.** |
| `SUPERADMIN_PASSWORD` | Seed first superadmin password | **New.** 8+ chars; `mustChangePassword=true` |
| `ADMIN_PASSWORD` | (legacy shared admin password) | **Retired** — remove after migration |

`.env.example`, `.env.production.example`, and `deploy/.env.server.example` updated accordingly.

---

## 13. Out of scope (future per-department specs)

Each is its own spec → plan → build cycle, unblocked by this foundation:

- **BD vertical** — Lead → Quotation → PO → Order Confirmation pipeline.
- **SCM procurement** — PR → RFQ → PO → GRN + Inventory (receipt/store/issue).
- **PROJECT vertical** — BOM, scheduling, deployment, execution, DPR, approvals, MRC, billing.
- **FINANCE vertical** — invoice raise/approval, payments, reconciliation.
- **HR vertical** — manpower planning, recruitment, attendance, payroll.
- Cross-cutting later: department-scoped record ownership, approval workflows, notifications,
  audit log, reporting/exports per department.

---

## 14. Migration & rollout

1. Additive Prisma migration (`User`, `Role`) via `prisma migrate dev` — never reset.
2. Seed first superadmin (`prisma db seed`).
3. Re-home vendor pages `/admin/*` → `/scm/*`; new shells + login + user mgmt.
4. Swap all `isAdminAuthed()` call sites → `requireRole(...)`.
5. Update `middleware.ts`, `Sidebar.tsx`, root `/`, env examples.
6. `npm run build` (type-check) + `npm run lint` are the gates — both must pass.
7. On deploy: set `SESSION_SECRET` + `SUPERADMIN_*`, run `db:deploy` + seed; verify HTTPS so the
   `Secure` session cookie is accepted.

This branch (`multi-role-erp`) does not touch the live `vendor-only` deployment until merged.

---

## 15. Risks & open items

- **Edge crypto:** session verification stays in RSC/route handlers (Node runtime), **not**
  `middleware.ts`, to avoid Web Crypto in the edge runtime. Middleware only rate-limits.
- **Re-home churn:** ~4 vendor pages move and all `isAdminAuthed()` call sites change; the
  build/type-check gate catches stragglers. Keep `/api/vendors/*` paths stable to limit blast radius.
- **Local DB drift** (known): screenshots/admin pages may need a fresh DB (`gne_shots`) per CLAUDE.md.
- **One superadmin lockout:** if the only superadmin is deactivated, re-seeding restores access
  (idempotent seed) — documented in deploy notes.
