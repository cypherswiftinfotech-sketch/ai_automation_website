"""
Consultant service — orchestrates RAG, lead scoring, intent routing, and structured LLM output.
"""

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from config import anthropic_client, supabase
from services.booking_service import format_confirmation_message, mark_lead_booked, save_booking
from services.calendar_service import Slot, book_slot, get_available_slots
from services.conversation_service import get_conversation_messages, save_message
from services.conversation_state_service import get_or_create_state, record_turn
from services.embedding_service import embed_text
from services.intent_router import route_intent
from services.knowledge_store import search_chunks
from services.lead_scoring_service import apply_score, compute_score_delta, resolve_status
from services.lead_service import get_or_create_lead, get_lead_by_conversation, update_lead
from services.persona_service import build_system_prompt
from services.stage_machine_service import missing_qualify_fields, resolve_stage
from services.structured_memory_service import build_structured_memory_block
from services.timezone_service import resolve_timezone

logger = logging.getLogger(__name__)

TOP_K = 5
MODEL = "claude-haiku-4-5-20251001"

# In-memory cache of pending slots per conversation so the LLM can reference them
# for oral booking. Keyed by conversation_id.
_PENDING_SLOTS: dict[str, list[dict]] = {}


@dataclass
class ConsultantTurnResult:
    answer: str
    intent: str = "rag_answer"
    lead_score: int = 0
    stage: str = "discover"
    status: str = "cold"
    score_delta: int = 0
    ui_action: Optional[dict] = field(default=None)


async def _retrieve_context(query: str, *, user: dict | None = None) -> str:
    try:
        query_embedding = await embed_text(query)
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return ""

    chunks: list[str] = []
    if supabase is not None:
        try:
            result = supabase.rpc(
                "match_chunks",
                {"query_embedding": query_embedding, "match_count": TOP_K},
            ).execute()
            if result.data:
                valid_rows = [
                    row
                    for row in result.data
                    if row.get("similarity") is not None
                    and str(row["similarity"]).lower() != "nan"
                    and float(row["similarity"]) > 0.0
                ]
                chunks = [row["content"] for row in valid_rows]
            if not chunks:
                company_id = None
                try:
                    email = (user or {}).get("email")
                    if email and email.lower().endswith("@cypherswift.com"):
                        company_id = "cypherswift"
                except Exception:
                    company_id = None
                chunks = search_chunks(query_embedding, TOP_K, company_id=company_id)
        except Exception as e:
            logger.warning(f"Supabase search failed: {e}")
            chunks = search_chunks(query_embedding, TOP_K)
    else:
        chunks = search_chunks(query_embedding, TOP_K)

    if not chunks:
        return "No relevant information found."
    return "\n\n---\n\n".join(chunks)


def _parse_llm_json(raw: str) -> dict:
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse structured LLM output, using plain-text fallback")
    return {
        "intent": "rag_answer",
        "answer": raw,
        "lead_signals": {},
        "qualified_fields": {},
        "objections": [],
        "score_delta": 0,
        "next_stage": "discover",
    }


async def _build_ui_action(
    intent: str,
    ui_action_hint: Optional[dict],
    timezone_str: str,
    conversation_id: str = "",
) -> Optional[dict]:
    if intent != "book_meeting":
        return ui_action_hint

    tz = resolve_timezone(timezone_str)
    slots = await get_available_slots(tz)
    slot_dicts = [s.to_dict(tz) for s in slots]

    # Cache the slots so the LLM can reference them for oral booking on next turn
    if conversation_id:
        _PENDING_SLOTS[conversation_id] = slot_dicts

    return {
        "type": "show_slots",
        "timezone": tz,
        "message": "Pick a time that works for you",
        "slots": slot_dicts,
    }


