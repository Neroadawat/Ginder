#!/usr/bin/env bash
# Deploy only metadata discovery changes. Keep Google disabled.
set -Eeuo pipefail
umask 077

ROOT=/home/ubuntu/Ginder
STAGE=$(realpath "${1:?Usage: bash deploy-google-metadata.sh /home/ubuntu/ginder-google-test.XXXXXX}")
[[ "$STAGE" == /home/ubuntu/ginder-google-test.* ]] || {
  echo 'Unexpected test source directory'; exit 1;
}
ID="metadata-$(date -u +%Y%m%d-%H%M%S)-$$"
CANDIDATE="ginder-backend:$ID"
PREVIOUS="ginder-backend:before-$ID"
CHECK_IMAGE="ginder-google-test:$ID"
BACKUP="/home/ubuntu/ginder-release-backups/$ID"
FILES=(
  app/api/routes/restaurants.py
  app/core/config.py
  app/schemas/restaurant.py
  app/services/google_places_service.py
  app/services/quota_service.py
)
for file in "${FILES[@]}"; do
  test -f "$STAGE/backend/$file"
  test -f "$ROOT/backend/$file"
done
test -d "$STAGE/backend/tests"
test -d "$STAGE/frontend/src"
test -f "$ROOT/.env.production"
test -f "$ROOT/docker-compose.firebase.yml"
test ! -e "$BACKUP"
cd "$ROOT"
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.firebase.yml)

# Refuse to silently preserve an already-enabled provider during this rollout.
docker exec ginder-production-backend-1 python -c \
  'from app.core.config import settings; assert not settings.GOOGLE_PLACES_ENABLED, "Google must be disabled for this rollout"'
ACTIVE=$(docker inspect --format '{{.Image}}' ginder-production-backend-1)
docker tag "$ACTIVE" "$PREVIOUS"

# Reuse the exact running image's dependencies; replace only five reviewed files.
{
  printf 'FROM %s\n' "$PREVIOUS"
  for file in "${FILES[@]}"; do
    printf 'COPY --chown=ginder:ginder backend/%s /app/%s\n' "$file" "$file"
  done
} > "$STAGE/Dockerfile.metadata-runtime"
docker build -f "$STAGE/Dockerfile.metadata-runtime" -t "$CANDIDATE" "$STAGE"

# Test this exact candidate without putting pytest or test sources in production.
{
  printf 'FROM %s\n' "$CANDIDATE"
  cat <<'DOCKER'
USER root
RUN python -m pip install --no-cache-dir pytest==8.3.4 pytest-asyncio==0.25.0
COPY backend/tests /app/tests
COPY frontend/src /frontend/src
ENV PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
USER ginder
DOCKER
} > "$STAGE/Dockerfile.metadata-checks"
docker build -f "$STAGE/Dockerfile.metadata-checks" -t "$CHECK_IMAGE" "$STAGE"
docker run --rm --network none --read-only --tmpfs /tmp \
  --cpus=0.5 --memory=512m --pids-limit=128 \
  -e APP_ENV=test -e DEBUG=false -e FCM_ENABLED=false \
  -e GOOGLE_PLACES_ENABLED=false -e GOOGLE_PLACES_API_KEY= \
  --entrypoint python "$CHECK_IMAGE" -m pytest \
  tests/test_google_places.py tests/test_google_quota.py tests/test_restaurant_coverage.py \
  -q -p no:cacheprovider -o asyncio_mode=auto -o asyncio_default_fixture_loop_scope=function

mkdir -p "$BACKUP"
tar -czf "$BACKUP/source-before.tar.gz" -C "$ROOT/backend" "${FILES[@]}"
printf '%s\n' "$PREVIOUS" > "$BACKUP/previous-image.txt"
cat > "$BACKUP/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -Eeuo pipefail
BACKUP=$(cd "$(dirname "$0")" && pwd)
cd /home/ubuntu/Ginder
tar -xzf "$BACKUP/source-before.tar.gz" -C backend
docker tag "$(cat "$BACKUP/previous-image.txt")" ginder-backend:production
docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.firebase.yml \
  up -d --no-build --no-deps --force-recreate --wait --wait-timeout 180 backend
docker exec ginder-production-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
ROLLBACK
chmod 700 "$BACKUP/rollback.sh"
rollback_on_error() {
  trap - ERR
  echo 'Deployment failed. Restoring the previous backend.'
  if ! bash "$BACKUP/rollback.sh"; then
    echo "Automatic rollback failed. Recovery script: $BACKUP/rollback.sh"
  fi
  exit 1
}
trap rollback_on_error ERR

for file in "${FILES[@]}"; do
  cp "$STAGE/backend/$file" "$ROOT/backend/$file"
done
docker tag "$CANDIDATE" ginder-backend:production
"${COMPOSE[@]}" up -d --no-build --no-deps --force-recreate --wait --wait-timeout 180 backend
docker exec ginder-production-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

docker exec -i ginder-production-backend-1 python - <<'PY'
from app.core.config import settings
from app.services.google_places_service import _FIELD_MASK
from app.services.quota_service import GoogleQuotaService

assert not settings.GOOGLE_PLACES_ENABLED, 'Google was unexpectedly enabled'
assert _FIELD_MASK == (
    'places.id,places.displayName,places.primaryType,places.location,places.formattedAddress'
), 'Unexpected provider fields'
assert GoogleQuotaService._limits('place_photo') == (0, 0), 'Photo quota must be disabled'
print('PASS: Google disabled; metadata-only field mask; photo reservations disabled')
PY

python3 - <<'PY'
import json
from urllib.request import urlopen

for path, expected in (('/health/live', 'ok'), ('/health/ready', 'ready')):
    with urlopen('https://ginder-app.duckdns.org' + path, timeout=20) as response:
        assert json.load(response)['status'] == expected
    print('PASS:', path)
PY
trap - ERR
printf '\nDEPLOY SUCCESS: %s\nRollback: bash %s/rollback.sh\n' "$CANDIDATE" "$BACKUP"
