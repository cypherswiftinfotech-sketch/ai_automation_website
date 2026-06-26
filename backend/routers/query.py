from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from models.schemas import QueryRequest, QueryResponse
from services.query_service import answer_query
from middleware.auth_middleware import get_current_user, get_optional_user
from services.conversation_service import get_or_create_conversation, end_conversation
from services.lead_service import get_or_create_lead, get_lead_by_conversation, update_lead
from services.booking_service import format_confirmation_message, mark_lead_booked, save_booking
from services.calendar_service import book_slot

router = APIRouter(prefix="/query", tags=["query"])

from pydantic import BaseModel as _BaseModel

class InitSessionRequest(_BaseModel):
    user_id: str
    language: str = "en"
    pre_chat_data: dict = {}

@router.post("/init")
async def init_session(
    body: InitSessionRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    user_id = current_user["id"] if current_user else body.user_id
    conv = get_or_create_conversation(user_id=user_id, language=body.language)
    
    lead = get_or_create_lead(user_id, conv["id"])
    if body.pre_chat_data:
        update_lead(conv["id"], qualified_fields=body.pre_chat_data)
        
        from config import supabase
        if supabase:
            try:
                form_data = body.pre_chat_data.copy()
                form_data["conversation_id"] = conv["id"]
                # We intentionally do NOT insert user_id to bypass the auth.users 
                # foreign key constraint error, since conversation_id is enough to link it.
                supabase.table("login_form_info").insert(form_data).execute()
            except Exception as e:
                import logging
                logging.error(f"Failed to insert into login_form_info: {e}")

    return {"conversation_id": conv["id"]}



@router.post("/ask", response_model=QueryResponse)
async def ask(
    body: QueryRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    # Use authenticated user if present, otherwise fall back to provided ID
    user_id = current_user["id"] if current_user else body.user_id

    try:
        if body.conversation_id:
            conv_id = body.conversation_id
        else:
            conv = get_or_create_conversation(user_id=user_id, language=body.language)
            conv_id = conv["id"]

        result = await answer_query(
            user_id, conv_id, body.query, body.language, body.timezone or "UTC"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(
        answer=result.answer,
        user_id=user_id,
        conversation_id=conv_id,
        intent=result.intent,
        lead_score=result.lead_score,
        stage=result.stage,
        status=result.status,
        score_delta=result.score_delta,
        ui_action=result.ui_action,
    )


@router.post("/end-session")
async def end_session(user_id: str, conversation_text: str = "", conversation_id: str = ""):
    """
    Deprecated: Call POST /conversations/{id}/end instead.
    This remains for backwards compatibility if the frontend hasn't been updated.
    """
    if conversation_id:
        try:
            await end_conversation(conversation_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return {"message": "Session summary saved (via conversation service)."}
    
    # If no conversation_id, we can't do much with the new system easily without it.
    return {"message": "Session ended. Please migrate to /conversations/{id}/end endpoint."}


from config import anthropic_client

class TranslateIntroRequest(_BaseModel):
    text: str
    target_language: str


@router.post("/translate-intro")
async def translate_intro(body: TranslateIntroRequest):
    """
    Translate the avatar's greeting into the user's selected language.
    Uses the LLM for high-quality, natural-sounding translations.
    """
    if not anthropic_client:
        raise HTTPException(status_code=500, detail="AI service not configured.")

    # For English or Multilingual, just return the original text
    if body.target_language in ("en", "multi", ""):
        return {"translated": body.text}

    try:
        response = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=(
                "You are a professional translator. Translate the following greeting text "
                f"into the language with code '{body.target_language}'. "
                "Keep it natural, warm, and conversational — it will be spoken aloud by an avatar. "
                "Return ONLY the translated text, nothing else."
            ),
            messages=[{"role": "user", "content": body.text}],
        )
        translated = response.content[0].text.strip()
        return {"translated": translated}
    except Exception as e:
        # On failure, return original text so the intro still works
        return {"translated": body.text}


class BookMeetingRequest(_BaseModel):
    """Anon-friendly booking completion for the embedded chat widget.

    The chat collects the user's name/email through conversation; the LLM
    mirrors them into lead.qualified_fields. /scheduling/book stays protected
    and requires an authenticated session — this endpoint is the chat's path
    that uses the lead record as the source of truth for attendee info.
    """
    conversation_id: str
    slot_id: str
    slot_start: str
    slot_end: str
    timezone: str = "UTC"


@router.post("/book-meeting")
async def book_meeting_anon(
    body: BookMeetingRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    lead = get_lead_by_conversation(body.conversation_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    qualified = lead.get("qualified_fields") or {}
    # Accept either of the common key shapes the LLM has been observed to use.
    name = qualified.get("name") or qualified.get("full_name") or qualified.get("contact_name")
    email = qualified.get("email") or qualified.get("business_mail")
    if not name or not email:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot book yet — name and email haven't been captured in this "
                "conversation. Please share them with the assistant first."
            ),
        )

    try:
        start = datetime.fromisoformat(body.slot_start.replace("Z", "+00:00"))
        end = datetime.fromisoformat(body.slot_end.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid slot datetime: {e}")

    try:
        cal_result = await book_slot(
            body.slot_id,
            start=start,
            end=end,
            attendee_name=name,
            attendee_email=email,
            timezone_str=body.timezone,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Calendar booking failed: {e}")

    booking = save_booking(
        user_id=lead.get("user_id") or "anon",
        conversation_id=body.conversation_id,
        lead_id=lead.get("id"),
        slot_start=cal_result["slot_start"],
        slot_end=cal_result["slot_end"],
        timezone_str=body.timezone,
        attendee_email=email,
        attendee_name=name,
        external_booking_id=cal_result["external_booking_id"],
    )
    mark_lead_booked(body.conversation_id)

    try:
        local_label = start.astimezone(ZoneInfo(body.timezone)).strftime("%a %b %d at %I:%M %p")
    except Exception:
        local_label = start.strftime("%a %b %d at %I:%M %p")

    return {
        "booking": booking,
        "message": format_confirmation_message(local_label, name),
        "stage": "closed",
        "status": "booked",
    }


@router.get("/lead/{conversation_id}")
async def get_lead_for_chat(
    conversation_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    """Return the lead's qualified_fields so the chat widget can render
    a 'verify your info' summary card before finalising a booking.

    Only returns the captured contact fields — never scoring, signals, or
    stage data, since the embedded chat is unauthenticated.
    """
    lead = get_lead_by_conversation(conversation_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    qualified = lead.get("qualified_fields") or {}
    return {
        "conversation_id": conversation_id,
        "qualified_fields": {
            "name": qualified.get("name") or qualified.get("full_name") or qualified.get("contact_name"),
            "email": qualified.get("email") or qualified.get("business_mail"),
            "phone": qualified.get("phone") or qualified.get("calling_whatsapp_number"),
            "company_name": qualified.get("company_name") or qualified.get("company"),
            "role": qualified.get("role") or qualified.get("role_designation"),
            "industry_type": qualified.get("industry_type") or qualified.get("industry"),
            "budget_range": qualified.get("budget_range") or qualified.get("budget"),
            "expected_timeline": qualified.get("expected_timeline") or qualified.get("timeline"),
        },
    }

