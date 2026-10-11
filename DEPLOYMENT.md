# Ginder production deployment

This runbook deploys the API, PostgreSQL, Redis, Celery, and an HTTPS Caddy
reverse proxy on one Docker host. For a larger deployment, replace PostgreSQL
and Redis with managed services while keeping the same application settings.

## 1. Manual prerequisites

- A Linux server with Docker Engine and Docker Compose v2.24 or newer.
- A domain whose DNS A/AAAA record points to the server.
- Inbound ports 80 and 443 open. Do not expose ports 5432, 6379, or 8000.
- A separate restricted Google Places production key, if live fallback is used.
- Google Cloud Budget Alerts and Quota Alerts.
- A private Android upload key and a safe backup of that key.
- Rights and attribution records for every non-placeholder production photo.

## 2. Production secrets

Copy `.env.production.example` to `.env.production`. Generate URL-safe secrets;
hex avoids connection-URL escaping problems:

```sh
openssl rand -hex 32
```

Replace every `CHANGE_ME`, set `DOMAIN`, and set explicit `CORS_ORIGINS` and
`ALLOWED_HOSTS`. Keep `.env.production` off Git and restrict it to the deployment
user (`chmod 600 .env.production`). Leave Google disabled until its key,
restrictions, budget, and quotas are confirmed.

Validate interpolation before starting containers:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

## 3. Start and migrate

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

The one-shot `migrate` service must finish successfully before the API and
workers start. Caddy obtains and renews HTTPS certificates automatically once
DNS and ports are correct.

Import the reviewed Thammasat dataset once:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm \
  backend python scripts/seed_restaurants.py --source csv \
  --file data/thammasat_rangsit_restaurants.csv
```

Never run the synthetic generator against production.

## 4. Verify

```sh
python backend/scripts/production_smoke.py https://api.example.com
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 backend
```

Then verify on a real phone:

- Thammasat search returns reviewed local restaurants with zero Google calls.
- Solo distance follows the current device GPS.
- Group distance follows the host location and all members get the same deck.
- Like, Match, History, and Spin Wheel work for OSM/manual restaurants.
- Outside coverage, Google fallback and at most three mounted photos work.
- Google failure and exhausted quotas fall back without crashing.
- Settings counters increase as expected and no API key appears in logs.
- Account deletion removes the user's personal data.

## 5. Android release

Copy `frontend/.env.production.example` to `frontend/.env.production` and use
only `https://` and `wss://` URLs. Create an upload key, then copy
`frontend/android/keystore.properties.example` to
`frontend/android/keystore.properties` and fill in its private values.

```sh
cd frontend/android
./gradlew bundleRelease
```

The release build no longer uses the repository debug key. Back up the upload
key securely; losing it can prevent future app updates.

## 6. Operations

- Monitor `/health/live` for process health and `/health/ready` for PostgreSQL
  and Redis readiness.
- Back up PostgreSQL daily, encrypt backups, keep at least one off-host copy,
  define a retention period, and test restoration before the demonstration.
- Monitor disk usage for PostgreSQL, Redis append-only data, and Caddy data.
- Review Google usage in Ginder Settings and in Google Cloud billing/quota pages.
- Rotate JWT, database, Redis, SMTP, Firebase, and Google secrets after exposure.
- Apply dependency and base-image security updates before public deployment.

## Rollback

Keep the previous application image tag and a database backup. Application code
can roll back independently only when its older version supports the current
schema. Database downgrade is a separate, reviewed operation; never run an
automatic destructive downgrade against the only production database.
