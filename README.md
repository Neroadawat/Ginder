# 🍽️ Ginder

แอปหาร้านอาหารใกล้ตัวด้วย UI แบบ Swipe — หาที่กินกับเพื่อนแบบ Real-time

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Android) |
| Backend | Python / FastAPI |
| Database | PostgreSQL |
| Real-time | WebSocket + Redis Pub/Sub |
| Push Notification | Firebase Cloud Messaging (FCM) |
| State Management | Zustand + React Query |

## Project Structure

```
Ginder/
├── backend/          # FastAPI backend
├── frontend/         # React Native app
├── docker-compose.yml
├── requirement.md
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Android Studio (for React Native)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend (Windows + Android emulator)

Use JDK 17; Android Studio's bundled JDK may be too new for this project's
Gradle version.

```powershell
cd frontend
npm install
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
npm start
```

Open an emulator, then use a second terminal:

```powershell
cd frontend
adb reverse tcp:8081 tcp:8081
adb emu geo fix 100.6065 14.0708
npm run android
```

If Gradle reports `Could not move temporary workspace`, install with a
separate project cache:

```powershell
cd frontend\android
.\gradlew.bat app:installDebug `
  -PreactNativeDevServerPort=8081 `
  --no-daemon `
  --project-cache-dir "$env:LOCALAPPDATA\Temp\ginder-gradle-project-cache"
```

### Docker (Backend + DB + Redis)

```powershell
docker compose up -d
```

## Test a party session locally

1. Start two Android emulators and register a different account on each.
2. Run `adb devices`, then reverse Metro for both device ids with
   `adb -s <device-id> reverse tcp:8081 tcp:8081`.
3. On the host, tap `+` on Swipe, create a session, then share its link/code.
4. On the other account, choose Profile → Invitations → Accept. For the first
   session (before the accounts are friends), use Profile → Join with invite
   code instead. Joining makes the host and guest friends automatically.

## Restaurant data for Thammasat Rangsit

The production candidate dataset is stored in
`backend/data/thammasat_rangsit_restaurants.csv`. It contains named OpenStreetMap
restaurants within 3 km of the Rangsit campus. Missing ratings, prices, photos,
and opening hours remain unknown rather than being filled with mock values.

See `backend/data/README.md` for audit results, attribution requirements, review,
refresh, and import commands. Synthetic restaurant generation is for local
development and automated tests only.

Set `RESTAURANT_DATA_MODE=production` in `backend/.env` for demos and deployed
builds. New solo and party decks will then use only `osm` and `manual` records.
Existing sessions, votes, and history that reference old `synthetic` records
remain readable; the migration does not delete them. Use `development` only
when the mock deck is intentionally needed for UI work.

The reviewed launch dataset now has an auditable category-curation sheet and
requires source plus attribution metadata for every real photo. The app displays
that credit anywhere the photo appears; unverified image URLs are ignored.

### Local-first deck behaviour

Restaurant decks are served from PostgreSQL first. The initial deck is capped at
20 cards and the API reports `data_source`, `coverage_status`, and a
`suggested_radius_km` when fewer than 10 unseen matches are available. Solo mode
can continue with a partial deck; party sessions require at least 10 matches and
ask the host to widen the radius or relax filters otherwise. Solo likes and skips
are both remembered, so reopening or refreshing does not reshuffle already-seen
restaurants or trigger discovery merely because the user finished a deck.

### Searches outside the launch area

With `RESTAURANT_FALLBACK_PROVIDER=osm`, an empty production search first asks
the user to widen the local radius. Only an empty search at the maximum 3 km
radius triggers one OpenStreetMap Overpass lookup cycle for a shared ~400 m grid
cell (configured mirrors are tried only when an earlier endpoint fails). The
real OSM rows are cached in PostgreSQL for seven days, so nearby users reuse them
for solo swipes, likes, and party sessions without another external request.
Redis adds a short lock and an empty-result marker so simultaneous requests do
not create a request burst. If Overpass is temporarily unavailable, the API
returns an empty deck and retries later instead of failing the app.

The first uncached search can take up to about 40 seconds while a public mirror
responds. Solo-deck and party-start requests therefore use a 45-second mobile
timeout; requests served from PostgreSQL are unaffected.

Set `RESTAURANT_FALLBACK_PROVIDER=none` for a fully local demo. Change
`RESTAURANT_FALLBACK_CACHE_HOURS` to control freshness. Dynamic cached rows are
excluded from new searches after expiry and the nightly cleanup removes them
once no saved vote or session deck refers to them. The reviewed Thammasat rows
remain permanent.

Google Places is deliberately not used for this persistent fallback. Google
permits long-term storage of place IDs, but generally restricts caching of
Places content and photo resource names; that conflicts with this app's saved
likes and shared session decks. A future Google-backed live preview should be a
separate, non-persistent flow with Google attribution and billing safeguards.

## Environment Variables

Copy `.env.example` files in both `backend/` and `frontend/` directories and fill in the values.

## License

Private — All rights reserved.