async def process_turn(
    user_id: str,
    conversation_id: str,
    query: str,
    language: str = "en",
    timezone_str: str = "UTC",
) -> ConsultantTurnResult:
    start_time = time.time()
    save_message(conversation_id, role="user", content=query)

    lead = get_or_create_lead(user_id, conversation_id)
    conv_state = get_or_create_state(conversation_id)
    meeting_booked = lead.get("status") == "booked"

    # ── SHORT-CIRCUIT: If meeting is already booked, end immediately ──
    if meeting_booked or lead.get("stage") == "closed":
        result = ConsultantTurnResult(
            answer="Thank you, the meeting is already booked. Our team will reach out to you soon. Have a great day!",
            intent="rag_answer",
            lead_score=int(lead.get("score") or 0),
            stage="closed",
            status=lead.get("status") or "booked",
            score_delta=0,
        )
        return _finalize(conversation_id, start_time, result, lead)

    current_score = int(lead.get("score") or 0)
    current_stage = lead.get("stage") or "discover"
    current_status = lead.get("status") or "cold"
    signals = lead.get("signals") or {}
    qualified_fields = lead.get("qualified_fields") or {}
    objections = lead.get("objections") or []
    turn_count = int(conv_state.get("turn_count") or 0)

    context = await _retrieve_context(query)
    history = get_conversation_messages(conversation_id, limit=10)
    history_text = "\n".join(
        f"{m['role'].title()}: {m['content']}" for m in history if m.get("content")
    )

    structured_memory = build_structured_memory_block(
        user_id=user_id,
        conversation_id=conversation_id,
        qualified_fields=qualified_fields,
        objections=objections,
        questions_asked=conv_state.get("questions_asked") or [],
        topics_discussed=conv_state.get("topics_discussed") or [],
        stage_history=conv_state.get("stage_history") or [],
        history_text=history_text,
    )

    system_prompt = build_system_prompt(
        stage=current_stage,
        lead_score=current_score,
        lead_status=current_status,
        signals=signals,
        qualified_fields=qualified_fields,
        structured_memory=structured_memory,
        missing_fields=missing_qualify_fields(qualified_fields),
        language=language,
    )

    if anthropic_client is None:
        fallback = "I apologize, but my AI service is not configured. Please contact the administrator."
        return _finalize(conversation_id, start_time, ConsultantTurnResult(answer=fallback), lead)

    # Build pending-slots context for the LLM so it can match oral slot picks
    pending_slots_context = ""
    pending = _PENDING_SLOTS.get(conversation_id, [])
    if pending:
        slot_lines = []
        for idx, s in enumerate(pending):
            slot_lines.append(f"  Slot {idx}: {s['label']} ({s['start']} to {s['end']})")
        pending_slots_context = (
            "\n\nAvailable meeting slots currently shown to the user:\n"
            + "\n".join(slot_lines)
            + "\nIf the user picks one of these, set selected_slot_index to its index."
        )

    try:
        response = await anthropic_client.messages.create(
            model=MODEL,
            max_tokens=768,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Knowledge base context:\n{context}\n\n"
                        f"User message: {query}"
                        f"{pending_slots_context}"
                    ),
                }
            ],
        )
        raw_text = response.content[0].text
    except Exception as e:
        logger.error(f"Anthropic call failed: {e}")
        fallback = f"I apologize, but I encountered an error: {e}"
        return _finalize(conversation_id, start_time, ConsultantTurnResult(answer=fallback), lead)

    parsed = _parse_llm_json(raw_text)
    answer = parsed.get("answer") or raw_text
    llm_signals = parsed.get("lead_signals") or {}
    new_qualified = parsed.get("qualified_fields") or {}
    new_objections = parsed.get("objections") or []
    llm_delta = int(parsed.get("score_delta") or 0)

    merged_qualified = {**qualified_fields}
    merged_qualified.update({k: v for k, v in new_qualified.items() if v})
    merged_signals = {**signals}
    merged_signals.update({k: v for k, v in llm_signals.items() if v})

    score_delta = compute_score_delta(llm_signals, llm_delta)
    new_score = apply_score(current_score, score_delta)

    next_stage = resolve_stage(
        current_stage,
        parsed.get("next_stage", current_stage),
        qualified_fields=merged_qualified,
        lead_score=new_score,
        turn_count=turn_count + 1,
        signals=merged_signals,
        intent=parsed.get("intent", "rag_answer"),
        meeting_booked=meeting_booked,
    )

    intent, ui_action_hint = route_intent(
        parsed.get("intent", "rag_answer"),
        lead_score=new_score,
        stage=next_stage,
        user_query=query,
        meeting_booked=meeting_booked,
    )
    new_status = resolve_status(new_score, intent, current_status)

    # ── Oral slot booking: if the LLM selected a slot index, propose it to the frontend ──
    selected_slot_index = parsed.get("selected_slot_index")
    pending = _PENDING_SLOTS.get(conversation_id, [])
    if (
        selected_slot_index is not None
        and isinstance(selected_slot_index, int)
        and 0 <= selected_slot_index < len(pending)
        and intent == "book_meeting"
    ):
        chosen = pending[selected_slot_index]
        ui_action_hint = {
            "type": "propose_oral_booking",
            "slot": chosen,
            "message": f"Please confirm your booking details for {chosen['label']}.",
        }
        answer = f"I've selected the {chosen['label']} slot for you. Please verify and confirm your details on the screen to finalize your booking."

    ui_action = await _build_ui_action(intent, ui_action_hint, timezone_str, conversation_id)

    merged_objections = list(objections)
    for obj in new_objections:
        if obj and obj not in merged_objections:
            merged_objections.append(obj)

    updated_lead = update_lead(
        conversation_id,
        stage=next_stage,
        score=new_score,
        status=new_status,
        signals=merged_signals,
        qualified_fields=merged_qualified,
        objections=merged_objections,
    )

    record_turn(
        conversation_id,
        intent=intent,
        stage=next_stage,
        assistant_message=answer,
        user_query=query,
    )

    result = ConsultantTurnResult(
        answer=answer,
        intent=intent,
        lead_score=int(updated_lead.get("score", new_score)),
        stage=updated_lead.get("stage", next_stage),
        status=updated_lead.get("status", new_status),
        score_delta=score_delta,
        ui_action=ui_action,
    )
    return _finalize(conversation_id, start_time, result, updated_lead, intent=intent, score_delta=score_delta)


def _finalize(
    conversation_id: str,
    start_time: float,
    result: ConsultantTurnResult,
    lead: dict,
    intent: str = "rag_answer",
    score_delta: int = 0,
) -> ConsultantTurnResult:
    response_time = (time.time() - start_time) * 1000
    save_message(
        conversation_id,
        role="assistant",
        content=result.answer,
        response_time_ms=response_time,
        metadata={
            "intent": result.intent or intent,
            "lead_score": result.lead_score or lead.get("score", 0),
            "stage": result.stage or lead.get("stage", "discover"),
            "status": result.status or lead.get("status", "cold"),
            "score_delta": score_delta,
            "ui_action": result.ui_action,
        },
    )
    return result
