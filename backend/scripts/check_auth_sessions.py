"""Isolated PostgreSQL migration/rotation drill. Never modifies the live database.

Creates a uniquely named temporary database using the configured database role,
runs migrations and auth checks there, then drops only that created database.
Requires CREATEDB privilege. Prints no credentials or tokens.
"""

import asyncio
import os
import subprocess
import sys
import uuid

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.exceptions import UnauthorizedException
from app.core.security import create_password_reset_token, decode_token
from app.models.auth_session import AuthSession
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, ResetPasswordRequest, SignUpRequest
from app.services.auth_service import AuthService


async def main() -> None:
    database_name = "ginder_auth_check_" + uuid.uuid4().hex
    live_url = make_url(settings.DATABASE_URL)
    test_url = live_url.set(database=database_name)
    assert database_name.startswith("ginder_auth_check_") and test_url.database != live_url.database
    admin = create_async_engine(live_url, isolation_level="AUTOCOMMIT")
    engine = create_async_engine(test_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    created = False
    try:
        async with admin.connect() as connection:
            await connection.execute(text(f'CREATE DATABASE "{database_name}"'))
            created = True
        env = {**os.environ, "DATABASE_URL": test_url.render_as_string(hide_password=False)}
        for command in [("upgrade", "head"), ("downgrade", "0005"), ("upgrade", "head")]:
            result = subprocess.run(
                [sys.executable, "-m", "alembic", *command], env=env,
                capture_output=True, text=True,
            )
            if result.returncode:
                # Avoid dumping subprocess environment/connection errors with secrets.
                raise RuntimeError(f"Isolated migration {command} failed")
        print("Migration upgrade/downgrade/upgrade: PASS")

        async with sessions.begin() as db:
            first = await AuthService(db).signup(SignUpRequest(
                email="auth-drill@example.org", password="isolated-drill-password",
                display_name="Temporary auth drill", accepted_terms=True,
            ))
        user_id = uuid.UUID(decode_token(first.access_token)["sub"])
        async with sessions.begin() as db:
            second = await AuthService(db).login(LoginRequest(
                email="auth-drill@example.org", password="isolated-drill-password",
            ))

        async def refresh(token):
            async with sessions.begin() as db:
                return await AuthService(db).refresh(RefreshTokenRequest(refresh_token=token))

        rotated = await refresh(first.refresh_token)
        assert rotated.refresh_token != first.refresh_token
        try:
            await refresh(first.refresh_token)
        except UnauthorizedException:
            pass
        else:
            raise AssertionError("Replay accepted")
        try:
            await refresh(rotated.refresh_token)
        except UnauthorizedException:
            pass
        else:
            raise AssertionError("Replayed family still active")
        second = await refresh(second.refresh_token)
        print("Rotation, persisted replay revocation, other login isolation: PASS")

        async with sessions.begin() as db:
            await AuthService(db).logout(RefreshTokenRequest(refresh_token=second.refresh_token))
        async with sessions.begin() as db:
            try:
                await get_current_user(
                    HTTPAuthorizationCredentials(scheme="Bearer", credentials=second.access_token),
                    db,
                )
            except HTTPException as error:
                assert error.status_code == 401
            else:
                raise AssertionError("Logged-out access token accepted")
        print("Logout invalidates access and refresh: PASS")

        async with sessions.begin() as db:
            third = await AuthService(db).login(LoginRequest(
                email="auth-drill@example.org", password="isolated-drill-password",
            ))
        results = await asyncio.gather(
            refresh(third.refresh_token), refresh(third.refresh_token), return_exceptions=True
        )
        assert sum(isinstance(result, UnauthorizedException) for result in results) == 1
        successful = next(result for result in results if not isinstance(result, BaseException))
        try:
            await refresh(successful.refresh_token)
        except UnauthorizedException:
            pass
        else:
            raise AssertionError("Concurrent replay family still active")
        print("Concurrent refresh serialization and replay detection: PASS")

        async with sessions.begin() as db:
            fourth = await AuthService(db).login(LoginRequest(
                email="auth-drill@example.org", password="isolated-drill-password",
            ))
            user = await db.get(User, user_id)
            reset_token = create_password_reset_token(
                str(user.id), user.hashed_password, user.token_version
            )
            await AuthService(db).reset_password(ResetPasswordRequest(
                token=reset_token, new_password="changed-isolated-drill-password"
            ))
        try:
            await refresh(fourth.refresh_token)
        except UnauthorizedException:
            pass
        else:
            raise AssertionError("Password reset did not invalidate refresh")
        async with sessions.begin() as db:
            await db.execute(delete(User).where(User.id == user_id))
            assert not (await db.execute(select(AuthSession.id))).all()
        print("Password-reset invalidation and account-delete cascade: PASS")
    finally:
        await engine.dispose()
        if created:
            async with admin.connect() as connection:
                await connection.execute(text(f'DROP DATABASE "{database_name}" WITH (FORCE)'))
            print("Isolated temporary database removed; live schema unchanged")
        await admin.dispose()


if __name__ == "__main__":
    asyncio.run(main())
