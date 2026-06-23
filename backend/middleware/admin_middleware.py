from typing import Optional

from fastapi import HTTPException, Request, status


def get_admin_token_from_header(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def require_admin(request: Request) -> str:
    """Require a valid admin bearer token and return the admin username.

    Accepts:
      1. A signed token issued by services.admin_auth_service.generate_admin_token
         (bound to the configured ADMIN_USERNAME and expirable).
      2. A legacy shared secret matching ADMIN_TOKEN env var, for backward
         compatibility with existing deployments.

    Returns 401 on any failure (missing header, bad signature, expired,
    unknown user). Returns the admin username on success.
    """
    from services.admin_auth_service import verify_admin_token

    token = get_admin_token_from_header(request)

    if token:
        username = verify_admin_token(token)
        if username:
            return username

    # Legacy fallback: ADMIN_TOKEN shared secret. Only honored when explicitly
    # configured so misconfigured deployments don't accept arbitrary tokens.
    from config import get_env_stripped

    legacy = get_env_stripped("ADMIN_TOKEN")
    if legacy and token == legacy:
        return get_env_stripped("ADMIN_USERNAME") or "admin"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
