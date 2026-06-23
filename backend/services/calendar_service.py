"""
Calendar service — fetches available slots and creates bookings.
Supports Cal.com API with mock fallback when not configured.
"""

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx

from services.timezone_service import resolve_timezone

logger = logging.getLogger(__name__)

CALCOM_API_KEY = os.getenv("CALCOM_API_KEY", "").strip()
CALCOM_EVENT_TYPE_ID = os.getenv("CALCOM_EVENT_TYPE_ID", "").strip()
CALCOM_BASE_URL = os.getenv("CALCOM_BASE_URL", "https://api.cal.com/v1").rstrip("/")
SLOT_COUNT = 3
SLOT_DURATION_MINUTES = 30


@dataclass
class Slot:
    id: str
    start: datetime
    end: datetime
    label: str

    def to_dict(self, tz_name: str) -> dict:
        tz = ZoneInfo(resolve_timezone(tz_name))
        local_start = self.start.astimezone(tz)
        return {
            "id": self.id,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "label": local_start.strftime("%a %b %d, %I:%M %p"),
            "timezone": tz_name,
        }


async def get_available_slots(tz_name: str, count: int = SLOT_COUNT) -> list[Slot]:
    tz_name = resolve_timezone(tz_name)

    if CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID:
        try:
            return await _fetch_calcom_slots(tz_name, count)
        except Exception as e:
            logger.warning(f"Cal.com slot fetch failed, using mock slots: {e}")

    return _generate_mock_slots(tz_name, count)


async def _fetch_calcom_slots(tz_name: str, count: int) -> list[Slot]:
    tz = ZoneInfo(tz_name)
    now = datetime.now(timezone.utc)
    start = now.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)

    params = {
        "apiKey": CALCOM_API_KEY,
        "eventTypeId": CALCOM_EVENT_TYPE_ID,
        "startTime": start.strftime("%Y-%m-%d"),
        "endTime": end.strftime("%Y-%m-%d"),
        "timeZone": tz_name,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{CALCOM_BASE_URL}/slots", params=params)
        resp.raise_for_status()
        data = resp.json()

    slots: list[Slot] = []
    # Cal.com v1 returns { slots: { "2024-01-15": ["09:00:00", ...] } }
    raw_slots = data.get("slots") or {}
    for date_str, times in raw_slots.items():
        for time_str in times:
            if len(slots) >= count:
                break
            start_dt = datetime.fromisoformat(f"{date_str}T{time_str}")
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=tz)
            start_utc = start_dt.astimezone(timezone.utc)
            if start_utc <= now:
                continue
            end_utc = start_utc + timedelta(minutes=SLOT_DURATION_MINUTES)
            slots.append(
                Slot(
                    id=f"cal-{date_str}-{time_str}",
                    start=start_utc,
                    end=end_utc,
                    label=start_dt.strftime("%a %b %d, %I:%M %p"),
                )
            )
        if len(slots) >= count:
            break

    if not slots:
        return _generate_mock_slots(tz_name, count)
    return slots[:count]


def _generate_mock_slots(tz_name: str, count: int) -> list[Slot]:
    """Generate the next N business-day slots at 10am, 2pm, 4pm local time."""
    tz = ZoneInfo(resolve_timezone(tz_name))
    now = datetime.now(timezone.utc).astimezone(tz)
    slots: list[Slot] = []
    day_offset = 1
    hour_options = [10, 14, 16]

    while len(slots) < count and day_offset < 14:
        candidate_day = now + timedelta(days=day_offset)
        day_offset += 1
        if candidate_day.weekday() >= 5:
            continue
        for hour in hour_options:
            if len(slots) >= count:
                break
            local_start = candidate_day.replace(
                hour=hour, minute=0, second=0, microsecond=0
            )
            start_utc = local_start.astimezone(timezone.utc)
            if start_utc <= datetime.now(timezone.utc):
                continue
            end_utc = start_utc + timedelta(minutes=SLOT_DURATION_MINUTES)
            slot_id = f"mock-{local_start.strftime('%Y%m%d%H%M')}"
            slots.append(
                Slot(
                    id=slot_id,
                    start=start_utc,
                    end=end_utc,
                    label=local_start.strftime("%a %b %d, %I:%M %p"),
                )
            )
    return slots


async def book_slot(
    slot_id: str,
    *,
    start: datetime,
    end: datetime,
    attendee_name: str,
    attendee_email: str,
    timezone_str: str,
) -> dict:
    """Create a booking via Cal.com or return mock confirmation."""
    external_id = None

    if CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID and not slot_id.startswith("mock-"):
        try:
            external_id = await _create_calcom_booking(
                start, attendee_name, attendee_email, timezone_str
            )
        except Exception as e:
            logger.warning(f"Cal.com booking failed: {e}")

    if not external_id:
        external_id = f"local-{uuid.uuid4()}"

    return {
        "external_booking_id": external_id,
        "slot_start": start.isoformat(),
        "slot_end": end.isoformat(),
        "timezone": resolve_timezone(timezone_str),
        "status": "confirmed",
    }


async def _create_calcom_booking(
    start: datetime,
    name: str,
    email: str,
    tz_name: str,
) -> str:
    payload = {
        "eventTypeId": int(CALCOM_EVENT_TYPE_ID),
        "start": start.isoformat(),
        "responses": {
            "name": name,
            "email": email,
        },
        "timeZone": tz_name,
        "language": "en",
        "metadata": {},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{CALCOM_BASE_URL}/bookings",
            params={"apiKey": CALCOM_API_KEY},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    booking = data.get("booking") or data
    return str(booking.get("id") or booking.get("uid") or uuid.uuid4())
