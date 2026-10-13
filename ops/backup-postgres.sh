#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_DIR=${BACKUP_DIR:-"$ROOT_DIR/backups/postgres"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

case "$BACKUP_DIR" in
  "$ROOT_DIR"/backups/*) ;;
  *) echo "BACKUP_DIR must be inside $ROOT_DIR/backups" >&2; exit 1 ;;
esac

set -a
. "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary="$BACKUP_DIR/ginder-$timestamp.dump.partial"
backup="$BACKUP_DIR/ginder-$timestamp.dump"

cleanup() {
  rm -f -- "$temporary"
}
trap cleanup EXIT INT TERM

docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.prod.yml" \
  exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$temporary"
mv -- "$temporary" "$backup"
sha256sum "$backup" > "$backup.sha256"
find "$BACKUP_DIR" -type f \( -name 'ginder-*.dump' -o -name 'ginder-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "Created $backup"
echo "Copy this backup to encrypted off-server storage."
