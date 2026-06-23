"""
Lead service — tracks per-conversation lead profile, stage, and scoring state.
Falls back to in-memory storage when Supabase is unavailable.
"""

import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional

from config import supabase

logger = logging.getLogger(__name__)

STAGES = ("discover", "qualify", "anchor", "book", "closed")
STATUSES = ("cold", "warm", "hot", "booked", "escalated")

DEFAULT_LEAD = {
    "stage": "discover",
    "score": 0,
    "status": "cold",
    "signals": {},
    "qualified_fields": {},
    "objections": [],
}

_IN_MEMORY_LEADS: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def score_to_status(score: int) -> str:
    if score >= 60:
        return "hot"
    if score >= 31:
        return "warm"
    return "cold"


def get_lead_by_conversation(conversation_id: str) -> Optional[dict]:
    if not supabase:
        return _IN_MEMORY_LEADS.get(conversation_id)

    result = (
        supabase.table("leads")
        .select("*")
        .eq("conversation_id", conversation_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_or_create_lead(user_id: str, conversation_id: str) -> dict:
    existing = get_lead_by_conversation(conversation_id)
    if existing:
        return existing

    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        **DEFAULT_LEAD,
    }

    if not supabase:
        lead = {"id": conversation_id, **data, "created_at": _now_iso(), "updated_at": _now_iso()}
        _IN_MEMORY_LEADS[conversation_id] = lead
        return lead

    try:
        result = supabase.table("leads").insert(data).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to create lead in Supabase, using in-memory: {e}")

    lead = {"id": conversation_id, **data, "created_at": _now_iso(), "updated_at": _now_iso()}
    _IN_MEMORY_LEADS[conversation_id] = lead
    return lead


def update_lead(
    conversation_id: str,
    *,
    stage: Optional[str] = None,
    score: Optional[int] = None,
    status: Optional[str] = None,
    signals: Optional[dict] = None,
    qualified_fields: Optional[dict] = None,
    objections: Optional[list] = None,
) -> dict:
    lead = get_lead_by_conversation(conversation_id)
    if not lead:
        raise ValueError(f"No lead found for conversation {conversation_id}")

    updates: dict = {"updated_at": _now_iso()}

    if stage is not None:
        updates["stage"] = stage
    if score is not None:
        updates["score"] = max(0, min(100, score))
    if status is not None:
        updates["status"] = status
    if signals is not None:
        merged = deepcopy(lead.get("signals") or {})
        merged.update({k: v for k, v in signals.items() if v is not None})
        updates["signals"] = merged
    if qualified_fields is not None:
        merged = deepcopy(lead.get("qualified_fields") or {})
        merged.update({k: v for k, v in qualified_fields.items() if v is not None})
        updates["qualified_fields"] = merged
    if objections is not None:
        updates["objections"] = objections

    if not supabase:
        lead.update(updates)
        _IN_MEMORY_LEADS[conversation_id] = lead
        return lead

    try:
        result = (
            supabase.table("leads")
            .update(updates)
            .eq("conversation_id", conversation_id)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to update lead in Supabase, using in-memory: {e}")

    lead.update(updates)
    _IN_MEMORY_LEADS[conversation_id] = lead
    return lead
