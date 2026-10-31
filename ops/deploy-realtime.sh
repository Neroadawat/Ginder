#!/usr/bin/env bash
# Called by deploy-realtime.ps1 after uploading a source-only candidate.
set -Eeuo pipefail
umask 077
STAGE=$(cd "$(dirname "$0")" && pwd)
ROOT=/home/ubuntu/Ginder
ID=$(basename "$STAGE")
[[ "$ID" =~ ^realtime-[a-f0-9]+$ ]] || exit 1
BACKUP=/home/ubuntu/ginder-release-backups/$ID
CANDIDATE=ginder-backend:$ID
PREVIOUS=ginder-backend:before-$ID
cd "$ROOT"
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.firebase.yml)
test -f backend/app/main.py
test -f backend/app/websocket/connection_manager.py
test ! -e "$BACKUP"
active=$(docker inspect --format '{{.Image}}' ginder-production-backend-1)
docker tag "$active" "$PREVIOUS"
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
COPY --chown=ginder:ginder backend/app/main.py /app/app/main.py
COPY --chown=ginder:ginder backend/app/websocket/connection_manager.py /app/app/websocket/connection_manager.py
DOCKER
docker build --build-arg BASE_IMAGE="$PREVIOUS" -t "$CANDIDATE" "$STAGE"

# Use the actual candidate image without production secrets, DB or network.
# Only dependency installation needs Internet; unit tests run with test config.
docker run --rm -e APP_ENV=test -e FCM_ENABLED=false \
  --mount "type=bind,source=$STAGE/backend/tests,target=/app/tests,readonly" \
  --entrypoint sh "$CANDIDATE" -c \
  'python -m pip install --quiet --no-cache-dir --target /tmp/testdeps pytest==8.3.4 pytest-asyncio==0.25.0 && PYTHONPATH=/tmp/testdeps:/app python -m pytest /app/tests -q -p no:cacheprovider -o asyncio_mode=auto -o asyncio_default_fixture_loop_scope=function'

mkdir -p "$BACKUP"
tar -czf "$BACKUP/source-before.tar.gz" -C "$ROOT/backend" \
  app/main.py app/websocket/connection_manager.py
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
rollback() {
  trap - ERR
  echo 'Deployment failed. Restoring the previous backend.'
  bash "$BACKUP/rollback.sh"
  exit 1
}
trap rollback ERR
cp "$STAGE/backend/app/main.py" backend/app/main.py
cp "$STAGE/backend/app/websocket/connection_manager.py" backend/app/websocket/connection_manager.py
docker tag "$CANDIDATE" ginder-backend:production
"${COMPOSE[@]}" up -d --no-build --no-deps --force-recreate --wait --wait-timeout 180 backend
docker exec ginder-production-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
python3 - <<'PY'
import json
from datetime import datetime
from urllib.request import urlopen

base = 'https://ginder-app.duckdns.org'
for path, expected in [('/health/live', 'ok'), ('/health/ready', 'ready')]:
    with urlopen(base + path, timeout=20) as response:
        assert json.load(response)['status'] == expected
        assert datetime.fromisoformat(response.headers['X-Server-Time']).tzinfo
        assert float(response.headers['X-Server-Processing-Ms']) >= 0
    print('PASS:', path, 'and precise server clock')
PY
trap - ERR
echo "DEPLOY SUCCESS: $CANDIDATE"
echo "Rollback: bash $BACKUP/rollback.sh"
