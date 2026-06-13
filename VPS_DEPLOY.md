# Hosting GNE ERP on a VPS (cheapest, simplest)

One small server runs **everything** in Docker: the app, the PostgreSQL
database, and Caddy (which gives you free automatic HTTPS). Uploaded documents
are stored on the server's disk and auto-deleted 7 days after they're first
downloaded, so disk usage stays tiny. No external cloud services are required
(email uses any SMTP provider you already have).

**Cost: $0–€4 / month** depending on the VPS you pick.

---

## 1. Pick a VPS

| Provider | Plan | RAM | Cost | Notes |
| --- | --- | --- | --- | --- |
| **Oracle Cloud** | Always Free (Ampere ARM) | up to 24 GB | **$0 forever** | Best value if you can get capacity. ARM — fully supported. |
| **Hetzner** | CX22 | 4 GB | **~€3.79/mo** | Cheapest reliable paid option. x86. |
| **DigitalOcean / Vultr / Linode** | smallest | 1–2 GB | ~$4–6/mo | 1 GB is tight for building; see note below. |
| **Contabo** | VPS S | 8 GB | ~€5/mo | Lots of RAM for the price. |

Use **Ubuntu 24.04 LTS**. You need at least **2 GB RAM** to build the Docker
image comfortably (the Next.js build is the heavy step). On a 1 GB server, add
swap first (shown below) or build the image elsewhere.

> **Email note:** most VPS providers block outbound port 25, but the app sends
> via SMTP **submission** ports (587/465) to SES/Gmail/etc., which work fine.

---

## 2. Point your domain (recommended)

Create a DNS **A record** for e.g. `vendors.yourdomain.com` → your VPS's public
IP. With a domain, Caddy fetches a free HTTPS certificate automatically.

(No domain yet? You can start with plain HTTP using the server's IP — set
`DOMAIN=":80"` in `.env`. Add the domain later.)

---

## 3. Set up the server

SSH in as a user with sudo, then:

```bash
# (1 GB servers only) add 2 GB swap so the build doesn't run out of memory:
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Install Docker + the compose plugin:
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # apply group without re-login
```

Open the firewall for web traffic (if ufw is enabled):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

---

## 4. Get the code and configure

```bash
git clone https://github.com/ayushsinghh0/GNEinfra.git
cd GNEinfra

# Create your production env file from the template:
cp .env.production.example .env
nano .env        # fill in every CHANGE-ME value (see below)
```

In `.env` set, at minimum:

- `DOMAIN` — your hostname (or `:80` for IP-only HTTP)
- `APP_BASE_URL` — `https://yourdomain` (the links emailed to vendors)
- `POSTGRES_PASSWORD` — a strong password, **and** put the same password inside
  `DATABASE_URL`
- `CRON_SECRET` — a long random string (`openssl rand -hex 24`)
- `ADMIN_PASSWORD` — your admin login password
- SMTP settings — from SES / Gmail App Password / your provider

---

## 5. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

That's it. On first start the app automatically creates the database tables
(`prisma migrate deploy`) and Caddy provisions HTTPS. Check it:

```bash
docker compose -f docker-compose.prod.yml ps      # all "running"/"healthy"
docker compose -f docker-compose.prod.yml logs -f app
```

Open `https://yourdomain.com/admin`, log in, and use **Settings → Send test
email** to confirm email works.

---

## 6. Schedule the 7-day file purge

Add one line to the server's crontab so old downloaded files are deleted daily:

```bash
crontab -e
```

```cron
# 3 AM daily — delete files whose 7-day post-download window has passed
0 3 * * * curl -s -X POST https://yourdomain.com/api/cron/purge -H "Authorization: Bearer YOUR_CRON_SECRET" >/dev/null
```

(Use the same `CRON_SECRET` value you set in `.env`.)

---

## 7. Backups (recommended)

The database holds all vendor data — back it up. A nightly dump:

```bash
crontab -e
```

```cron
# 2 AM daily — dump the database to /home/<user>/backups (keep 14 days)
0 2 * * * mkdir -p ~/backups && docker exec gne-db pg_dump -U gne gne_erp | gzip > ~/backups/gne_$(date +\%F).sql.gz && find ~/backups -name 'gne_*.sql.gz' -mtime +14 -delete
```

Copy `~/backups` off the server periodically (e.g. `scp`, or sync to cheap
object storage). Uploaded documents live in the `uploads` Docker volume but are
short-lived by design (purged after download), so the database dump is the
important backup.

---

## 8. Updating to a new version

```bash
cd GNEinfra
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations apply automatically on restart. Zero manual DB steps.

---

## Useful operations

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f app

# Restart just the app
docker compose -f docker-compose.prod.yml restart app

# Open a database shell
docker exec -it gne-db psql -U gne -d gne_erp

# Stop / start everything
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## Why this is cheap

- **One server** runs the app + database + HTTPS proxy — no managed-service fees.
- **Disk storage** for files, kept tiny by compression + the 7-day purge.
- **HTTPS is free** (Caddy + Let's Encrypt).
- On **Oracle Always Free** the whole thing costs **$0/month**; on Hetzner CX22
  about **€3.79/month**.

If you later outgrow one server, the same images deploy to a bigger VPS or to
managed services (the app doesn't change) — see `DEPLOY.md` for the AWS variant.
