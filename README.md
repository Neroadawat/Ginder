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

### Frontend

```bash
cd frontend
npm install
npx react-native run-android
```

### Docker (Backend + DB + Redis)

```bash
docker-compose up -d
```

## Environment Variables

Copy `.env.example` files in both `backend/` and `frontend/` directories and fill in the values.

## License

Private — All rights reserved.
