import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Optional

from config import get_env_stripped

logger = logging.getLogger(__name__)


def _get_admin_credentials():
    username = get_env_stripped("ADMIN_USERNAME")
    password = get_env_stripped("ADMIN_PASSWORD")
    return username, password


def _get_admin_token_secret() -> str:
    """Secret used to sign admin tokens.

    Falls back to ADMIN_PASSWORD if ADMIN_TOKEN_SECRET is not set so existing
    setups keep working. If neither is configured we generate one at runtime —
    this still produces valid signed tokens for the lifetime of the process,
    but they will be invalidated on restart, which is the safe default for a
    misconfigured deploy.
    """
    secret = get_env_stripped("ADMIN_TOKEN_SECRET")
    if secret:
        return secret
    pwd = get_env_stripped("ADMIN_PASSWORD")
    if pwd:
        return pwd
    # last-resort ephemeral secret for the process lifetime
    return secrets.token_urlsafe(32)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("ascii"))


def verify_admin_credentials(username: str, password: str) -> bool:
    """Verify admin username/password against env vars."""
    expected_username, expected_password = _get_admin_credentials()

    logger.info(f"verify_admin_credentials called with username={username}, password={password}")
    logger.info(f"Expected: username={expected_username}, password={expected_password}")

    if not expected_username or not expected_password:
        # If not configured, treat admin as disabled.
        return False

    return username == expected_username and password == expected_password


def generate_admin_token(username: str, ttl_seconds: int = 24 * 3600) -> str:
    """Mint a signed bearer token bound to the admin user.

    Format: <b64url(header)>.<b64url(payload)>.<b64url(signature)>
    where signature = HMAC-SHA256(secret, "<header>.<payload>").
    """
    secret = _get_admin_token_secret()
    header = {"alg": "HS256", "typ": "admin"}
    payload = {
        "sub": username,
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl_seconds,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def verify_admin_token(token: str) -> Optional[str]:
    """Verify a signed admin token and return the username if valid.

    Returns None on any failure (bad signature, expired, malformed).
    """
    if not token:
        return None

    parts = token.split(".")
    if len(parts) != 3:
        return None

    header_b64, payload_b64, signature_b64 = parts

    secret = _get_admin_token_secret()
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        given_sig = _b64url_decode(signature_b64)
    except Exception:
        return None

    if not hmac.compare_digest(expected_sig, given_sig):
        return None

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return None

    exp = payload.get("exp")
    if exp is None or int(time.time()) >= int(exp):
        return None

    sub = payload.get("sub")
    if not sub:
        return None

    # Bind to the configured admin username so a stolen token from a previous
    # operator can't impersonate the current admin.
    expected_username, _ = _get_admin_credentials()
    if expected_username and sub != expected_username:
        return None

    return str(sub)
