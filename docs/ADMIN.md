# Ginder restaurant administration

Admin is served by the existing FastAPI application at `/admin`. It reads and
updates the existing `restaurants` table; it does not import the CSV on startup.
The feature is disabled by default. This branch prepares code and a migration;
it does not deploy EC2 or create any AWS resources.

## Try the screen locally

From `backend/`, with Python 3.11–3.13 and development dependencies installed:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe scripts/admin_preview.py
```

Open `http://127.0.0.1:8010/admin`. Use `preview@example.com` and the random,
temporary password printed in that terminal. The yellow LOCAL PREVIEW banner is
always visible after signing in. This mode uses a disposable SQLite database
seeded from the CSV and in-memory photos, with no PostgreSQL, Redis, S3 or EC2
connections. Stop with Ctrl+C; preview edits, the password and uploaded photos
are discarded. The script refuses production mode. Its local rate limiter is a
test double; this process must remain bound to loopback.

SQLite HTTP tests validate persistence, permissions and upload transactions;
they do not certify PostgreSQL row locking or an applied Alembic migration.
The `admin-postgres` GitHub Actions job applies migrations, runs the same HTTP
tests against disposable PostgreSQL (including concurrent edits), then checks
downgrade to `0006` and upgrade to head. Await that job before deployment.

## Test with isolated PostgreSQL and Redis

With Docker Desktop running, from the repository root:

```powershell
docker compose -f docker-compose.admin-dev.yml up -d --wait
```

In a terminal at `backend/`, set only local test connections:

```powershell
$env:APP_ENV = 'development'
$env:ADMIN_ENABLED = 'true'
$env:PUBLIC_BASE_URL = 'http://127.0.0.1:8010'
$env:DATABASE_URL = 'postgresql+asyncpg://ginder_admin_dev:local-development-only@127.0.0.1:55432/ginder_admin_dev'
$env:REDIS_URL = 'redis://127.0.0.1:56379/0'
python -m alembic upgrade head
python scripts/seed_restaurants.py --source csv --file data/thammasat_rangsit_restaurants.csv
python scripts/manage_admin.py --email YOUR_EMAIL --name YOUR_NAME --create
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

This Compose project uses `ginder-admin-dev` names, loopback-only ports 55432 and
56379 and its own volume. It never loads `.env.production`. Shut down with
`docker compose -f docker-compose.admin-dev.yml down` to retain test data.
S3 is optional for editing text; without it the UI explains why upload is unavailable.

## AWS setup: a new bucket only

1. Create a new S3 general-purpose bucket dedicated to Ginder restaurant photos
   in the chosen region. Record the exact bucket name and region.
2. Keep all Block Public Access settings enabled and ACLs disabled (Bucket owner
   enforced). The application accesses private objects through the EC2 instance
   role and serves the public restaurant image through HTTPS on the API domain.
3. Enable default encryption (SSE-S3). The upload code also specifies AES256.
4. Attach a scoped policy to the EC2 role using
   `ops/restaurant-photo-iam-policy.example.json`, replacing the bucket placeholder
   with this NEW bucket name. Do not grant access to an unrelated bucket.
   Verify the SDK can obtain the instance role from inside the Docker container;
   inspect IMDSv2/hop-limit settings if role discovery fails rather than adding
   long-lived AWS keys to the container.
5. Set these values in the server's private `.env.production`:

```dotenv
ADMIN_ENABLED=true
ADMIN_SESSION_HOURS=4
RESTAURANT_PHOTO_BUCKET=YOUR_NEW_GINDER_BUCKET
RESTAURANT_PHOTO_REGION=YOUR_BUCKET_REGION
RESTAURANT_PHOTO_MAX_BYTES=5242880
```

No AWS keys belong in Git, HTML, JavaScript or the Android app. No public bucket
policy or browser-to-S3 CORS configuration is needed for this upload flow.
Private originals are not retained: JPG/PNG/WebP is decoded, oriented, resized
to at most 1600×1600 and re-encoded as WebP with GPS/EXIF removed. Only still images
up to 5 MiB and 25 million pixels are accepted.

## Production deployment and first administrator

Before deployment, preserve the dirty EC2 checkout and identify the reviewed
source/image version as described in OPERATIONS.md. Back up the database and
retain the previous image. Do not reset the checkout or reseed production.

1. Review/apply migration `0007` on isolated PostgreSQL first. It adds the Admin
   fields and tables without changing restaurant IDs or existing data. All
   existing users start with `is_admin=false`.
2. Prepare the new bucket and restricted EC2 role. Build the reviewed image and
   run the production migration before recreating API/worker/beat together.
   Retain the Firebase Compose overlay and all database volumes. Validate Caddy's
   updated configuration before reload: only the restaurant photo POST route
   permits a 6 MiB request; other requests retain the 64 KB cap.
3. In the new backend container, grant an existing account or create a dedicated
   administrator interactively (replace the email/name):

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.firebase.yml exec backend python scripts/manage_admin.py --email YOUR_EMAIL --name YOUR_NAME --create --production
```

