#!/usr/bin/env bash
# Restore into a newly created, isolated database only.
set -euo pipefail
umask 077
: "${BACKUP_FILE:?Set BACKUP_FILE to the temporary decrypted dump}"
test -s "$BACKUP_FILE"
probe_db="ginder_restore_check_$(date -u +%s)"
[[ "$probe_db" =~ ^ginder_restore_check_[0-9]+$ ]] || exit 1
created=0
cleanup() {
  if [ "$created" = 1 ]; then
    docker exec ginder-production-db-1 sh -c \
      'test "$1" != "$POSTGRES_DB" && exec dropdb -U "$POSTGRES_USER" "$1"' sh "$probe_db"
  fi
}
trap cleanup EXIT
docker exec ginder-production-db-1 sh -c \
  'test "$1" != "$POSTGRES_DB" && exec createdb -U "$POSTGRES_USER" "$1"' sh "$probe_db"
created=1
docker exec -i ginder-production-db-1 sh -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-privileges' \
  sh "$probe_db" < "$BACKUP_FILE"
docker exec ginder-production-db-1 sh -c \
  'exec psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -Atc "SELECT version_num FROM alembic_version; SELECT count(*) FROM restaurants; SELECT count(*) FROM pg_constraint WHERE contype=CHR(102) AND NOT convalidated;"' \
  sh "$probe_db"
echo 'PASS: isolated restore; output is migration, restaurant count, invalid foreign-key count.'
