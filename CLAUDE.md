# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The line above is not decoration. This repo runs **Next.js 16 (App Router)**, which has
> breaking changes vs. older Next.js. Before writing Next.js code, read the relevant guide in
> `node_modules/next/dist/docs/`. Don't rely on training-data conventions for routing,
> `cookies()`/`headers()` (async), route handlers, or `next.config`.

## What this is

GNE ERP — a **multi-role staff platform** for a solar-EPC business. Staff sign in (per-user
accounts, 8 roles) and land in their **department workspace**: **BD · SCM · Project · Finance · HR**
(five line departments) plus three connected oversight tiers — **Manager** (read + sign-off,
cross-department), **Admin** (read/write all departments), **Superadmin** (everything incl. user
management). Line departments are siloed; only the oversight roles cross boundaries.

Two verticals are built; the rest are role-scoped "coming soon" shells:
- **SCM** owns the **vendor/supplier master** — the original vendor-registration flow (admin emails
  a vendor a token link → multi-step form + KYC uploads → review/approve → `vendorCode` like
  `GNE-V-0001`), re-homed under `/scm/*`.
- **HR** is fully built (`/hr/*`) — employee master, asset register, monthly attendance, payroll +
  printable salary slips, projects + concurrent assignments, leave balances, and a predictive
  analytics dashboard. It was reworked in the **"Connected" redesign** (branch `hr-connected-redesign`,
  unmerged) so every record cross-links and no list scrolls sideways — see the dedicated section below.

> **Branches:** `multi-role-erp` (this branch) carries the full multi-role ERP + HR module and is the
> **currently-deployed / live** branch — the production site at `erp.ayushraj.site` runs it (cut over
> from `vendor-only` on 2026-06-29). `vendor-only` is the older vendor-registration-only branch — no
> longer live, kept as a rollback target. `main` holds historical Phase-2 reference code
> (BOQ/DPR/procurement/Excel I/O). Don't reintroduce Phase-2 here unless asked.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build — ALSO the full TypeScript type-check (run before claiming done)
npm run start        # serve the production build
npm run lint         # eslint

