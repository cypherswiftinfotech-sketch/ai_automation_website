"""
Authentication middleware — extracts and validates session tokens from requests.
Injects the authenticated user into the request state.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.auth_service import validate_session

logger = logging.getLogger(__name__)

# HTTPBearer extracts "Authorization: Bearer <token>" header
security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Dependency that extracts and validates the Bearer token.
    Returns the authenticated user dict.
    Raises 401 if token is missing or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = validate_session(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    Dependency that optionally extracts the user.
    Returns None if no token is provided (allows unauthenticated access).
    """
    if not credentials:
        return None

    return validate_session(credentials.credentials)
