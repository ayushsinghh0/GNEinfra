#!/usr/bin/env bash
#
# Trigger the document purge endpoint. Run from cron (e.g. hourly). Enforces the
# DOC_MAX_AGE_DAYS upload TTL + the post-download retention window so document
# files can't pile up on the local disk.
#
#   crontab:  0 * * * * /home/ubuntu/GNEinfra/deploy/purge-cron.sh >> ~/cron.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/GNEinfra}"
PORT="${PORT:-3000}"
SECRET=$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"')
echo "[$(date -u +%FT%TZ)] purge: $(curl -s -m 60 -X POST -H "Authorization: Bearer $SECRET" "http://localhost:$PORT/api/cron/purge")"
