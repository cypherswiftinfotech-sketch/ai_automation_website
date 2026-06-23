"""
Intent router — validates and finalizes the LLM's chosen intent based on lead state.
"""

from typing import Optional, Tuple

from services.settings_service import get_settings

VALID_INTENTS = ("rag_answer", "qualify", "book_meeting", "escalate")
VALID_STAGES = ("discover", "qualify", "anchor", "book", "closed")


def route_intent(
    llm_intent: str,
    *,
    lead_score: int,
    stage: str,
    user_query: str,
    meeting_booked: bool = False,
) -> Tuple[str, Optional[dict]]:
    """
    Returns (final_intent, ui_action).
    When book_meeting is confirmed, ui_action.type will be set to show_slots
    by consultant_service after fetching calendar slots.
    """
    if meeting_booked:
        return "rag_answer", None

    settings = get_settings()
    escalation_threshold = int(settings.get("escalation_threshold", 75))
    book_threshold = int(settings.get("book_meeting_threshold", 60))

    intent = llm_intent if llm_intent in VALID_INTENTS else "rag_answer"
    ui_action = None

    query_lower = user_query.lower()
    human_keywords = (
        "speak to a human", "talk to someone", "real person",
        "call me", "contact sales", "human please",
    )
    book_keywords = (
        "book a meeting", "schedule a call", "set up a meeting",
        "available times", "calendar", "book a call",
    )
    wants_human = any(kw in query_lower for kw in human_keywords)
    wants_book = any(kw in query_lower for kw in book_keywords)

    if wants_human or (intent == "escalate" and lead_score >= 40):
        return "escalate", {"type": "escalation_pending", "message": "Routing to team"}

    if wants_book or intent == "book_meeting":
        if lead_score >= book_threshold - 15 or stage in ("anchor", "book"):
            return "book_meeting", {"type": "show_slots_pending"}
        intent = "qualify"

    if lead_score >= escalation_threshold and intent == "qualify":
        return "escalate", {"type": "escalation_pending", "message": "Hot lead — notify team"}

    if intent == "escalate" and lead_score < 40:
        intent = "qualify"

    return intent, ui_action


def normalize_stage(next_stage: str, current_stage: str) -> str:
    """Legacy helper — prefer stage_machine_service.resolve_stage."""
    if next_stage in VALID_STAGES:
        return next_stage
    return current_stage
