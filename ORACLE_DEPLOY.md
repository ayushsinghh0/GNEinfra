# Hosting GNE ERP on Oracle Cloud — Always Free ($0/month)

Oracle Cloud's **Always Free** tier gives you a genuinely free, always-on server
big enough to run this entire app (app + PostgreSQL + HTTPS) forever. This guide
takes you from zero to a live HTTPS site.

> **Result:** the whole stack on one Ampere ARM VM — **$0/month**, no time limit.

The app's Docker images (Node, PostgreSQL, Caddy) all support ARM, so the free
**Ampere A1** machine works perfectly.

---

## 0. What you'll create

- 1× **Ampere A1 Flex** VM (free: up to 4 cores / 24 GB RAM) running Ubuntu
- The full stack via `docker-compose.prod.yml` (already in this repo)
- Free HTTPS via Caddy + Let's Encrypt (needs a domain)

You need: an Oracle Cloud account, an SSH key pair, and (recommended) a domain.

---

## 1. Create an Oracle Cloud account

1. Go to **https://www.oracle.com/cloud/free/** → **Start for free**.
2. Sign up. A card is required for identity verification but **Always Free
   resources never charge** — to be safe, after signup you can stay on the free
   account and avoid "Upgrade to Paid".
3. Pick a **Home Region** close to your users (e.g. *India South (Hyderabad)* or
   *India West (Mumbai)*). This can't be changed later.

---

## 2. Create an SSH key (on your laptop)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gne_oracle -C "gne-oracle"
```
This makes `~/.ssh/gne_oracle` (private) and `~/.ssh/gne_oracle.pub` (public).
You'll paste the **.pub** contents into the console in the next step.

---

## 3. Launch the VM

1. In the Oracle console: **☰ → Compute → Instances → Create instance**.
2. **Name:** `gne-erp`.
3. **Image and shape → Edit:**
   - **Image:** Canonical **Ubuntu 24.04** (or 22.04).
   - **Shape → Ampere → `VM.Standard.A1.Flex`**. Set **2 OCPUs, 12 GB** (well
     within the free 4-core/24 GB allowance; bump to 4/24 if you like).
4. **Networking:** keep the default — it creates a VCN + public subnet and
   **assigns a public IPv4**. Ensure *"Assign a public IPv4 address" = Yes*.
5. **Add SSH keys:** paste the contents of `~/.ssh/gne_oracle.pub`.
6. **Boot volume:** 50 GB is plenty (free tier allows up to 200 GB total).
7. **Create.** Wait until state = **Running**, then copy the **Public IP address**.

> **"Out of host capacity"?** Ampere is popular and sometimes full. Fixes:
> try a different **Availability Domain** in the Create dialog, try again later,
> or temporarily choose 1 OCPU/6 GB. It usually succeeds within a few tries.

---

## 4. Open the firewall — BOTH layers (important)

Oracle blocks ports in two places. You must open **80** and **443** in each.

### (a) Cloud Security List
**Networking → Virtual Cloud Networks → [your VCN] → Subnets → [public subnet]
→ Security Lists → Default Security List → Add Ingress Rules:**

| Source CIDR | IP Protocol | Dest. Port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Port 22 for SSH is already open by default.)

### (b) The VM's own firewall (the classic Oracle gotcha)
Oracle's Ubuntu image ships with iptables rules that drop everything except SSH.
SSH in first (next step), then run:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save     # persist across reboots
```

---

## 5. Connect

```bash
ssh -i ~/.ssh/gne_oracle ubuntu@YOUR_PUBLIC_IP
```

(Then run the iptables commands from step 4b.)

---

## 6. Point your domain (recommended)

Create a DNS **A record**: `vendors.yourdomain.com` → `YOUR_PUBLIC_IP`.
With a domain, Caddy fetches a free HTTPS certificate automatically.

No domain yet? You can start on plain HTTP using the IP (set `DOMAIN=":80"` in
`.env`) and add the domain later.

---

## 7. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 8. Deploy the app

```bash
git clone https://github.com/ayushsinghh0/GNEinfra.git
cd GNEinfra

cp .env.production.example .env
nano .env        # fill in the CHANGE-ME values (see below)

docker compose -f docker-compose.prod.yml up -d --build
```

Set in `.env` at minimum:
- `DOMAIN` = `vendors.yourdomain.com` (or `:80` for IP-only)
- `APP_BASE_URL` = `https://vendors.yourdomain.com`
- `POSTGRES_PASSWORD` = a strong password — put the **same** value inside `DATABASE_URL`
- `CRON_SECRET` = `openssl rand -hex 24`
- `ADMIN_PASSWORD` = your admin login password
- SMTP settings (Gmail App Password / SES / etc.)

The build takes a few minutes on first run (2 OCPU handles it fine). On startup
the app **auto-creates the database tables** and Caddy provisions HTTPS.

Check it:
```bash
docker compose -f docker-compose.prod.yml ps          # all running/healthy
docker compose -f docker-compose.prod.yml logs -f app
```
Open `https://vendors.yourdomain.com/admin` and use **Settings → Send test
email** to confirm email works.

---

## 9. Schedule the 7-day file purge

```bash
crontab -e
```
```cron
0 3 * * * curl -s -X POST https://vendors.yourdomain.com/api/cron/purge -H "Authorization: Bearer YOUR_CRON_SECRET" >/dev/null
```
(Use the same `CRON_SECRET` from `.env`.)

---

## 10. Back up the database

```bash
crontab -e
```
```cron
0 2 * * * mkdir -p ~/backups && docker exec gne-db pg_dump -U gne gne_erp | gzip > ~/backups/gne_$(date +\%F).sql.gz && find ~/backups -name 'gne_*.sql.gz' -mtime +14 -delete
```
Periodically copy `~/backups` off the server (e.g. `scp` to your laptop).

---

## 11. Updating later

```bash
cd GNEinfra
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Migrations apply automatically on restart.

---

## Operations cheatsheet

```bash
docker compose -f docker-compose.prod.yml logs -f app     # app logs
docker compose -f docker-compose.prod.yml restart app     # restart app
docker exec -it gne-db psql -U gne -d gne_erp             # db shell
docker compose -f docker-compose.prod.yml down            # stop all
```

---

## Cost

**$0/month**, indefinitely, on Always Free — as long as you stay within:
- ≤ 4 Ampere OCPUs + 24 GB RAM total
- ≤ 200 GB total block storage
- 10 TB/month outbound traffic (far more than this app needs)

Email via Gmail/Workspace is free; via AWS SES it's ~$1/month at high volume.
Uploaded documents are kept small by client-side image compression + the 7-day
purge, so you'll stay well under the free storage limit.
