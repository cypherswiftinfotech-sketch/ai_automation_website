from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from zoneinfo import ZoneInfo

from middleware.auth_middleware import get_current_user
from services.booking_service import format_confirmation_message, mark_lead_booked, save_booking
from services.calendar_service import book_slot, get_available_slots
from services.lead_service import get_lead_by_conversation
from services.timezone_service import resolve_timezone

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


class SlotsRequest(BaseModel):
    conversation_id: Optional[str] = None
    timezone: Optional[str] = "UTC"


class BookRequest(BaseModel):
    conversation_id: str
    slot_id: str
    slot_start: str
    slot_end: str
    timezone: Optional[str] = "UTC"
    attendee_name: Optional[str] = None
    attendee_email: Optional[EmailStr] = None
    company_name: Optional[str] = None


@router.post("/slots")
async def list_slots(
    body: SlotsRequest,
    current_user: dict = Depends(get_current_user),
):
    tz = resolve_timezone(body.timezone)
    slots = await get_available_slots(tz)
    return {
        "timezone": tz,
        "slots": [s.to_dict(tz) for s in slots],
    }


@router.get("/slots")
async def list_slots_get(
    timezone: str = "UTC",
    current_user: dict = Depends(get_current_user),
):
    tz = resolve_timezone(timezone)
    slots = await get_available_slots(tz)
    return {
        "timezone": tz,
        "slots": [s.to_dict(tz) for s in slots],
    }


@router.post("/book")
async def create_booking(
    body: BookRequest,
    current_user: dict = Depends(get_current_user),
):
    user = current_user
    tz = resolve_timezone(body.timezone)
    name = body.attendee_name or user.get("name") or "Guest"
    email = body.attendee_email or user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Attendee email is required.")

    try:
        start = datetime.fromisoformat(body.slot_start.replace("Z", "+00:00"))
        end = datetime.fromisoformat(body.slot_end.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid slot datetime: {e}")

    cal_result = await book_slot(
        body.slot_id,
        start=start,
        end=end,
        attendee_name=name,
        attendee_email=email,
        timezone_str=tz,
    )

    lead = get_lead_by_conversation(body.conversation_id)
    lead_id = lead.get("id") if lead else None

    booking = save_booking(
        user_id=user["id"],
        conversation_id=body.conversation_id,
        lead_id=lead_id,
        slot_start=cal_result["slot_start"],
        slot_end=cal_result["slot_end"],
        timezone_str=tz,
        attendee_email=email,
        attendee_name=name,
        external_booking_id=cal_result["external_booking_id"],
    )

    if body.company_name:
        try:
            from services.lead_service import update_lead
            update_lead(body.conversation_id, qualified_fields={"company": body.company_name})
        except Exception as e:
            logger.warning(f"Failed to update company name on lead: {e}")

    mark_lead_booked(body.conversation_id)

    local_label = start.astimezone(ZoneInfo(tz)).strftime("%a %b %d at %I:%M %p")

    return {
        "booking": booking,
        "message": format_confirmation_message(local_label, name),
        "stage": "closed",
        "status": "booked",
    }
