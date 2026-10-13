#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_FILE=${BACKUP_FILE:-}

if [ "${CONFIRM_RESTORE:-}" != "restore-ginder-production" ]; then
  echo "Set CONFIRM_RESTORE=restore-ginder-production to acknowledge replacement of database data." >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ] || [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "ENV_FILE and an existing BACKUP_FILE are required." >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.prod.yml" \
  stop backend celery-worker celery-beat
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.prod.yml" \
  exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner < "$BACKUP_FILE"
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.prod.yml" \
  up -d backend celery-worker celery-beat

echo "Restore completed. Run the production smoke test now."
