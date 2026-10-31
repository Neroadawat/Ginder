"""Grant/revoke Admin for an existing account; optionally create a dedicated account."""

import argparse
import asyncio
import getpass

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import async_session_factory, engine
from app.core.security import hash_password
from app.models.admin import AdminSession
from app.models.user import User


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Ginder Admin")
    parser.add_argument("--create", action="store_true", help="Create a missing account")
    parser.add_argument("--revoke", action="store_true")
    parser.add_argument("--production", action="store_true", help="Explicitly target production")
    args = parser.parse_args()
    if settings.APP_ENV == "production" and not args.production:
        parser.error("Production changes require --production")
    email = str(TypeAdapter(EmailStr).validate_python(args.email)).lower()
    try:
        async with async_session_factory() as db:
            user = await db.scalar(
                select(User).where(func.lower(User.email) == email).with_for_update()
            )
            if user is None:
                if not args.create or args.revoke:
                    parser.error("Account not found; use --create for a dedicated administrator")
                password = getpass.getpass("New Admin password (at least 12 characters): ")
                if len(password) < 12 or len(password) > 128:
                    parser.error("Use a password between 12 and 128 characters")
                if password != getpass.getpass("Confirm password: "):
                    parser.error("Passwords do not match")
                user = User(
                    email=email, display_name=args.name, hashed_password=hash_password(password)
                )
                db.add(user)
                await db.flush()
            user.is_admin = not args.revoke
            await db.execute(delete(AdminSession).where(AdminSession.user_id == user.id))
            await db.commit()
            print(
                "Admin access revoked."
                if args.revoke
                else "Admin access granted. Sessions cleared."
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
