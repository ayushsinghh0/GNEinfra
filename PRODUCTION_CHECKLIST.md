# Production readiness — what to check before & after deploy

A pre-flight checklist plus the things that can realistically break in
production, and how to avoid each.

## Before you deploy — must-do

- [ ] **Set a strong `ADMIN_PASSWORD`** (8+ chars). Login is disabled until you
      do — there is no default. `openssl rand -base64 18`.
- [ ] **Set `CRON_SECRET`** to a long random string. `openssl rand -hex 24`.
- [ ] **Set `POSTGRES_PASSWORD`** and use the *same* value inside `DATABASE_URL`.
- [ ] **Set `APP_BASE_URL`** to your real `https://…` domain. The vendor
      registration links are built from this — if it's wrong, links 404.
- [ ] **Rotate the Gmail App Password** currently in your dev `.env`. Generate a
      fresh one on the sending account; don't reuse the dev secret in prod.
- [ ] **Confirm SMTP** in the running app: **Settings → Send test email**.
- [ ] **DNS A record** points your domain at the server, and ports **80 + 443**
      are open (on Oracle, in *both* the Security List and the OS firewall).

## After deploy — verify

- [ ] `GET https://yourdomain/api/health` returns `{"ok":true,...}` (db up,
      adminConfigured true, smtpConfigured true, cronConfigured true).
- [ ] Log in to `/admin`; invite your own email; complete the form; confirm the
      vendor appears and both emails arrive.
- [ ] **Schedule the purge cron** (daily POST to `/api/cron/purge` with the
      bearer secret) — otherwise downloaded files are never cleaned up.
- [ ] **Schedule a daily `pg_dump` backup** and copy it off the box.

## What can break in production — and the mitigation

| Risk | What happens | Mitigation (status) |
| --- | --- | --- |
| **Email deliverability** | Gmail caps ~500/day; at 4,000 vendors/mo (~12k emails) you'll hit it; mail may land in spam | Use **Google Workspace** (2,000/day) or **AWS SES** with SPF/DKIM/DMARC on your domain. The app is provider-agnostic — just env. |
| **Storage growth** | If documents are never downloaded they never purge and disk fills | Purge runs on first *download*. If you want a hard cap, add a max-age purge (offered). Monitor disk; images are already compressed. |
| **Forgot the purge cron** | Files accumulate, disk fills over months | Set the cron (checklist above). |
| **Lost database** | All vendor data gone, no recovery | Daily `pg_dump` backup (checklist). This is the single most important one. |
| **Single server down** | Whole app offline (one VPS, no redundancy) | Acceptable for Phase 1. For HA later, move DB to managed Postgres + run 2 app nodes. |
| **In-memory rate limiter** | Resets on restart; not shared across instances | Fine for one server. If you scale to multiple app instances, move the limiter to Redis. |
| **Build runs out of RAM** | `docker build` killed on a 1 GB box | Use ≥2 GB (Oracle free = 12–24 GB, fine), or add swap. |
| **Image build is ARM/AMD specific** | n/a — images are multi-arch | Works on Oracle Ampere (ARM) and x86 alike. |
| **HTTPS cert fails** | Caddy can't get a cert if DNS/ports wrong | Ensure the A record + ports 80/443 are correct before first boot. |
| **Migrations on deploy** | Container runs `prisma migrate deploy` on start | Safe & automatic; but **back up before deploying** schema changes. |
| **Admin password is the only gate** | One shared password for all admins; no per-user audit | Acceptable Phase 1; plan per-user auth for Phase 2. Keep the password strong; rate limiting is in place. |

## Known low-risk items (deliberately deferred)

- Document download is a state-changing `GET` (CSRF-low; behind admin auth + SameSite).
- Vendor can submit a different email than the one invited (kept for flexibility).
- Two moderate **build-tool** dependency advisories inside Next's own postcss
  (no runtime impact; resolved by a future Next upgrade).

## Rollback

```bash
cd GNEinfra
git checkout <previous-good-commit>
docker compose -f docker-compose.prod.yml up -d --build
```
Restore the database from the latest `pg_dump` if a migration went wrong.
