# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The line above is not decoration. This repo runs **Next.js 16 (App Router)**, which has
> breaking changes vs. older Next.js. Before writing Next.js code, read the relevant guide in
> `node_modules/next/dist/docs/`. Don't rely on training-data conventions for routing,
> `cookies()`/`headers()` (async), route handlers, or `next.config`.

## What this is

GNE ERP **Vendor Registration**. An admin emails a vendor a unique link; the vendor fills a
multi-step form + uploads KYC documents (GST cert, PAN, cancelled cheque, …); data lands in
Postgres; confirmation + procurement-notification emails go out; admin reviews/approves at
`/admin/vendors/<id>` (approval assigns a `vendorCode` like `GNE-V-0001`). It's the supplier
master that later ERP modules (procurement, etc.) will reference.

> **Active branch is `vendor-only`** — this is what's built and deployed. It was deliberately
> stripped down to *only* vendor registration. A larger Phase-2 "Project Management" section
> (projects, BOQ, DPR, procurement, Excel I/O, `exceljs`) still exists on **`main`** as
> historical/reference code — pull from there if rebuilding those modules. Don't reintroduce it
> on `vendor-only` unless asked.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build — ALSO the full TypeScript type-check (run before claiming done)
npm run start        # serve the production build
npm run lint         # eslint

npm run db:migrate   # create + apply a migration in dev (prisma migrate dev)
npm run db:deploy    # apply existing migrations (production / CI)
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
  (vendor wizard, `src/components/RegistrationForm.tsx`) and `/reupload/[token]` (replace one
  requested doc). Admin UI under `/admin/*` behind a single auth gate in
  `src/app/admin/layout.tsx`. API route handlers under `src/app/api/*`.
- **Data layer**: Prisma (`src/lib/prisma.ts` singleton), schema `prisma/schema.prisma`. Field
  validation is **enforced at the application layer** via Zod in `src/lib/validation.ts` +
  shared primitives in `src/lib/vendor-validation.ts` (one source of truth so the client wizard
  and the server validate identically). **GST and PAN are OPTIONAL** (each behind a toggle in
  the form); format is checked only when a value is present. Country/PIN are optional too.
- **Auth** (`src/lib/auth.ts`): one shared `ADMIN_PASSWORD`. **Fails closed** — unset, a known
  placeholder, or < 8 chars ⇒ login impossible (not silently open). The session cookie stores an
  HMAC of the password, never the password; compares are constant-time. ⚠️ **Gotcha:** in
  production the cookie is `Secure`, so the app MUST be served over **HTTPS** or browsers
  silently drop the login cookie and login *appears* to fail with a correct password.
- **Storage** (`src/lib/storage.ts`): pluggable `local`/`s3` driver. Uploads are gzip-compressed
  only when that's actually smaller (`src/lib/documents.ts` — JPEG/PDF KYC scans don't compress,
  so they store at full size). Files are purged (`src/lib/purge.ts`, run by `POST /api/cron/purge`,
  `CRON_SECRET`-protected) when **either** retention window elapses: `DOC_PURGE_DAYS` after first
  download, **or** the absolute `DOC_MAX_AGE_DAYS` after upload (downloaded or not — bounds disk).
  Only bytes are deleted; the metadata row stays (`purgedAt` stamped).
- **Email** (`src/lib/mailer.ts`): Nodemailer over any SMTP; Mailpit captures dev mail. The
  register route sends mail **fire-and-forget** (not awaited) so SMTP latency doesn't throttle
  registration throughput.
- **Rate limiting** (`src/middleware.ts`): in-memory limiter on `/api/admin/login`,
  `/api/register`, `/api/invites`. Trusts the **rightmost** `x-forwarded-for` entry (the reverse
  proxy appends the real client IP) — assumes a single instance behind a trusted proxy.
- **Tokens** (`src/lib/tokens.ts`): invite + document-request links are unguessable tokens with
  expiry + status. Register and reupload consume their token inside a transaction with a
  conditional status flip, so concurrent double-submits can't double-create.

## Database & migrations

Postgres via Prisma. Core models: `Vendor` (mirrors the registration form),
`VendorService` (repeatable service-category + item rows — replaced the old `VendorProject`),
`VendorDocument` (uploads), `VendorInvite`, `DocumentRequest`. Status flow
`INVITED → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED`.

⚠️ **Migration discipline:** the single baseline (`prisma/migrations/0_init`) has been *rebased*
several times because the live DB held no real data yet. **Once real vendor data exists, stop
doing that** — every schema change must be an additive `prisma migrate dev` migration; never
reset/squash a DB with real data.

## Environment

See `.env.example` (dev), `.env.production.example`, and `deploy/.env.server.example` (the
EC2+Neon setup) for the full list. Key vars: `DATABASE_URL`, `ADMIN_PASSWORD` (8+ chars or login
disabled), `APP_BASE_URL` (public HTTPS URL used in emailed links), the `SMTP_*` / `MAIL_FROM` /
`PROCUREMENT_NOTIFY_EMAIL` set, `STORAGE_DRIVER` (+ S3 vars when `s3`), `DOC_PURGE_DAYS`,
`DOC_MAX_AGE_DAYS`, `CRON_SECRET`.

## Deployment (live)

Deployed cheaply: **single AWS EC2** (Ubuntu, pm2) + **Neon** free Postgres + **Caddy** for
auto-HTTPS (`:80/:443 → :3000`). See `deploy/`:
- `bootstrap.sh` — one-command fresh-box setup (installs Node/Caddy/pm2/cron, builds, configures).
- `redeploy.sh` — `git pull → npm ci → migrate deploy → build → pm2 reload`.
- `ecosystem.config.js` — pm2 config; runs the Next binary directly with a **heap cap +
  `max_memory_restart`** so a leak self-restarts instead of OOM-killing the small box.
- `purge-cron.sh` (hourly) enforces the document TTL; `backup-db.sh` (every 6h) `pg_dump`s Neon
  to gzipped, rotated local backups (Neon free only gives a 6-hour restore window).

The reverse proxy terminates TLS and proxies to port 3000 — required for the `Secure` login
cookie (see Auth gotcha). `docker-compose.prod.yml` + the `VPS_DEPLOY.md`/`DEPLOY.md` guides
describe alternative Docker/VPS paths.
