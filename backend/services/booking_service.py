"""
Booking service — persists bookings and updates lead status.
"""

import logging
from datetime import datetime
from typing import Optional

from config import supabase
from services.lead_service import update_lead

logger = logging.getLogger(__name__)

_IN_MEMORY_BOOKINGS: list[dict] = []


def save_booking(
    *,
    user_id: str,
    conversation_id: str,
    lead_id: Optional[str],
    slot_start: str,
    slot_end: str,
    timezone_str: str,
    attendee_email: str,
    attendee_name: str,
    external_booking_id: str,
) -> dict:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "lead_id": lead_id,
        "slot_start": slot_start,
        "slot_end": slot_end,
        "timezone": timezone_str,
        "attendee_email": attendee_email,
        "attendee_name": attendee_name,
        "external_booking_id": external_booking_id,
        "status": "confirmed",
    }

    if not supabase:
        booking = {"id": external_booking_id, **data}
        _IN_MEMORY_BOOKINGS.append(booking)
        return booking

    try:
        result = supabase.table("bookings").insert(data).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.warning(f"Failed to save booking to Supabase: {e}")

    booking = {"id": external_booking_id, **data}
    _IN_MEMORY_BOOKINGS.append(booking)
    return booking


def mark_lead_booked(conversation_id: str) -> dict:
    return update_lead(
        conversation_id,
        stage="closed",
        status="booked",
    )


def format_confirmation_message(slot_label: str, attendee_name: str) -> str:
    return "Thank you, the meeting is booked. Ending conversation."

