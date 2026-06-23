"""
Timezone service — resolves user timezone from explicit value or sensible fallback.
"""

from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TZ = "UTC"


def resolve_timezone(explicit: Optional[str] = None) -> str:
    """
    Return a valid IANA timezone string.
    Priority: explicit param → UTC fallback.
    """
    if explicit:
        normalized = explicit.strip()
        if _is_valid_tz(normalized):
            return normalized
    return DEFAULT_TZ


def _is_valid_tz(tz_name: str) -> bool:
    try:
        ZoneInfo(tz_name)
        return True
    except (ZoneInfoNotFoundError, KeyError):
        return False


def now_in_tz(tz_name: str) -> datetime:
    tz = ZoneInfo(resolve_timezone(tz_name))
    return datetime.now(timezone.utc).astimezone(tz)
