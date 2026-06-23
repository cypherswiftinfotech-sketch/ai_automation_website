"""
Query service — thin wrapper around the consultant intelligence layer.
"""

from services.consultant_service import ConsultantTurnResult, process_turn


async def answer_query(
    user_id: str,
    conversation_id: str,
    query: str,
    language: str = "en",
    timezone_str: str = "UTC",
) -> ConsultantTurnResult:
    return await process_turn(user_id, conversation_id, query, language, timezone_str)
