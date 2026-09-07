"""Custom exception classes and global exception handlers."""

from fastapi import HTTPException, status


class GinderException(HTTPException):
    """Base exception for Ginder app."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class NotFoundException(GinderException):
    """Resource not found."""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(detail=detail, status_code=status.HTTP_404_NOT_FOUND)


class UnauthorizedException(GinderException):
    """Authentication required."""

    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(GinderException):
    """Permission denied."""

    def __init__(self, detail: str = "Permission denied"):
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)


class ConflictException(GinderException):
    """Resource conflict (e.g., duplicate)."""

    def __init__(self, detail: str = "Conflict"):
        super().__init__(detail=detail, status_code=status.HTTP_409_CONFLICT)


class SessionAlreadyStartedException(GinderException):
    """Session has already started, cannot join."""

    def __init__(self):
        super().__init__(
            detail="This session has already started",
            status_code=status.HTTP_409_CONFLICT,
        )


class UserAlreadyInSessionException(GinderException):
    """User is already in an active session."""

    def __init__(self):
        super().__init__(
            detail="You are already in an active session",
            status_code=status.HTTP_409_CONFLICT,
        )
