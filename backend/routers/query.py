from fastapi import APIRouter, Depends, HTTPException
from models.schemas import QueryRequest, QueryResponse
from services.query_service import answer_query
from middleware.auth_middleware import get_current_user
from services.conversation_service import get_or_create_conversation, end_conversation
from services.lead_service import get_or_create_lead, update_lead

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


from middleware.auth_middleware import get_optional_user

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

