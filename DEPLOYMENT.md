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
- A tested off-server destination for encrypted PostgreSQL backups.

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

Set `PUBLIC_BASE_URL=https://<your-domain>` and a monitored `SUPPORT_EMAIL`.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`,
and `SMTP_SECURITY` (`starttls` or `ssl`) using your email provider's settings.
Verify the sender/domain with that provider. Test password recovery with a real
mailbox before launch; the generic success response does not prove delivery.

Public pages are served by the API at `/privacy`, `/terms`, `/delete-account`,
and `/reset-password`. Review the policy and specify actual backup retention
before publishing. Use these HTTPS URLs in the app and Play Console.

For optional Firebase push, put the private service-account file at
`secrets/firebase-credentials.json`, then add `-f docker-compose.firebase.yml`
to all production Compose commands. This mounts the credential read-only in
the API and worker. Never commit or paste the private credential into chat.
Put the Android Firebase configuration at
`frontend/android/app/google-services.json` and set `FCM_ENABLED=true` in the
frontend production environment. Without Firebase, keep `FCM_ENABLED=false`.

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
cd frontend
npm run release:check
cd android
./gradlew bundleRelease
```

On Windows use the existing short-path checkout `C:\g\frontend\android`
to avoid native-build path length limits. The release checker intentionally
rejects placeholder domains. See `docs/PLAY_STORE.md` for store materials and
owner actions still required for publication.

The release build no longer uses the repository debug key. Back up the upload
key securely; losing it can prevent future app updates.

## 6. Operations

- Monitor `/health/live` for process health and `/health/ready` for PostgreSQL
  and Redis readiness.
- Run `ops/backup-postgres.sh` daily from cron/systemd. It defaults to 14 local
  days; set `BACKUP_RETENTION_DAYS` to the policy-approved value. Encrypt and
  copy every successful backup off-host. Test `ops/restore-postgres.sh` on a
  disposable server before launch; it requires an explicit confirmation value.
- Monitor disk usage for PostgreSQL, Redis append-only data, and Caddy data.
- Review Google usage in Ginder Settings and in Google Cloud billing/quota pages.
- Rotate JWT, database, Redis, SMTP, Firebase, and Google secrets after exposure.
- Apply dependency and base-image security updates before public deployment.

## Rollback

Keep the previous application image tag and a database backup. Application code
can roll back independently only when its older version supports the current
schema. Database downgrade is a separate, reviewed operation; never run an
automatic destructive downgrade against the only production database.
