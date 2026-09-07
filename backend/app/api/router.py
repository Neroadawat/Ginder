"""Main API router — aggregates all sub-routers."""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    friends,
    history,
    notifications,
    restaurants,
    sessions,
    users,
    votes,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(friends.router, prefix="/friends", tags=["Friends"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["Restaurants"])
api_router.include_router(votes.router, prefix="/votes", tags=["Votes"])
api_router.include_router(history.router, prefix="/history", tags=["History"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
