#!/usr/bin/env bash
#
# Redeploy after pushing new code. Run on the server.
#   ./deploy/redeploy.sh
#
# Sized for the t3.micro (908MB RAM + 1GB swap):
#   - npm install (not `npm ci`): ci re-downloads everything and has
#     OOM-killed / filled the disk on this box; install is a no-op when the
#     lockfile hasn't changed.
#   - The build heap is capped so `next build`'s TypeScript phase GCs into
#     swap instead of being OOM-killed (it died at the default cap twice on
#     2026-07-02).
# Run detached (SSH throttles during the build):
#   nohup ./deploy/redeploy.sh > ~/deploy.log 2>&1 &
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/GNEinfra}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
# The box is a pure tracking checkout — align it to origin exactly. A plain
# `git pull` dies with "divergent branches" when the local branch is stale
# (this killed the 2026-07-02 deploy after main was rewired).
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
npm install --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
# seed/ensure the first superadmin (idempotent; needs SUPERADMIN_EMAIL/PASSWORD in env)
npm run db:seed
NODE_OPTIONS=--max-old-space-size=768 NEXT_TELEMETRY_DISABLED=1 npm run build
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo "Redeployed $(git rev-parse --short HEAD) on $BRANCH."
