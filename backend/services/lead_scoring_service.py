"""
Lead scoring — computes score deltas from LLM-extracted signals.
"""

from services.lead_service import score_to_status

SIGNAL_WEIGHTS = {
    "pain": 8,
    "budget_hint": 10,
    "timeline_hint": 7,
    "authority_hint": 8,
}

INTENT_STRENGTH_BONUS = {
    "low": 2,
    "medium": 5,
    "high": 10,
    None: 0,
}


def compute_score_delta(signals: dict, llm_delta: int) -> int:
    """Combine LLM-provided delta with rule-based signal weights."""
    delta = max(0, min(25, int(llm_delta or 0)))

    for field, weight in SIGNAL_WEIGHTS.items():
        if signals.get(field):
            delta += weight

    intent_bonus = INTENT_STRENGTH_BONUS.get(signals.get("intent_strength"))
    delta += intent_bonus

    return max(0, min(25, delta))


def apply_score(current_score: int, delta: int) -> int:
    return max(0, min(100, current_score + delta))


def resolve_status(score: int, intent: str, current_status: str) -> str:
    if intent == "escalate":
        return "escalated"
    if intent == "book_meeting" and score >= 50:
        return "hot"
    if current_status in ("booked", "escalated"):
        return current_status
    return score_to_status(score)
