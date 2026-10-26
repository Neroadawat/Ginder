# Operations

## Auth sessions release candidate 2026-10-25

Deployed with user approval on 25 October. Migration is now 0006. Backend,
Celery worker and beat were recreated; PostgreSQL/Redis/Caddy were not replaced.
Public HTTPS health/legal smoke and auth signup/login/rotation/replay/isolation/
logout/delete-account checks passed. The temporary smoke-test account was deleted.
The candidate passed 309 tests inside its actual Python 3.11 image plus isolated
PostgreSQL migration/concurrency checks. Installed Python package audit passed
after the packaging-tool updates; this is not an OS-image CVE scan.

Rollback files: `/home/ubuntu/ginder-release-backups/20261025-auth-sessions/`.
Old image: `ginder-backend:before-auth-20261025`. An encrypted database backup
was taken before migration. `rollback.sh` restores the old app image/source,
retaining the additive 0006 table; it does not restore/downgrade user data.
Rollback restores the old token behavior, so use it only for a broken rollout.

- Candidate image: `ginder-backend:release-candidate-20261025`.
- Schema 0006 adds `auth_sessions`; it does not rewrite accounts or restaurant data.
- Each login has a separate family ID and stores only a SHA-256 refresh-token hash.
  Rotation is serialized with PostgreSQL row locks. Reuse revokes that family and
  commits revocation even though the response is 401. Other logins are not revoked.
- New access tokens include a login ID; HTTP and WebSocket check its revocation.
  Old access tokens without that ID finish their short lifetime. Old refresh
  tokens require a fresh login after this deployment. Password reset still
  invalidates all tokens through the user's token version.
- Online logout revokes the family using the refresh token, after push-token
  cleanup. Offline/failed logout clears local credentials but cannot guarantee
  server revocation; tokens remain subject to expiry/reset/reuse checks.
- Login lifetime remains `REFRESH_TOKEN_EXPIRE_DAYS` (7 by default), absolute from
  login rather than extended by rotation. Expired rows are unusable; this release
  does not introduce a periodic row-purge/retention policy. Account deletion
  cascades to these rows. Agree a retention policy before public release.
- `python scripts/check_auth_sessions.py` runs upgrade/downgrade/upgrade plus
  rotation/replay/concurrency/logout/reset/delete checks in a randomly named
  `ginder_auth_check_*` database, then removes only that created database.
  It needs CREATEDB permission; never point a restore script at production for this check.
- Packaging tools in the old Python base had advisories. `Dockerfile.prod` now
  pins pip 26.2.2, setuptools 84.1.0 and wheel 0.46.2 in builder and runtime.
- Corrected wheel discovery to include `app.*`, not only the root `app` package,
  so standalone operational scripts can import installed services outside the
  source working directory. `pip check` and the candidate's tests passed.
- Release validation is not a full infrastructure/container OS penetration test;
  real-device, 16 KB runtime, external monitoring and off-site automation remain
  separate checklist items.

