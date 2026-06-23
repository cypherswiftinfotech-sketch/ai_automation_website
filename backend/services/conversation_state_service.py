"""
Conversation state — structured per-session memory (questions asked, topics, stage history).
"""

import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional

from config import supabase

logger = logging.getLogger(__name__)

DEFAULT_STATE = {
    "turn_count": 0,
    "questions_asked": [],
    "topics_discussed": [],
    "stage_history": [],
    "last_intent": None,
}

_IN_MEMORY_STATE: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_state(conversation_id: str) -> Optional[dict]:
    if not supabase:
        return _IN_MEMORY_STATE.get(conversation_id)

    result = (
        supabase.table("conversation_state")
        .select("*")
        .eq("conversation_id", conversation_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_or_create_state(conversation_id: str) -> dict:
    existing = get_state(conversation_id)
    if existing:
        return existing

    data = {"conversation_id": conversation_id, **DEFAULT_STATE}

    if not supabase:
        state = {**data, "updated_at": _now_iso()}
        _IN_MEMORY_STATE[conversation_id] = state
        return state

    try:
        result = supabase.table("conversation_state").insert(data).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to create conversation_state, using in-memory: {e}")

    state = {**data, "updated_at": _now_iso()}
    _IN_MEMORY_STATE[conversation_id] = state
    return state


def _persist(conversation_id: str, updates: dict, current: dict) -> dict:
    updates["updated_at"] = _now_iso()
    merged = {**current, **updates}

    if not supabase:
        _IN_MEMORY_STATE[conversation_id] = merged
        return merged

    try:
        result = (
            supabase.table("conversation_state")
            .update(updates)
            .eq("conversation_id", conversation_id)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to update conversation_state: {e}")

    _IN_MEMORY_STATE[conversation_id] = merged
    return merged


def record_turn(
    conversation_id: str,
    *,
    intent: str,
    stage: str,
    assistant_message: str,
    user_query: str,
) -> dict:
    state = get_or_create_state(conversation_id)
    turn_count = int(state.get("turn_count") or 0) + 1

    questions = list(state.get("questions_asked") or [])
    if intent == "qualify" and "?" in assistant_message:
        q = assistant_message.strip()
        if q not in questions:
            questions.append(q[:200])

    topics = list(state.get("topics_discussed") or [])
    topic_hint = user_query.strip()[:80]
    if topic_hint and topic_hint not in topics:
        topics.append(topic_hint)
    topics = topics[-10:]

    history = list(state.get("stage_history") or [])
    prev_stage = history[-1]["stage"] if history else None
    if stage != prev_stage:
        history.append({"stage": stage, "at_turn": turn_count, "at": _now_iso()})
    history = history[-20:]

    return _persist(
        conversation_id,
        {
            "turn_count": turn_count,
            "questions_asked": questions[-15:],
            "topics_discussed": topics,
            "stage_history": history,
            "last_intent": intent,
        },
        state,
    )


def get_stage_history(conversation_id: str) -> list:
    state = get_or_create_state(conversation_id)
    return state.get("stage_history") or []