npm run db:migrate   # create + apply a migration in dev (prisma migrate dev)
npm run db:deploy    # apply existing migrations (production / CI)
npm run db:seed      # bootstrap the first superadmin from SUPERADMIN_EMAIL/PASSWORD (idempotent)
npm run db:seed:demo # DEV/TEST ONLY: one login per role + sample HR/vendor data (prisma/seed-demo.ts)
npm run db:studio    # browse data in Prisma Studio
npx prisma generate  # regenerate the Prisma client after editing schema.prisma
```

**No test runner is configured** — `build` (which type-checks) + `lint` are the verification
gates; run both before claiming done. Local dev expects `docker compose up -d` (Postgres on
**5433**, Mailpit inbox on **8025**, MinIO on 9001). After deleting/clearing `.next`, a stale
type cache can fail the build referencing routes that no longer exist — `rm -rf .next` and rebuild.

## Architecture & conventions

**Everything that changes between dev and prod is an env var, never code.** Switching the DB
(local Postgres ⇄ Neon), storage (`STORAGE_DRIVER=local` ⇄ `s3`, and the S3 driver is
R2/MinIO-compatible via `S3_ENDPOINT`), or SMTP provider is a `.env` change only. Keep it that way.

- **Routing**: App Router under `src/app/`. Public, token-gated flows: `/register/[token]`
  (vendor wizard, `src/components/RegistrationForm.tsx`) and `/reupload/[token]`. Staff sign in at
  `/login`; the authenticated shell is the `src/app/(erp)/` route group with a **role-driven sidebar**
  (`src/lib/nav.tsx`) — department homes `/bd` `/scm` `/project` `/finance` `/hr`, oversight landing
  `/overview`, system admin `/admin/{users,settings}`. SCM vendor pages are `/scm/*`; HR pages are
  `/hr/{employees,assets,attendance,payout,projects}` (employee detail is a `(hub)` route-group with
  per-facet tabs — see the HR "Connected" redesign section); the `/hr` dashboard carries the analytics
  (pill-driven trend board). Print pages (vendor record, salary
  slip) live OUTSIDE the shell in a `(print)` route group so they print clean. API handlers under
  `src/app/api/*` (`/api/hr/*`, `/api/vendors/*`, `/api/admin/users/*`, `/api/auth/*`, …).
- **Data layer**: Prisma (`src/lib/prisma.ts` singleton), schema `prisma/schema.prisma`. Field
  validation is **enforced at the application layer** via Zod in `src/lib/validation.ts` +
  shared primitives in `src/lib/vendor-validation.ts` (one source of truth so the client wizard
  and the server validate identically). **GST and PAN are OPTIONAL** (each behind a toggle in
  the form); format is checked only when a value is present. Country/PIN are optional too.
- **Auth** (`src/lib/session.ts` + `src/lib/rbac.ts`): per-user accounts with a `Role` enum
  stored in the DB. `src/lib/session.ts` signs the `gne_session` cookie with `SESSION_SECRET`
  (fails closed — unset or < 16 chars disables login). `src/lib/rbac.ts` exports
  `getCurrentUser`/`requirePageRole` — these are the authority for every protected page and API
  route; call them instead of the retired `isAdminAuthed`. The first superadmin is bootstrapped
  via `npm run db:seed` using `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (idempotent). Note that
  vendor-admin pages moved from `/admin/*` to `/scm/*`. ⚠️ **Gotcha:** the `Secure` cookie
  attribute means the app MUST be served over **HTTPS** in production or browsers silently drop
  the session cookie and login appears to fail.
- **RBAC & money conventions**: `src/lib/rbac.ts` exports per-area role sets — `VENDOR_VIEW`/
  `VENDOR_WRITE`, `HR_VIEW`/`HR_WRITE`, `OVERSIGHT`, `ADMIN_AREA`, `SUPERADMIN_ONLY`. The pattern
  everywhere: **managers are read-only** — a department's view sets include `MANAGER` but its write
  sets do NOT, enforced in BOTH the UI (a `canWrite` flag hides mutate controls) AND every mutating
  API. Guards also reject `mustChangePassword` users. **Money is integer rupees** (no Prisma
  `Decimal`); payslip totals are recomputed server-side (`computePayrollTotals`). HR Zod lives in
  `src/lib/hr-validation.ts`; HR compute helpers in `src/lib/hr-leave.ts` / `src/lib/hr-forecast.ts` / `src/lib/hr-lop.ts`
  (attendance-derived loss-of-pay) / `src/lib/hr-projects.ts`.
- **Storage** (`src/lib/storage.ts`): pluggable `local`/`s3` driver. Uploads are gzip-compressed
  only when that's actually smaller (`src/lib/documents.ts` — JPEG/PDF KYC scans don't compress,
  so they store at full size). Files are purged (`src/lib/purge.ts`, run by `POST /api/cron/purge`,
  `CRON_SECRET`-protected) when **either** retention window elapses: `DOC_PURGE_DAYS` after first
  download, **or** the absolute `DOC_MAX_AGE_DAYS` after upload (downloaded or not — bounds disk).
  Only bytes are deleted; the metadata row stays (`purgedAt` stamped).
- **Email** (`src/lib/mailer.ts`): Nodemailer over any SMTP; Mailpit captures dev mail. The
  register route sends mail **fire-and-forget** (not awaited) so SMTP latency doesn't throttle
  registration throughput.
- **Rate limiting** (`src/middleware.ts`): in-memory limiter on `/api/auth/login`,
  `/api/register`, `/api/reupload`, `/api/invites` (+ an early `413` on oversized upload bodies for
  register/reupload). Trusts the **rightmost** `x-forwarded-for` entry (the reverse proxy appends
  the real client IP) — assumes a single instance behind a trusted proxy. Rate-limit any NEW
  unauthenticated endpoint here.
- **Tokens** (`src/lib/tokens.ts`): invite + document-request links are unguessable tokens with
  expiry + status. Register and reupload consume their token inside a transaction with a
  conditional status flip, so concurrent double-submits can't double-create.

## Security baseline (don't regress)

A full audit hardened this; preserve the invariants when adding code:
- **Every route guards itself.** Layout auth gates do NOT protect API route handlers or RSC data
  fetching — each protected RSC page and each non-public `/api/*` route calls
  `requirePageRole()`/`getCurrentUser()` itself (KYC endpoints `documents/[id]`,
  `vendors/[id]/export`, the `print` page, all `/api/hr/*` routes, etc. are gated → no IDOR). Any
  new route that touches vendor or HR data must do the same — and exclude `MANAGER` from mutations.
- **Never trust client-supplied MIME.** `src/lib/documents.ts` sniffs **magic bytes** and only
  accepts real PDF/PNG/JPEG/WEBP, storing the *detected* type; `gunzip` output is size-capped
  (zip-bomb guard). Keep `text/html`/`svg` out of the allow-list.
- **Headers/CSP** live in `next.config.mjs`: HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer/
  Permissions-Policy, and a CSP (`object-src`/`frame-ancestors`/`base-uri`/`form-action` locked;
  `img` allows `data:`/`blob:`). CSP adds `'unsafe-eval'` in **dev only** (Turbopack HMR) — never
  in prod. Validate CSP changes against a *production* server, not dev.
- Zod schemas are the field whitelist (status/`vendorCode`/posting-groups are NOT vendor-settable);
  the dashboard's `$queryRaw` is parameterized. `/api/health` returns `{ok}` to anon, full config
  only to authed admins.

## UI & design system ("Soft Wave")

Premium-**light** design language. Don't hand-roll one-off styles — compose the existing system:
- **Tokens** (`src/app/globals.css`): `@theme` brand teal + slate + solar amber; `:root` holds
  shadow/easing/field vars consumed as arbitrary utilities (e.g. `shadow-[var(--shadow-card)]`);
  motion keyframes + `.animate-*` / `.draw-*` / `.skeleton`; atmosphere utilities `.glass`,
  `.gne-dots`, `.gne-grain`; `.nums` (tabular figures). Fonts: **Plus Jakarta Sans** (`font-sans`),
  **Sora** (`font-display`, headings only), Geist Mono (`font-mono`, for codes/IDs).
- **Primitives** (`src/components/ui.tsx`): `Button`/`btn()`, `Card`, `Input`/`Field`, `StatCard`,
  `PageHeader`, `ProgressBar`, table helpers, `Skeleton`, `Eyebrow`. Interactive client widgets:
  `Segmented` (pill/tab control), `SectionNav` (scroll-spy tabs), `src/components/hr/MonthPicker`,
  `src/components/hr/TrendBoard` (pill-driven analytics). The GNE wordmark logo lives at
  `public/brand/gne-infra.png` (via `next/image`) — use it for any brand mark, not a "GNE" text badge.
  **Reusable chrome** (`src/components/chrome.tsx`):
  `BrandHero`, `Wave`, `Atmosphere`, `SunGlow`, `Blob`, `SuccessCheck`; plus `CountUp` and the
  drag-drop `Dropzone` (keeps a hidden `<input>` synced via DataTransfer so `FormData` +
  image compression still work).
- **Guardrails** (non-negotiable): light mode only; brand **atmosphere** (gradients / glow / grain /
  dot-grid / waves) lives **only in chrome** — heroes, rails, headers, success/empty states —
  **never behind form fields or data tables** (daylight legibility). Gate **all** motion on
  `prefers-reduced-motion` (extend the block in `globals.css` when adding animations), transparency
  on `prefers-reduced-transparency`, and bleeding-edge CSS behind `@supports`. **No chart/animation
  libraries** — charts are bespoke SVG+CSS (`src/components/Charts.tsx`: `AreaChart`/`Donut`/
  `ForecastArea`/`DeltaBadge`); "predictive" analytics use least-squares trend extrapolation
  (`src/lib/hr-forecast.ts`), not an ML library. Keep it that way. Tabular `.nums` on codes/money/dates; 16px inputs (no iOS zoom); 44px tap targets;
  `:focus-visible` rings. Full rationale: `docs/superpowers/specs/2026-06-22-vendor-portal-ui-redesign-design.md`.

## HR module — "Connected" redesign

The HR module was rebuilt so every record cross-links and no list scrolls sideways. **Compose these
conventions — don't re-hand-roll tables/links/status colors.** Full design + task plans live in
`docs/superpowers/specs/2026-07-01-hr-connected-redesign-design.md` and
`docs/superpowers/plans/2026-07-01-hr-connected-redesign-phase1.md` (+ `…-phase2.md`).

- **Employee-360 hub**: `/hr/employees/[id]` is a Next.js **`(hub)` route group**. `(hub)/layout.tsx`
  renders a persistent identity header + snapshot chips + route-tabs (Overview / Attendance / Assets /
  Projects / Payroll); each tab is its own `(hub)/<tab>/page.tsx` that summarizes and **deep-links**
  into the full module scoped to that employee. The employee is loaded once via a React-`cache()`d
  `getEmployee` in `(hub)/_data.ts` (layout + page dedupe). `/hr/employees/[id]/edit` sits OUTSIDE
  `(hub)` so it escapes the hub chrome (no double header).
- **Responsive tables**: every HR list uses **`DataTable`** (`src/components/DataTable.tsx` — a SERVER
  component; `cell`/`href` are render functions passed from server pages). It does column-priority
  hiding (`priority: md/lg/xl`) + a card fallback below `sm`, so nothing forces horizontal scroll.
  Gotchas: a cell with its own link/action must wrap content in `relative z-10` (it sits above the
  stretched row-link overlay); **any actions column MUST set `cardLabel`** or it disappears on mobile
  cards. `TableScroll` is the sticky/scroll-shadow shell for the rare genuinely-wide grid.
- **Cross-linking primitives** (added to `src/components/ui.tsx`): `EntityLink` (avatar + name + mono
  code → detail route — use it for every employee/project/asset reference), `StatusChip` backed by the
  shared status→tone registry `src/lib/hr-status.ts` (ONE color language for every enum: attendance /
  employee / project / payroll / vendor — extend the registry, don't inline colors), `Breadcrumbs` +
  `PageHeader`'s `breadcrumbs` slot, `KeyValue`/`DetailSection` (read-only detail views), `ErrorState`,
  and a **linkable `StatCard`** (`href` → drill-through). Dashboard KPIs/bars deep-link via `BarList`.
- **URL-as-filter-state** (`src/lib/hr-filters.ts`): list state (`q status category location employeeId
  sort dir page`) lives in the query string; `parseListParams`/`buildQuery` read/serialize it, dropping
  empties + defaults. **Every client filter control builds its URL via `buildQuery(basePath, patch)`**
  so params compose and never get silently dropped. Employee-scoped module views (`?employeeId=`) show
  a `ScopedFilterChip` and are the hub's deep-link targets (`/hr/attendance|assets|payout|projects?employeeId=…`).
- **Attendance** is a **calendar heatmap** by default (`src/components/hr/AttendanceCalendar.tsx`) with
  small-multiples for the org view; the old wide day-matrix is an opt-in "Table" toggle (in `TableScroll`).
  The status color/code map is shared in `src/components/hr/attendance-status.ts`. The drag-to-paint
  interaction and the `POST /api/hr/attendance {year,month,entries,clears}` save contract are unchanged —
  preserve them. Cells key off `date.getUTCDate()` (attendance is stored at UTC midnight).
- **Payroll LOP** (`src/lib/hr-lop.ts`): `attendanceLop(empId, year, month, casualQuota, sickQuota)`
  derives per-month loss-of-pay days = absent + ½·half-day + leave/sick **over the annual quota**
  (YTD-aware); rate = monthly gross ÷ days-in-month. The printed slip uses it; Phase 2 folds an editable
  `"Loss of Pay"` deduction (via `PayrollRecord.extraLines`, no schema change) into the payout editor.
- **Phase 2 (in progress)** adds bulk payroll (batch save-all/auto-split-all), saved-view pills, per-employee
  allocation guardrails (≤100% across concurrent projects, server-enforced), and a **Cmd-K command palette**
  (`/api/hr/search` returns a SHAPED payload — never raw Employee rows, which carry salary/bank/PAN).
  **No schema migration** in either phase — LOP rides `extraLines`, allocation aggregates existing `allocationPct`.

## Database & migrations

Postgres via Prisma (`prisma/schema.prisma`). Model groups:
- **Auth:** `User` (per-user accounts) + `Role` enum (`SUPERADMIN ADMIN MANAGER BD SCM PROJECT FINANCE HR`).
- **Vendor/SCM:** `Vendor` (registration form) + `VendorService`/`VendorProduct`/`VendorExperience`/
  `VendorPurchaseOrder`/`VendorTurnover`, `VendorDocument`, `VendorInvite`, `DocumentRequest`.
  Status flow `INVITED → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED`.
- **HR:** `Employee` (the Man-EMID master + leave quotas + CTC/salary/LTA/special-allowance/conveyance
  + bank A/C / bankName / IFSC / PAN / UAN / ESIC), `EmployeeAsset`, `AttendanceRecord`
  (`AttendanceStatus` = PRESENT/ABSENT/LEAVE/SICK/HALF_DAY/HOLIDAY/WEEK_OFF; unique per employee+day,
  stored at **UTC midnight**), `PayrollRecord` (monthly, integer-rupee earnings/deductions incl. LTA +
  special allowance + an `extraLines` JSON of custom per-slip line items; totals server-computed via
  `computePayrollTotals`), `Project` + `ProjectAssignment` (concurrent per-employee assignments —
  assignable from EITHER the employee detail OR the project detail page). `AttendanceRecord`/
  `PayrollRecord` use `onDelete: Restrict` so deleting an employee can't wipe payroll/attendance history.

⚠️ **Migrations are additive.** Each schema change is a tracked `prisma migrate dev` migration — or,
when no DB is reachable, authored **offline** via `prisma migrate diff --from-schema-datamodel <old>
--to-schema-datamodel <new> --script` into a new `prisma/migrations/<ts>_<name>/migration.sql`
(`prisma generate` runs offline too). Never reset/squash a DB with real data; production **Neon**
holds the live data. (Postgres enum `ADD VALUE` needs `AFTER 'x'` to control ordering.)

⚠️ **Local dev DB can be schema-drifted.** The old docker `gne_erp` DB predates the auth/HR tables,
so the new app 500s against it. Create a **fresh** DB and `migrate deploy` into it (e.g. `gne_e2e`),
point `DATABASE_URL` there, then `npm run db:seed` + `npm run db:seed:demo`. Production Neon is correct.

## Environment

See `.env.example` (dev), `.env.production.example`, and `deploy/.env.server.example` (the
EC2+Neon setup) for the full list. Key vars: `DATABASE_URL`, `SESSION_SECRET` (16+ chars or login
disabled), `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (seeded once via `npm run db:seed`),
`APP_BASE_URL` (public HTTPS URL used in emailed links), the `SMTP_*` / `MAIL_FROM` /
`PROCUREMENT_NOTIFY_EMAIL` set, `STORAGE_DRIVER` (+ S3 vars when `s3`), `DOC_PURGE_DAYS`,
`DOC_MAX_AGE_DAYS`, `CRON_SECRET`.

## Deployment (live)

Deployed cheaply: **single AWS EC2** (Ubuntu, pm2) + **Neon** free Postgres + **Caddy** for
auto-HTTPS (`:80/:443 → :3000`). See `deploy/`:
- `bootstrap.sh` — one-command fresh-box setup (installs Node/Caddy/pm2/cron, builds, configures).
- `redeploy.sh` — `git pull → npm ci → migrate deploy → db:seed → build → pm2 reload`. ⚠️ It defaults
  `BRANCH=vendor-only`; the box is now on `multi-role-erp`, so run `BRANCH=multi-role-erp ./deploy/redeploy.sh`.
  ⚠️ On the tiny t3.micro `npm ci` can OOM-kill / fill the disk — for small pushes prefer `npm install`
  (+ `npm cache clean --force`, and don't add big swapfiles — disk is ~85% full), and run the deploy
  **detached** (`nohup … > ~/deploy.log &`, then poll the log) since SSH (port 22) throttles during the build.
- `ecosystem.config.js` — pm2 config; runs the Next binary directly with a **heap cap +
  `max_memory_restart`** so a leak self-restarts instead of OOM-killing the small box.
- `purge-cron.sh` (hourly) enforces the document TTL; `backup-db.sh` (every 6h) `pg_dump`s Neon
  to gzipped, rotated local backups (Neon free only gives a 6-hour restore window).

The reverse proxy terminates TLS and proxies to port 3000 — required for the `Secure` login
cookie (see Auth gotcha). `docker-compose.prod.yml` + the `VPS_DEPLOY.md`/`DEPLOY.md` guides
describe alternative Docker/VPS paths.