คู่มือดูแลเซิร์ฟเวอร์และบันทึกสำคัญ รวมไว้ในไฟล์เดียว
งานที่ยังไม่เสร็จดู [Release checklist](RELEASE.md#release-checklist)
บันทึกลงวันที่เป็นประวัติ ไม่ใช่สถานะสดของระบบ

หัวข้อ: [Deploy](#deployment-runbook) · [Backup/monitoring](#backup-and-monitoring-2026-10-23) · [Security review](#security-review-2026-10-22) · [Deployment/rollback record](#deployment-record-2026-10-23)

## Deployment runbook

Run commands below from the repository root unless a command changes directory.
This is an operational guide, not the live release status. See the
[release checklist](RELEASE.md#release-checklist) and dated [deployment record](#deployment-record-2026-10-23).

This runbook deploys the API, PostgreSQL, Redis, Celery, and an HTTPS Caddy
reverse proxy on one Docker host. For a larger deployment, replace PostgreSQL
and Redis with managed services while keeping the same application settings.

### 1. Manual prerequisites

- A Linux server with Docker Engine and Docker Compose v2.24 or newer.
- A domain whose DNS A/AAAA record points to the server.
- Inbound ports 80 and 443 open. Do not expose ports 5432, 6379, or 8000.
- A separate restricted Google Places production key and budget/quota alerts,
  only if the optional live fallback is enabled.
- A private Android upload key and a safe backup of that key.
- Rights and attribution records for every non-placeholder production photo.
- A tested off-server destination for encrypted PostgreSQL backups.

### 2. Production secrets

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

### 3. Start and migrate

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

### 4. Verify

```sh
python backend/scripts/production_smoke.py https://api.example.com
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 backend
```

Then verify on a real phone:

- Thammasat search returns reviewed local restaurants with zero Google calls.
- Solo distance follows the current device GPS.
- Group distance follows the host location and all members get the same deck.
- Like, Match, History, and Spin Wheel work for OSM/manual restaurants.
- If Google is enabled, live fallback and at most three mounted photos work.
- If Google is enabled, failure and exhausted quotas fall back without crashing.
- Settings counters increase as expected and no API key appears in logs.
- Account deletion removes the user's personal data.

### 5. Android release

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
rejects placeholder domains. See the [Play Store materials](RELEASE.md#play-store-materials)
and [release checklist](RELEASE.md#release-checklist) for publication work.

The release build no longer uses the repository debug key. Back up the upload
key securely; losing it can prevent future app updates.

### 6. Operations

- Monitor `/health/live` for process health and `/health/ready` for PostgreSQL
  and Redis readiness.
- `ops/backup-postgres.sh` streams dumps into GPG encryption and refuses to run
  without a public recipient. The installed systemd timer runs it daily; see
  [the current setup](#backup-and-monitoring-2026-10-23). Local retention is 14
  days by default; final policy-approved retention and automated off-site
  storage still need confirmation. `ops/restore-postgres.sh` is destructive and
  requires explicit confirmation; use `ops/verify-restore.sh` for an isolated drill.
- Monitor disk usage for PostgreSQL, Redis append-only data, and Caddy data.
- Review Google usage in Ginder Settings and in Google Cloud billing/quota pages.
- Rotate JWT, database, Redis, SMTP, Firebase, and Google secrets after exposure.
- Apply dependency and base-image security updates before public deployment.

### Rollback

Keep the previous application image tag and a database backup. Application code
can roll back independently only when its older version supports the current
schema. Database downgrade is a separate, reviewed operation; never run an
automatic destructive downgrade against the only production database.

## Backup and monitoring 2026-10-23

Installed on the existing EC2 without restarting the application:

- `ginder-backup.timer`: daily at 03:15 UTC, plus up to five minutes jitter
  (10:15–10:20 Asia/Tomsk); persistent after a missed run.
- `ginder-monitor.timer`: host checks every five minutes for public HTTPS
  readiness, six container health states, disk at 80%, memory at 90%, backup
  failure/freshness (27 hours), and TLS expiry within 14 days.
- Public backup key only on EC2, under `/home/ubuntu/.config/ginder-ops/gnupg`.
  No recovery private key was sent to the server.
- Encrypted dumps/checksums: `/home/ubuntu/Ginder/backups/postgres/`, mode 700
  directory and mode 600 files. No plaintext dump is written by the backup job.
- Configuration: `/home/ubuntu/.config/ginder-ops/backup.conf` and `monitor.json`.
  SMTP credentials remain in the existing production environment file, not in Git.
- Operational state: `/home/ubuntu/.local/state/ginder-ops/`.

The first backup was downloaded over SSH to the Windows recovery directory,
SHA-256 checked, decrypted locally, and restored to a fresh temporary database.
Migration `0005`, 124 restaurants and zero unvalidated foreign keys were observed;
the temporary database and plaintext test dumps were then removed. The production
database was not replaced or stopped. Encryption failure was also tested: the
job returned failure, removed the partial archive and preserved last-success state.
The low-disk check was exercised with a dry-run threshold, without sending email.

### Recovery material and off-site copy

On this computer, `C:\Users\Asus\Ginder-Recovery` is restricted to the current
Windows account and SYSTEM. It holds the GPG recovery key, an encrypted database
copy, and an encrypted ZIP containing the upload keystore and its properties.
The signing ZIP was decrypted and hash-compared before plaintext temporary ZIPs
were deleted. Neither keystore nor passwords were uploaded to EC2.

**Protect the recovery key separately:** the local GPG key relies on the Windows
directory ACL, not a GPG passphrase. Loss of this PC/key makes the encrypted
backups unrecoverable. Store a recovery-key copy in an approved password manager
or encrypted offline medium; that external copy has not been made automatically.

Download and verify the latest encrypted database backup again from Windows:

```powershell
.\ops\fetch-backups.ps1
```

This is a manual off-server copy, not an always-on off-site replication job.
No S3 bucket or other paid service was created. Choose persistent off-site storage
before relying on unattended disaster recovery.

To run another drill, decrypt a backup with the **local** recovery key into a
protected temporary file. Transfer that dump over SSH to a mode-700 staging
directory on EC2 and run `BACKUP_FILE=<private-dump-path> bash ops/verify-restore.sh`
from the repository root. The script creates a fresh `ginder_restore_check_*`
database and removes only that database on exit. Delete temporary plaintext
files after the test. Never upload the private recovery key to EC2.

### Alerts: configured checks versus delivery

`alert_email` is currently null, pending recipient approval. Checks and journal
logs are active; **no claim is made that email alerts have been delivered**.
After approval, set `alert_email` in `monitor.json` and test actual alert/recovery
delivery. SMTP uses the existing sender with verified TLS; unchanged incidents
are deduplicated, with at most one reminder every six hours after successful delivery.

Host-side monitoring cannot notify when EC2 itself is powered off or completely
unreachable. An independent external uptime service is still required for that.

Useful server commands:

```sh
systemctl list-timers --all | grep ginder
sudo systemctl start ginder-backup.service
sudo systemctl start ginder-monitor.service
journalctl -u ginder-backup.service -u ginder-monitor.service --since today
```

To undo only these scheduled jobs: disable/stop `ginder-backup.timer` and
`ginder-monitor.timer`; stop their one-shot services if running. The previous
operations scripts were preserved under the deployment backup's `ops-before-backup/`.
Do not delete recovery keys or encrypted dumps when disabling scheduling.

## Firebase push setup 2026-10-24

Firebase client configuration was matched to Android package `com.tamsoot.ginder`
and the same project as the backend service account. Both JSON files remain
ignored by Git. The private credential was installed outside the backend image
at `secrets/firebase-credentials.json`, owner UID/GID 10001, mode 400, and mounted
read-only at `/run/secrets/firebase-credentials.json` for backend and worker.
Only the client `google-services.json` belongs in the Android application.

FCM is enabled through the production overlay, not by changing the base server
environment. Always include that overlay when recreating production services:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.firebase.yml up -d --no-build backend celery-worker
```

The destructive restore helper preserves the current Firebase overlay. When
restoring onto a fresh host without existing containers, explicitly pass
`USE_FIREBASE=1` and prepare the secret first. It must never be run just to test push.

Runtime credential loading and Google OAuth succeeded. A dry-run request reached
FCM HTTP v1 and rejected a deliberately invalid test device token. This verifies
API access, **not delivery to an Android device**.

The app now handles foreground invitations and notification taps into the
authenticated invitations screen, with explicit recipient IDs to ignore stale
pushes after account switches. It does not auto-join a room or interrupt an
active party. Device permission and foreground/background/quit delivery, logout
and account-switch behavior still require real device/emulator verification.
Android force-stop is not the same as ordinary background/quit testing.

Backup/rollback files are in `/home/ubuntu/ginder-release-backups/fcm-20261024/`;
the pre-FCM image is tagged `ginder-backend:before-fcm-20261024`. No schema change
or data reset was made. To disable push without changing application data,
recreate backend/worker using the base Compose file only. Do not remove private
keys or secrets as part of a routine restart.

## Security review 2026-10-22

Historical review before the deployment in the following section.
Its original test counts and deployment statements refer to 22 October only.

รายงานนี้เป็นบันทึกผลตรวจ ณ วันที่ระบุ ไม่ใช่สถานะ deployment แบบสด

### สถานะ

แก้ไขและทดสอบใน working tree แล้ว **ยังไม่ได้ deploy ชุดนี้ขึ้น EC2** และยังไม่ได้สร้าง APK/AAB ใหม่
ไม่เปลี่ยนฐานข้อมูลจริง ไม่เปลี่ยน secret และไม่ลบข้อมูลผู้ใช้
งานเดิมที่แก้ค้างอยู่ เช่น Appetize และตัวแก้ session expiry ถูกเก็บไว้

เป็นการตรวจ source/configuration และ dependency พร้อม regression tests ไม่ใช่การรับรองว่าไม่มีช่องโหว่ทั้งหมด
ระดับความรุนแรงด้านล่างเป็นการประเมินสำหรับโปรเจกต์นี้ ไม่ใช่คะแนน CVSS อย่างเป็นทางการ

### ขอบเขตที่ตรวจ

- Backend: authentication/JWT/reset password, สิทธิ์ profile/history/likes/notifications/session, vote/deck validation
- WebSocket: authentication, membership, event delivery, malformed messages, connection lifecycle
- Frontend: token storage, refresh/retry, cache, logout, FCM cleanup, Android manifest/release settings
- Production: Docker Compose, Caddy, HTTPS/security headers, port exposure, container restrictions, health checks
- Dependencies: `pip-audit backend` และ `npm audit --json`
- Source-controlled secret scan: รูปแบบ private key, AWS access-key ID และ Google API key; ตรวจชื่อไฟล์ credential ที่ Git ติดตาม

### ช่องโหว่/ความเสี่ยงที่แก้

| รายการ | ระดับ | ผลกระทบเดิม | การแก้และไฟล์หลัก |
| --- | --- | --- | --- |
| คำขอเก่าถูก retry ด้วยบัญชีใหม่ | สูง | หากคำขอของ A ได้ 401 หลังเปลี่ยนเป็น B ตัว interceptor อาจใช้ refresh token ของ B ส่งคำขอเดิมซ้ำ รวมถึง DELETE | ผูกคำขอกับ auth revision; ปฏิเสธ response/retry ข้ามการ logout/login; `frontend/src/services/api/client.ts` |
| Refresh ที่ค้างอยู่ย้อนการ logout | กลาง | ผล refresh หรือการเขียน Keychain ที่เสร็จช้าอาจคืนสถานะบัญชีเก่า | ตรวจ expected refresh token/revision และเรียงลำดับการเขียน/ล้าง secure storage; `frontend/src/stores/authStore.ts` |
| Cache ข้ามบัญชีบนเครื่องเดียวกัน | กลาง | profile, friends, likes, history และ notifications ใช้ query key ร่วมกันและมี stale time 5 นาที | ล้าง QueryClient และ session state เมื่อ logout/เปลี่ยนบัญชี; ตรวจ response เก่าด้วย; `frontend/src/services/queryClient.ts`, `frontend/App.tsx`, auth store |
| WebSocket ไม่ถอนสิทธิ์หลัง handshake | กลาง | ถูก kick, ลบบัญชี, reset password หรือ token หมดอายุแล้วยังอาจได้รับ event ทาง socket เดิม | ตรวจ token version/expiry และ membership ก่อนส่งทุกข้อความ; ตรวจซ้ำระหว่าง idle; `backend/app/websocket/router.py`, `connection_manager.py` |
| Brute force และ public endpoint abuse | สูง | login/signup/refresh/reset-password และเดารหัสห้องไม่มี shared request limit | Redis limits แยก action/IP: login 30, signup 10, refresh 120, reset 20, join 30 ต่อ 5 นาที; WS handshake 60 ต่อ 5 นาที; limit ตอบ 429 และ Redis ขัดข้องตอบ 503 |
| Reset email limiter fail-open และ expiry ไม่ atomic | กลาง | เมื่อ Redis เสียยังส่งอีเมลต่อได้ไม่จำกัด; crash ระหว่าง INCR/EXPIRE อาจทำให้ key ไม่มีวันหมดอายุ | รวม counter/expiry ใน Lua transaction; Redis เสียไม่ส่ง reset email แต่คงข้อความตอบกลาง; `backend/app/services/rate_limit_service.py` |
| WebSocket malformed/flood/slow client | กลาง | JSON ที่ไม่ใช่ object ทำให้ handler error; cleanup ไม่ครอบคลุม; socket เก่าล้างทะเบียน socket ใหม่ได้; client ช้าขวาง broadcast | ตรวจ JSON shape, จำกัดข้อความ 4,096 ตัวอักษรและ 60 ข้อความ/นาที, handshake rate limit, Uvicorn frame limit 4,096 bytes, timeout ส่ง 5 วินาที, finally cleanup แบบตรวจ socket identity |
| Concurrent create/join/start/kick | กลาง — integrity | คำขอพร้อมกันอาจผ่าน one-session check สองครั้ง หรือเข้าห้องขณะที่อีกคำขอกำลังเริ่มเกม | ล็อกแถว account แบบ NO KEY UPDATE สำหรับ create/join และล็อก session/refresh state สำหรับ join/start/kick/leave; `backend/app/services/session_service.py` |
| Logout ล้าง FCM ไม่ครบทุกทาง | กลาง — privacy; ปัจจุบัน FCM ปิดอยู่ | Settings มี cleanup แต่ปุ่ม logout ที่หน้า Profile และทาง automatic logout ไม่มี | ย้าย cleanup เข้าจุด logout กลาง ใช้ access token ของบัญชีที่ออกโดยตรง และไม่ลบ device token หากมีบัญชีอื่นเข้ามาแล้ว; `frontend/src/services/pushRegistration.ts`, auth store, Settings |

### Hardening และ operational fixes เพิ่มเติม

- จำกัด login password ที่ 128 ตัวอักษร, refresh/reset JWT ที่ 4,096 ตัวอักษร, category ที่ 100 และ session duration สูงสุด 3,600 วินาที
- ตรวจ UUID ใน reset token ก่อนส่งเข้า SQL แทนปล่อยให้ DB driver error
- ย้ายงาน hash/verify password ออกจาก async event loop ไป thread pool ลดการขวางคำขออื่น
- จำกัด request body ผ่าน Caddy ที่ 64KB (64,000 bytes); endpoint ปัจจุบันไม่ต้องรับไฟล์ upload
- `npm start` และ `npm run start:reset` ผูก Metro กับ `127.0.0.1` เท่านั้น; ก่อนแก้พบ listener บน `::` ต้อง restart Metro เดิมจึงมีผล
- แก้ Caddy healthcheck ให้ตรวจ process Caddy ผ่าน admin endpoint ภายใน container แทนยิง backend ด้วย Host ที่ถูก TrustedHost ปฏิเสธ; backend ยังคงมี readiness check ของตนเอง
- ไม่ผ่อน `ALLOWED_HOSTS`, CORS, TLS หรือเปิด port PostgreSQL/Redis เพื่อแก้ปัญหา

### ผลทดสอบ

- Backend: **301 passed** (`python -m pytest -q`)
- Frontend: **31 passed / 10 suites** (`npx jest --config jest.config.js --runInBand`)
- Backend Ruff, mypy และ frontend TypeScript/ESLint ผ่าน
- `docker compose --env-file .env.production.example -f docker-compose.prod.yml config --quiet` ผ่าน
- ส่ง Caddyfile ใหม่ให้ Caddy binary ที่ EC2 parse ด้วย `caddy adapt` ผ่าน โดยไม่ reload/เปลี่ยน live configuration
- เพิ่ม regression tests สำหรับ rate limit/outage, bounded input, WebSocket revocation/cleanup/non-object JSON, SQL lock generation, account cache, stale refresh/storage, stale request retry และ FCM logout cleanup
- ไม่ได้รัน load test, ทดสอบ concurrent SQL จริงหลาย connection หรือ mobile end-to-end ของชุดนี้บนเครื่องจริง

### Dependency ที่ยังเหลือ

#### Python

`pip-audit backend` resolve runtime dependency ของโปรเจกต์ใหม่แล้วไม่พบ known vulnerabilities ณ วันที่ตรวจ
นี่ไม่ใช่การยืนยัน package ที่ติดตั้งอยู่แล้วใน EC2 image หรือ Python global environment ของเครื่อง Windows
ไม่ได้อัปเกรด package ทั้งเครื่องเพื่อให้ผล audit สวยขึ้น

#### React Native / npm

`npm audit` ยังมี **55 affected package entries: high 50, moderate 5, critical 0**
dependency chain เหล่านี้โยงกลับไปยัง advisory จริง 2 ตัว:

1. `braces <=3.0.3` — stack-exhaustion DoS: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
2. `sprintf-js <=1.1.3` — precision-specifier DoS: https://github.com/advisories/GHSA-hp3w-g68c-fv3c

ทั้งสอง advisory ระบุว่าไม่มี patched version และ npm registry ยังรายงานรุ่นล่าสุดเป็น 3.0.3 / 1.1.3 ตามลำดับ
อยู่ในเส้นทาง dependency ของ tooling เช่น Metro/CLI/Jest; จำนวน 55 ไม่ได้หมายถึง 55 ช่องโหว่แยกกันที่พิสูจน์ว่าโจมตีแอป production ได้
ยังไม่ตรวจ bundle เพื่อรับรองว่า tooling code เหล่านี้ไม่รวมอยู่ใน artifact ทุกชนิด

ลดการเปิดรับด้วย Metro localhost-only; ห้ามเปิด Metro ให้สาธารณะหรือ build/test source ที่ไม่น่าเชื่อถือ
ไม่ได้ใช้ `npm audit fix --force`, downgrade React Native หรือปิดคำเตือนเพื่อซ่อนปัญหา
ต้องติดตาม upstream patch และ audit ซ้ำก่อน release

### สิ่งที่ยังต้องตรวจหรือทำก่อน release

1. Deploy ชุด Backend/Caddy/Compose นี้อย่างมี backup/rollback แล้วตรวจ health, Redis limiter และสองเครื่องพร้อมกัน
2. Restart Metro; emulator ทั้งสองเครื่องใช้ `adb reverse tcp:8081 tcp:8081` แยก serial ตามเดิม
3. ทดสอบ logout/login สลับสองบัญชี, password reset แล้ว socket เก่า, kick/reconnect และ session expiry อีกครั้ง
4. หากจะเปิด FCM ต้องทดสอบ push จริงขณะ logout/offline/สลับบัญชีบน Android จริง; ตอนนี้ยังไม่ยืนยัน end-to-end
5. ตรวจ AWS Security Group/SSH, IAM/IMDS, OS/container-image CVEs, backup encryption/restore และ runtime secrets แยกต่างหาก; ไม่ได้ตรวจ AWS account จากโค้ดนี้
6. การ logout ล้างสิทธิ์ในแอป แต่ไม่ได้ทำ per-device server-side refresh-token revocation; token ที่ถูกขโมยไปแล้วอาจยังใช้ได้ถึง expiry จนกว่าจะ reset password/ลบบัญชี ควรเพิ่ม rotating refresh sessions ก่อนขยายผู้ใช้วงกว้าง
7. ยังไม่มีการยืนยันความเป็นเจ้าของอีเมลก่อนสมัครสำเร็จ; พิจารณา email verification/CAPTCHA หากพบการสร้างบัญชีอัตโนมัติ
8. Secret scan ครั้งนี้ไม่พบ pattern ข้างต้นใน tracked source แต่ไม่ครอบคลุม entropy-based secrets, Git history, secret ที่เคยส่งในแชต หรือไฟล์นอก repo

ไม่มีการรับรองว่า production พร้อมปล่อยสาธารณะเพียงเพราะ unit tests ผ่าน

## Deployment record 2026-10-23

Historical deployment record. Current remaining work is tracked in the
[release checklist](RELEASE.md#release-checklist).

### Release identity

- Host: existing Ginder EC2; public origin `https://ginder-app.duckdns.org`.
- Source: tracked backend, `Caddyfile` and production Compose from `665550f`,
  plus the WebSocket server-close fix in this working tree.
- The server checkout's Git HEAD is not the deployment identifier: earlier
  session hotfixes were already present as uncommitted files. A source snapshot
  and the final patch were deployed without resetting the checkout.
- Live source checksums and the deployment patch are retained with the release
  backup. Credentials and the frontend's outstanding changes were not packaged.

### Changes deployed

- Latest session expiry, resolution locking and persistent wheel candidates.
- Auth/join/WebSocket abuse limits and outgoing WebSocket authorization checks.
- Bounded request bodies and WebSocket frames.
- Caddy health check now uses its internal admin endpoint. Backend readiness
  continues to check the application, database and Redis independently.
- The kick/reconnect smoke test exposed `WebSocketDisconnected` after a manager
  closed a revoked socket. The receive loop now handles this expected close,
  with a regression test; unrelated runtime exceptions are not suppressed.

### Backup and rollback

Protected directory on EC2:

`/home/ubuntu/ginder-release-backups/20261023-665550f/`

Contains the pre-deployment PostgreSQL custom-format dump, checksum manifest,
source/configuration archive, original image identity, previous working diff,
rollback script, deployed patch and verification results. Directory mode is
700; the database dump is mode 600.

The previous application image is tagged:

`ginder-backend:rollback-20261023-665550f`

Emergency rollback, **only when intentionally reverting the deployment**:

```sh
bash /home/ubuntu/ginder-release-backups/20261023-665550f/rollback.sh
```

This restores the previous application source/configuration and image, not the
database. Migration remained at `0005` and this release has no schema changes.
PostgreSQL/Redis volumes were preserved; no reseeding or data reset was done.
The dump's archive table of contents was verified with `pg_restore --list`.
This is not a full restore drill or off-server backup setup.

### Verification

- Backend: 302 tests passed; Ruff and mypy passed.
- Public HTTPS smoke: liveness, readiness and public account/legal pages passed.
- Two temporary accounts tested through the public HTTPS API and WSS endpoint:
  create/join, host-only start, kick revocation, malformed socket JSON, reconnect,
  identical ordered decks, unanimous match and matching persisted results.
- Celery independently resolved timer expiry (no result polling to trigger it),
  for both no-likes and tied-likes cases. Both socket clients received matching
  winners/candidates; REST readback remained stable and late votes were rejected.
- Temporary accounts and exact test sessions were removed; deleted-account
  access tokens were rejected. Existing user data was not deleted.
- Real Redis limiter: an isolated counter enforced 429 and had a bounded TTL;
  the test key was removed without clearing other counters.
- Caddy rejected an oversized request with HTTP 413.
- All six running services reported healthy after deployment.

These API/WebSocket clients are not two physical Android phones. Device-level
release testing, FCM, scheduled/off-server backups and Play Store release remain
separate work.
