#!/usr/bin/env bash
#
# One-time setup for a FRESH Ubuntu host (e.g. an AWS EC2 free-tier t3.micro).
#
# Architecture (kept cheap on purpose):
#   - App (Next.js)        -> this box, run by pm2 on :3000
#   - Reverse proxy + TLS  -> Caddy (auto Let's Encrypt cert + renewal) :80/:443
#   - Database             -> EXTERNAL Neon Postgres (free tier) — NOT installed here
#   - File uploads         -> local disk (STORAGE_DRIVER=local), auto-purged
#
# Because Postgres is external, this box only needs ~enough RAM to build the app.
# Usage:
#   DOMAIN=16.171.13.188.sslip.io ./deploy/bootstrap.sh
# (Create ./.env first — see deploy/.env.server.example.)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ayushsinghh0/GNEinfra.git}"
APP_DIR="${APP_DIR:-$HOME/GNEinfra}"
BRANCH="${BRANCH:-vendor-only}"
DOMAIN="${DOMAIN:?Set DOMAIN (e.g. <ip>.sslip.io for a bare IP, or your real hostname)}"

export DEBIAN_FRONTEND=noninteractive
echo "==> Installing system packages (Node, Caddy, build tools)"
sudo apt-get update -qq
sudo apt-get install -y -qq curl ca-certificates git nodejs npm caddy build-essential
sudo npm install -g pm2 >/dev/null

echo "==> Ensuring 1G swap (so 'next build' survives on a 1GB instance)"
if ! sudo swapon --show | grep -q swap; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Fetching code ($BRANCH)"
if [ ! -d "$APP_DIR/.git" ]; then git clone "$REPO_URL" "$APP_DIR"; fi
cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [ ! -f .env ]; then
  echo "ERROR: $APP_DIR/.env not found. Copy deploy/.env.server.example to .env and fill it in." >&2
  exit 1
fi

echo "==> Building"
npm ci
npx prisma generate
npx prisma migrate deploy   # applies migrations to the Neon DB in DATABASE_URL
npm run build

echo "==> Starting app under pm2 (ecosystem.config.js — memory-capped, auto-restart)"
pm2 delete gne-erp 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

echo "==> Configuring Caddy ($DOMAIN -> :3000, auto-HTTPS)"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl restart caddy
sudo systemctl enable caddy >/dev/null 2>&1

echo "==> Done. App live at: https://$DOMAIN"
echo "    (Open ports 80 + 443 in the EC2 Security Group if you haven't.)"
