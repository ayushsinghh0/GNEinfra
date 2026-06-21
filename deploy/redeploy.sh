#!/usr/bin/env bash
#
# Redeploy after pushing new code. Run on the server.
#   ./deploy/redeploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/GNEinfra}"
BRANCH="${BRANCH:-vendor-only}"

cd "$APP_DIR"
git pull origin "$BRANCH"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo "Redeployed $(git rev-parse --short HEAD) on $BRANCH."
