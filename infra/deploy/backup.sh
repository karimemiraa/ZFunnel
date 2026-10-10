#!/usr/bin/env bash
# Nightly database backup with 14-day retention. Install with:
#   (crontab -l; echo "17 3 * * * $(pwd)/infra/deploy/backup.sh >> /var/log/zfunnel-backup.log 2>&1") | crontab -
set -euo pipefail
cd "$(dirname "$0")"
DEST=${BACKUP_DIR:-/var/backups/zfunnel}
mkdir -p "$DEST"
file="$DEST/zfunnel-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres pg_dump -U postgres --clean --if-exists zfunnel | gzip > "$file"
find "$DEST" -name 'zfunnel-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup written: $file ($(du -h "$file" | cut -f1))"
