import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

from config import supabase

logger = logging.getLogger(__name__)


# Save settings.json in the backend directory as a fallback for environments
# without Supabase (e.g. local dev, CI).
SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

# IMPORTANT:
# Used as the final fallback when neither Supabase nor settings.json is
# available. Do NOT hardcode a specific avatar identity in a way that would
# override admin changes.
DEFAULT_SETTINGS: dict[str, Any] = {
    "avatar_name": "Avor",
    "avatar_intro": "Hello {user_name}, I'm {avatar_name}. I help organizations explore AI automation, marketing and sales systems, AI agents, revenue operations, and business growth opportunities. How may I assist you today?",
    "system_prompt": "You are a helpful, friendly AI avatar consultant.\nAnswer the user's question using only the provided knowledge base context.\nIf the context does not contain the answer, say you don't have that information.\nKeep answers concise and conversational — they will be spoken aloud by an avatar.",
    "consultant_playbook": "",
    "qualification_questions": [],
    "escalation_threshold": 75,
    "book_meeting_threshold": 60,
}


# In-process cache to avoid hitting Supabase on every LLM turn.
_CACHE_TTL_SECONDS = 30
_cache: dict[str, Any] = {"data": None, "expires_at": 0.0}


def _from_file() -> dict[str, Any]:
    if not SETTINGS_FILE.exists():
        return DEFAULT_SETTINGS.copy()
    try:
        with open(SETTINGS_FILE, "r") as f:
            settings = json.load(f)
        for k, v in DEFAULT_SETTINGS.items():
            if k not in settings:
                settings[k] = v
        return settings
    except Exception as e:
        logger.warning("Failed to read settings.json: %s", e)
        return DEFAULT_SETTINGS.copy()


def _to_file(settings: dict[str, Any]) -> None:
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=4)


def _normalize(row: dict[str, Any]) -> dict[str, Any]:
    """Coerce a Supabase row into the canonical settings dict shape."""
    out = DEFAULT_SETTINGS.copy()
    for key in DEFAULT_SETTINGS:
        if key in row and row[key] is not None:
            out[key] = row[key]
    # Carry over audit fields when present.
    out["updated_at"] = row.get("updated_at")
    out["updated_by"] = row.get("updated_by")
    return out


def _from_supabase() -> Optional[dict[str, Any]]:
    if supabase is None:
        return None
    try:
        res = (
            supabase.table("global_settings")
            .select("*")
            .eq("id", 1)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        return _normalize(rows[0])
    except Exception as e:
        logger.warning("Failed to read global_settings from Supabase: %s", e)
        return None


def get_settings() -> dict[str, Any]:
    """Read avatar settings.

    Order:
      1. In-process cache (30s TTL) — fastest, used inside one turn's prompt.
      2. Supabase `global_settings` — durable, shared across restarts.
      3. backend/settings.json — fallback for local dev without Supabase.
      4. DEFAULT_SETTINGS — last resort.
    """
    now = time.time()
    if _cache["data"] is not None and _cache["expires_at"] > now:
        return _cache["data"]

    settings = _from_supabase() or _from_file()

    _cache["data"] = settings
    _cache["expires_at"] = now + _CACHE_TTL_SECONDS
    return settings


def _invalidate_cache() -> None:
    _cache["data"] = None
    _cache["expires_at"] = 0.0


def update_settings(new_settings: dict[str, Any], *, updated_by: Optional[str] = None) -> dict[str, Any]:
    """Persist avatar settings permanently.

    Tries Supabase first (the durable, globally-shared store). Falls back to
    settings.json when Supabase is not configured so dev mode keeps working.
    """
    # Compose the payload so partial updates don't wipe fields we don't know about.
    base = get_settings()
    merged = {**base, **{k: v for k, v in new_settings.items() if v is not None}}

    db_payload = {
        "id": 1,
        "avatar_name": merged.get("avatar_name") or DEFAULT_SETTINGS["avatar_name"],
        "avatar_intro": merged.get("avatar_intro") or DEFAULT_SETTINGS["avatar_intro"],
        "system_prompt": merged.get("system_prompt") or DEFAULT_SETTINGS["system_prompt"],
        "consultant_playbook": merged.get("consultant_playbook") or "",
        "qualification_questions": merged.get("qualification_questions") or [],
        "escalation_threshold": int(merged.get("escalation_threshold") or DEFAULT_SETTINGS["escalation_threshold"]),
        "book_meeting_threshold": int(merged.get("book_meeting_threshold") or DEFAULT_SETTINGS["book_meeting_threshold"]),
    }
    if updated_by:
        db_payload["updated_by"] = updated_by

    persisted_from_db = False
    if supabase is not None:
        try:
            # upsert on id=1 so it works whether or not the seed row exists
            supabase.table("global_settings").upsert(db_payload, on_conflict="id").execute()
            persisted_from_db = True
        except Exception as e:
            logger.error("Failed to write global_settings to Supabase: %s", e)

    if not persisted_from_db:
        # File fallback (dev mode without Supabase).
        file_payload = {k: v for k, v in db_payload.items() if k != "id" and k != "updated_by"}
        file_payload["updated_by"] = updated_by
        _to_file(file_payload)

    _invalidate_cache()

    # Return the canonical view of the saved settings (from DB if possible).
    return _from_supabase() or _from_file()
