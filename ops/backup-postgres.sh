#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONFIG=${GINDER_BACKUP_CONFIG:-/home/ubuntu/.config/ginder-ops/backup.conf}
if [ -f "$CONFIG" ]; then . "$CONFIG"; fi
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_DIR=${BACKUP_DIR:-"$ROOT_DIR/backups/postgres"}
STATE_DIR=${STATE_DIR:-/home/ubuntu/.local/state/ginder-ops}
GNUPGHOME=${GNUPGHOME:-/home/ubuntu/.config/ginder-ops/gnupg}
export GNUPGHOME
: "${BACKUP_RECIPIENT:?A public backup recipient is required}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
case "$RETENTION_DAYS" in ''|*[!0-9]*) echo 'Invalid retention' >&2; exit 1;; esac
if (( RETENTION_DAYS < 1 || RETENTION_DAYS > 365 )); then exit 1; fi
test -f "$ENV_FILE"
mkdir -p "$BACKUP_DIR" "$STATE_DIR"
BACKUP_DIR=$(realpath "$BACKUP_DIR")
case "$BACKUP_DIR" in "$ROOT_DIR"/backups/postgres) ;; *) echo 'Unexpected backup directory' >&2; exit 1;; esac
exec 9>"$STATE_DIR/backup.lock"
flock -n 9 || { echo 'Backup already running' >&2; exit 1; }
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$BACKUP_DIR/ginder-$timestamp.dump.gpg"
temporary="$backup.partial"
trap 'rm -f -- "$temporary"' EXIT
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.prod.yml" \
  exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  | gpg --batch --yes --trust-model always --recipient "$BACKUP_RECIPIENT" \
      --encrypt --output "$temporary"
test -s "$temporary"
mv -- "$temporary" "$backup"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$backup")") > "$backup.sha256"
date -u +%s > "$STATE_DIR/backup-success.new"
mv -- "$STATE_DIR/backup-success.new" "$STATE_DIR/backup-success"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'ginder-*.dump.gpg' -o -name 'ginder-*.dump.gpg.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "Encrypted backup created: $(basename "$backup")"
