"""Ginder Backend — FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.api.routes.admin import media_router
from app.api.routes.admin import router as admin_router
from app.api.routes.public import PAGE_DIR
from app.api.routes.public import router as public_router
from app.core.admin_boundary import AdminBoundaryMiddleware
from app.core.config import settings
from app.core.database import async_session_factory, engine
from app.core.redis import redis_client
from app.websocket.pubsub import start_pubsub_listener, stop_pubsub_listener
from app.websocket.router import ws_router

logger = logging.getLogger(__name__)


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
    await redis_client.aclose()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Ginder — Restaurant discovery app with swipe-based voting",
    lifespan=lifespan,
    docs_url="/docs" if settings.EXPOSE_API_DOCS else None,
    redoc_url="/redoc" if settings.EXPOSE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.EXPOSE_API_DOCS else None,
)


@app.middleware("http")
async def server_clock(request, call_next):
    started = perf_counter()
    response = await call_next(request)
    # Generated after request processing, unlike a cached whole-second Date.
    response.headers["X-Server-Time"] = datetime.now(UTC).isoformat()
    response.headers["X-Server-Processing-Ms"] = str((perf_counter() - started) * 1000)
    return response


if settings.ALLOWED_HOSTS != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Server-Time", "X-Server-Processing-Ms"],
)
app.add_middleware(AdminBoundaryMiddleware)

# ─── REST API Routes ───
app.include_router(api_router, prefix="/api/v1")
app.include_router(public_router)
app.include_router(admin_router)
app.include_router(media_router)
app.mount("/public", StaticFiles(directory=PAGE_DIR), name="public")

# ─── WebSocket Routes ───
app.include_router(ws_router, prefix="/ws")


@app.get("/health")
async def health_check():
    """Backward-compatible liveness endpoint."""
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/health/live")
async def health_live():
    """Process liveness; does not touch external dependencies."""
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready():
    """Readiness for traffic: both PostgreSQL and Redis must respond."""
    try:
        async with async_session_factory() as db:
            await db.execute(text("SELECT 1"))
        if not await redis_client.ping():
            raise RuntimeError("Redis ping returned false")
    except Exception:
        logger.exception("Readiness check failed")
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "ready"}
