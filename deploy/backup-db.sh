#!/usr/bin/env bash
#
# Logical backup of the Neon database. Run from cron (e.g. every 6 hours). Each
# run writes a gzipped pg_dump and rotates to the newest KEEP files. This is the
# independent backup that covers Neon Free's thin 6-hour PITR window — a bad
# migration or corruption found later can be restored from here.
#
#   crontab:  30 */6 * * * /home/ubuntu/GNEinfra/deploy/backup-db.sh >> ~/cron.log 2>&1
#
# Restore:  gunzip -c <file>.sql.gz | psql "<DATABASE_URL without prisma params>"
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/GNEinfra}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP="${KEEP:-28}"   # 28 dumps x 6h = 7 days of history

# pg_dump uses libpq, which rejects Prisma-only params (connection_limit,
# pool_timeout). Strip everything from the first such param, keeping sslmode.
DB=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"')
DB="${DB%%&connection_limit*}"

mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/gne-$TS.sql.gz"
pg_dump "$DB" --no-owner --no-privileges | gzip > "$OUT"
# Rotate: keep the newest $KEEP dumps, delete older.
ls -1t "$BACKUP_DIR"/gne-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[$(date -u +%FT%TZ)] backup: $OUT ($(du -h "$OUT" | cut -f1)) | kept=$(ls -1 "$BACKUP_DIR"/gne-*.sql.gz | wc -l)"
