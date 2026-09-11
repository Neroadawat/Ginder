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

## Environment Variables

Copy `.env.example` files in both `backend/` and `frontend/` directories and fill in the values.

## License

Private — All rights reserved.
