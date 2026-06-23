"""
Authentication service — handles user registration, login, session management.
Uses bcrypt for password hashing and opaque tokens for session tracking.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt

from config import supabase

logger = logging.getLogger(__name__)

# Session token validity (7 days)
SESSION_EXPIRY_HOURS = 168


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        return False


def _generate_session_token() -> str:
    """Generate a cryptographically secure session token."""
    return secrets.token_urlsafe(48)


def _hash_token(token: str) -> str:
    """Hash a session token for storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── Registration ────────────────────────────────────────────


def register_user(
    name: str, email: str, password: str
) -> dict:
    """
    Create a new user with hashed password.
    Returns the created user dict or raises ValueError if email exists.
    """
    if not supabase:
        raise RuntimeError("Database is not configured.")

    # Check if email already exists
    existing = (
        supabase.table("users")
        .select("id")
        .eq("email", email)
        .execute()
    )
    if existing.data:
        raise ValueError("A user with this email already exists.")

    hashed = hash_password(password)
    new_user = {
        "name": name,
        "email": email,
        "password_hash": hashed,
        "is_active": True,
    }

    result = supabase.table("users").insert(new_user).execute()
    if not result.data:
        raise RuntimeError("Failed to create user.")

    user = result.data[0]
    logger.info(f"Registered new user: {user['id']} ({email})")
    return user


# ── Login ───────────────────────────────────────────────────


def login_user(
    email: str,
    password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Authenticate user credentials and create a session.
    Returns {"user": {...}, "token": "...", "expires_at": "..."}.
    Raises ValueError on bad credentials.
    """
    if not supabase:
        raise RuntimeError("Database is not configured.")

    # Fetch user by email
    result = (
        supabase.table("users")
        .select("*")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        raise ValueError("Invalid email or password.")

    user = result.data[0]

    # Check if account is active
    if not user.get("is_active", True):
        raise ValueError("This account has been deactivated.")

    # Verify password
    stored_hash = user.get("password_hash")
    if not stored_hash or not verify_password(password, stored_hash):
        raise ValueError("Invalid email or password.")

    # Generate session token
    raw_token = _generate_session_token()
    hashed_token = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)

    session_data = {
        "user_id": user["id"],
        "token": hashed_token,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "expires_at": expires_at.isoformat(),
    }

    supabase.table("sessions").insert(session_data).execute()

    # Update last_login_at
    supabase.table("users").update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user["id"]).execute()

    logger.info(f"User logged in: {user['id']} ({email})")

    # Return the raw token (not the hash) — client stores this
    return {
        "user": {
            "id": user["id"],
            "name": user.get("name"),
            "email": user.get("email"),
        },
        "token": raw_token,
        "expires_at": expires_at.isoformat(),
    }


# ── Session Validation ─────────────────────────────────────


def validate_session(token: str) -> Optional[dict]:
    """
    Validate a session token and return the associated user.
    Returns None if the token is invalid or expired.
    """
    if not supabase:
        return None

    hashed_token = _hash_token(token)

    result = (
        supabase.table("sessions")
        .select("*, users(*)")
        .eq("token", hashed_token)
        .execute()
    )

    if not result.data:
        return None

    session = result.data[0]

    # Check expiry
    expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        # Clean up expired session
        supabase.table("sessions").delete().eq("id", session["id"]).execute()
        return None

    user = session.get("users")
    if not user or not user.get("is_active", True):
        return None

    return user


# ── Logout ──────────────────────────────────────────────────


def logout_user(token: str) -> bool:
    """Invalidate a session by deleting it. Returns True if a session was found."""
    if not supabase:
        return False

    hashed_token = _hash_token(token)
    result = (
        supabase.table("sessions")
        .delete()
        .eq("token", hashed_token)
        .execute()
    )
    deleted = bool(result.data)
    if deleted:
        logger.info("Session invalidated successfully.")
    return deleted


def logout_all_sessions(user_id: str) -> int:
    """Invalidate all sessions for a user. Returns count of deleted sessions."""
    if not supabase:
        return 0

    result = (
        supabase.table("sessions")
        .delete()
        .eq("user_id", user_id)
        .execute()
    )
    count = len(result.data) if result.data else 0
    logger.info(f"Invalidated {count} sessions for user {user_id}")
    return count