The password is entered through a hidden prompt only when creating an account.
To revoke access, use the same command with `--revoke --production` instead of
`--create`. Grant/revoke clears that user's browser Admin sessions. Public signup
cannot assign `is_admin`; no HTTP endpoint grants roles.

4. Open `https://YOUR_API_DOMAIN/admin`. Confirm unauthenticated/member access is
   rejected, upload a permitted test photo to the NEW bucket, inspect its
   appearance and credit from Android, then remove the test photo through Admin.
5. Verify health/readiness, real-time sessions, scheduled jobs and mobile login.
   Backend data/photo edits need no new AAB. The filter-help text added to Android
   needs a new build for existing installations to receive that explanation.

Admin cookie sessions expire absolutely after four hours by default, are HttpOnly,
SameSite=Strict, restricted to `/admin`, and Secure in production. Writes also
require a matching Origin and a session-bound CSRF token. Password reset,
deactivation, role removal and account deletion revoke subsequent access.
Audit records retain actor ID (or null if that account is deleted), changed
fields and before/after values; choose their retention with the privacy policy.

## Editing and data integrity

- Search by name, filter category, and triage missing photos/hours, Other,
  unreviewed records and repeated names. Repeated-name counts count restaurant
  rows, not duplicate groups. Compare coordinates and map links before deciding
  whether names refer to different branches. No automatic merge/delete is offered.
- Save data and photos separately. A version check returns 409 when another tab
  changed the row: copy unsaved notes, close/reopen and reapply deliberately.
- Each change writes its audit record in the same database transaction. An S3
  upload failure preserves the old database record; database failure triggers
  deletion of the newly uploaded object. If cleanup cannot reach S3, investigate
  the logged cleanup failure and compare keys against the database. Obsolete keys
  are no longer served by the application even if cleanup needs retrying.
- Changed rows become permanent and are protected from OSM refresh/expiry. CSV
  reimport skips rows with an Admin edit version. Never use seed `--clear` in
  production. Stable IDs preserve likes, votes and session references.
- Price and rating filters already exclude unknown values. Explicit open-now
  discovery now requires recorded hours; ordinary discovery still includes shops
  without them. Do not invent prices, hours or ratings to fill the screen.
- Photo URLs contain a new object ID on every replacement. Public image responses
  have a five-minute cache lifetime; removal may take that long in existing caches.
  Photos are streamed via the API, so bandwidth passes through EC2. A future
  private-origin CDN can reduce that cost if traffic grows.

## Rollback and pending checks

Keep the additive `0007` schema if rolling back only application code; the older
application ignores the added columns. Do not automatically downgrade or delete
Admin tables containing audit records or photo references. The feature can be
closed by setting `ADMIN_ENABLED=false` and recreating the application; current
public photo URLs continue to serve existing restaurant images.

Before enabling production, verify migration upgrade/downgrade on a disposable
PostgreSQL database, actual IAM/S3 access, image delivery through Caddy, and an
Android device's photo rendering. A green unit-test run does not substitute for
these environment checks. No production credentials are included in the preview.

## Implementation validation — 30 October 2026

- Python 3.12: 342 backend tests passed, including SQL-backed Admin HTTP tests
  against disposable SQLite and S3 SDK request verification using Stubber.
- Frontend: 54 tests, ESLint and TypeScript passed.
- Backend Ruff, mypy and runtime dependency audit passed; wheel packaging includes
  all three Admin UI assets. Alembic generated PostgreSQL SQL through `0007`.
- The running Caddy binary parsed the proposed Caddyfile with `caddy adapt`;
  no configuration file was changed or reloaded on EC2.
- Browser QA: sign-in, list, edit notes, photo selection/upload/credit, persisted
  preview readback and responsive layout at 390 px were exercised. Preview media
  remained in local memory and no AWS upload was made.
- Docker Desktop was unavailable locally. Applied PostgreSQL migrations and the
  PostgreSQL-only concurrent-edit test remain for the `admin-postgres` CI job.
  S3/IAM and production deployment have not been performed.

Implementation references: [AWS S3 security guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html),
[Boto3 PutObject](https://docs.aws.amazon.com/boto3/latest/reference/services/s3/client/put_object.html),
and [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
