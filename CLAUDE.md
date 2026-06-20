# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The line above is not decoration. This repo runs **Next.js 16 (App Router)**, which has
> breaking changes vs. older Next.js. Before writing Next.js code, read the relevant guide in
> `node_modules/next/dist/docs/`. Don't rely on training-data conventions for routing,
> `cookies()`/`headers()` (async), route handlers, or `next.config`.

## What this is

GNE ERP **Phase 1: Vendor Registration**. An admin emails a vendor a unique registration
link; the vendor fills a form + uploads documents (GST cert, PAN, cancelled cheque, etc.);
data lands in Postgres; confirmation + procurement-notification emails go out; admin reviews
and approves vendors at `/admin/vendors/<id>`. The `Vendor` table is meant to be the long-term
foundation that later ERP modules reference by `id` / `vendorCode`.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build — ALSO the full TypeScript type-check (run before claiming done)
npm run start        # serve the production build
npm run lint         # eslint

npm run db:migrate   # create + apply a migration in dev (prisma migrate dev)
npm run db:deploy    # apply existing migrations (production / CI)
npm run db:studio    # browse data in Prisma Studio
npm run db:seed      # tsx prisma/seed.ts
npx prisma generate  # regenerate the Prisma client after editing schema.prisma
```

There is **no test runner configured** — `build` (type-check) + `lint` are the verification gates.
Local dev expects `docker compose up -d` (Postgres on **5433**, Mailpit inbox on **8025**, MinIO on 9001).

## Architecture & conventions

**Everything that changes between dev and prod is an env var, never code.** Switching the DB
(local Postgres ⇄ Neon/RDS), storage (`STORAGE_DRIVER=local` ⇄ `s3`), or SMTP provider is a
`.env` change only. Keep it that way — don't hardcode environment assumptions.

- **Routing**: App Router under `src/app/`. Public flows: `/register/[token]` (vendor form),
  `/reupload/[token]` (re-upload a requested doc). Admin UI under `/admin/*` behind a single
  auth gate in `src/app/admin/layout.tsx`. API route handlers under `src/app/api/*`.
- **Data layer**: Prisma (`src/lib/prisma.ts` singleton). Schema is `prisma/schema.prisma`.
  Mandatory fields like GST/PAN are **enforced at the application layer** via Zod in
  `src/lib/validation.ts`, not in the DB — validation lives there, keep it there.
- **Auth** (`src/lib/auth.ts`): one shared `ADMIN_PASSWORD`. **Fails closed** — if the password
  is unset, a known placeholder, or < 8 chars, login is impossible (not silently open). The
  session cookie stores an HMAC of the password, never the password; all compares are
  constant-time. ⚠️ **Gotcha:** in production the cookie is set `Secure`, so the app MUST be
  served over **HTTPS** or browsers silently drop the login cookie and login appears to fail.
- **Storage** (`src/lib/storage.ts`): pluggable driver. Uploaded files are **gzip-compressed**
  (`src/lib/documents.ts`, skipped when it wouldn't help) and **auto-purged `DOC_PURGE_DAYS`
  after first download** via `POST /api/cron/purge` (protected by `CRON_SECRET`; run daily on a
  schedule). Only the bytes are removed; the metadata row stays.
- **Email** (`src/lib/mailer.ts`): Nodemailer over any SMTP. Mailpit captures everything in dev.
- **Rate limiting** (`src/middleware.ts`): in-memory limiter on `/api/admin/login`,
  `/api/register`, `/api/invites`. It trusts the **rightmost** `x-forwarded-for` entry because
  the reverse proxy (Caddy) appends the real client IP — this assumes a single instance behind a
  trusted proxy. For multi-instance, swap the `Map` for Redis.
- **Tokens** (`src/lib/tokens.ts`): registration invites and document-request links are
  unguessable tokens with expiry + status (`VendorInvite`, `DocumentRequest`).

## Database & migrations

Postgres via Prisma. **Every schema change is a tracked migration** (`npm run db:migrate`) —
vendor data is meant to survive forward as the ERP grows, so don't reset/squash migrations on a
DB that holds real data. Core models: `Vendor` (mirrors the paper registration form),
`VendorProject` (past projects), `VendorDocument` (uploads), `VendorInvite`,
`DocumentRequest`. Vendors flow `INVITED → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED`;
`vendorCode` (e.g. `GNE-V-0001`) is assigned on approval.

## Environment

See `.env.example` (dev) and `.env.production.example` (prod) for the full list. Key vars:
`DATABASE_URL`, `ADMIN_PASSWORD` (8+ chars or login is disabled), `APP_BASE_URL` (public URL
used in emailed links — must be the real HTTPS URL in prod), the `SMTP_*` / `MAIL_FROM` /
`PROCUREMENT_NOTIFY_EMAIL` set, `STORAGE_DRIVER` (+ S3 vars when `s3`), `DOC_PURGE_DAYS`,
`CRON_SECRET`.

## Deployment

Designed for low cost. Two documented paths: a single VPS running app + Postgres + auto-HTTPS
in Docker (`docker-compose.prod.yml` + `Caddyfile`, see `VPS_DEPLOY.md`), or AWS with Neon
(free DB) + S3 + SES (see `DEPLOY.md`). The reverse proxy terminates TLS and proxies to the app
on port 3000 — required for the `Secure` login cookie to work (see Auth gotcha above).
