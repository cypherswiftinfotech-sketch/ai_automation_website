"""
Stage machine — enforces valid stage transitions for the consultant flow.
Stages: discover → qualify → anchor → book → closed
"""

from services.settings_service import get_settings

STAGE_ORDER = ("discover", "qualify", "anchor", "book", "closed")
QUALIFY_FIELDS = ("company_size", "role", "budget", "timeline")


def _stage_index(stage: str) -> int:
    try:
        return STAGE_ORDER.index(stage)
    except ValueError:
        return 0


def _max_stage(a: str, b: str) -> str:
    return a if _stage_index(a) >= _stage_index(b) else b


def count_qualified_fields(qualified_fields: dict) -> int:
    return sum(
        1 for field in QUALIFY_FIELDS
        if qualified_fields.get(field) not in (None, "", "null")
    )


def missing_qualify_fields(qualified_fields: dict) -> list[str]:
    return [
        field for field in QUALIFY_FIELDS
        if qualified_fields.get(field) in (None, "", "null")
    ]


def resolve_stage(
    current_stage: str,
    llm_suggested: str,
    *,
    qualified_fields: dict,
    lead_score: int,
    turn_count: int,
    signals: dict,
    intent: str,
    meeting_booked: bool = False,
) -> str:
    """Compute the authoritative stage after a turn."""
    if meeting_booked:
        return "closed"

    current = current_stage if current_stage in STAGE_ORDER else "discover"
    settings = get_settings()
    book_threshold = int(settings.get("book_meeting_threshold", 60))

    filled = count_qualified_fields(qualified_fields)
    has_pain = bool(signals.get("pain"))

    # Rule-based minimum stage from conversation progress
    auto_stage = current

    if current == "discover" and (turn_count >= 2 or has_pain):
        auto_stage = "qualify"

    if filled >= 2 or (filled >= 1 and lead_score >= 35):
        auto_stage = _max_stage(auto_stage, "qualify")

    if filled >= 2 and (has_pain or lead_score >= 30):
        auto_stage = _max_stage(auto_stage, "anchor")

    if filled >= 3 and lead_score >= book_threshold - 10:
        auto_stage = _max_stage(auto_stage, "book")

    if intent == "book_meeting" and lead_score >= book_threshold - 15:
        auto_stage = _max_stage(auto_stage, "book")

    # LLM may suggest at most one stage forward from current
    llm_stage = llm_suggested if llm_suggested in STAGE_ORDER else current
    llm_idx = _stage_index(llm_stage)
    current_idx = _stage_index(current)

    if llm_idx <= current_idx:
        llm_capped = current
    elif llm_idx == current_idx + 1:
        llm_capped = llm_stage
    else:
        llm_capped = STAGE_ORDER[current_idx + 1]

    final = _max_stage(auto_stage, llm_capped)

    # Never regress past discover unless closed
    if _stage_index(final) < _stage_index(current) and current != "closed":
        final = current

    return final
