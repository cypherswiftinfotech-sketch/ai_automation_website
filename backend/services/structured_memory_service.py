"""
Structured memory — builds rich context blocks for the consultant LLM.
Includes cross-session summaries and qualification gaps.
"""

import logging
from typing import Optional

from config import supabase
from services.stage_machine_service import missing_qualify_fields

logger = logging.getLogger(__name__)

_IN_MEMORY_SUMMARIES: dict[str, list[str]] = {}


def fetch_past_summaries(
    user_id: str,
    exclude_conversation_id: Optional[str] = None,
    limit: int = 1,
) -> list[str]:
    """Return summaries from prior ended conversations for this user."""
    if not supabase:
        return _IN_MEMORY_SUMMARIES.get(user_id, [])[:limit]

    try:
        query = (
            supabase.table("conversations")
            .select("id, summary, title")
            .eq("user_id", user_id)
            .eq("status", "ended")
            .not_.is_("summary", "null")
            .order("ended_at", desc=True)
            .limit(limit + 1)
        )
        result = query.execute()
        summaries = []
        for row in result.data or []:
            if exclude_conversation_id and row.get("id") == exclude_conversation_id:
                continue
            text = row.get("summary") or row.get("title")
            if text:
                summaries.append(text)
            if len(summaries) >= limit:
                break
        return summaries
    except Exception as e:
        logger.warning(f"Failed to fetch past summaries: {e}")
        return _IN_MEMORY_SUMMARIES.get(user_id, [])[:limit]


def build_structured_memory_block(
    *,
    user_id: str,
    conversation_id: str,
    qualified_fields: dict,
    objections: list,
    questions_asked: list,
    topics_discussed: list,
    stage_history: list,
    history_text: str,
) -> str:
    """Assemble structured memory context for the system prompt."""
    parts = []

    past = fetch_past_summaries(user_id, exclude_conversation_id=conversation_id)
    if past:
        parts.append("Prior sessions with this user:")
        for i, summary in enumerate(past, 1):
            parts.append(f"  {i}. {summary}")

    missing = missing_qualify_fields(qualified_fields)
    if missing:
        parts.append(f"\nQualification gaps (still need): {', '.join(missing)}")

    if qualified_fields:
        filled = {k: v for k, v in qualified_fields.items() if v}
        if filled:
            parts.append(f"Known about this lead: {filled}")

    if objections:
        parts.append(f"Objections raised: {'; '.join(objections[-5:])}")

    if questions_asked:
        parts.append("Questions already asked (do NOT repeat):")
        for q in questions_asked[-5:]:
            parts.append(f"  - {q}")

    if topics_discussed:
        parts.append(f"Topics covered this session: {', '.join(topics_discussed[-5:])}")

    if stage_history:
        path = " → ".join(entry["stage"] for entry in stage_history[-5:])
        parts.append(f"Stage path so far: {path}")

    if history_text:
        parts.append(f"\nRecent messages:\n{history_text}")

    return "\n".join(parts) if parts else history_text
