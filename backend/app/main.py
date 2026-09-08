"""Ginder Backend — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.websocket.pubsub import start_pubsub_listener, stop_pubsub_listener
from app.websocket.router import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: subscribe to the Redis channel that carries WS broadcasts, so
    # events published by this or any other instance/worker reach clients
    # connected here (requirement 15.6).
    await start_pubsub_listener()
    yield
    # Shutdown
    await stop_pubsub_listener()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Ginder — Restaurant discovery app with swipe-based voting",
    lifespan=lifespan,
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST API Routes ───
app.include_router(api_router, prefix="/api/v1")

# ─── WebSocket Routes ───
app.include_router(ws_router, prefix="/ws")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "app": settings.APP_NAME}
