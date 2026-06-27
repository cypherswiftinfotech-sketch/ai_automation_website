// ─────────────────────────────────────────────────────────────
// Calendar service — fetch available slots and create bookings.
// Supports Cal.com API with mock fallback. Port of
// backend/services/calendar_service.py.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

const CALCOM_API_KEY = (process.env.CALCOM_API_KEY || '').trim();
const CALCOM_EVENT_TYPE_ID = (process.env.CALCOM_EVENT_TYPE_ID || '').trim();
const CALCOM_BASE_URL = (process.env.CALCOM_BASE_URL || 'https://api.cal.com/v1').replace(/\/$/, '');
const SLOT_COUNT = 3;
const SLOT_DURATION_MINUTES = 30;

function resolveTimezone(explicit) {
    if (!explicit) return 'UTC';
    const normalised = String(explicit).trim();
    try {
        // Use Intl.DateTimeFormat as a cheap availability check.
        new Intl.DateTimeFormat('en-US', { timeZone: normalised });
        return normalised;
    } catch (_) {
        return 'UTC';
    }
}

function slotLabel(date, tzName) {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tzName,
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        // Format the UTC date in the target timezone.
        const parts = fmt.formatToParts(date).filter((p) => p.type !== 'literal');
        const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
        return `${lookup.weekday} ${lookup.month} ${lookup.day}, ${lookup.hour}:${lookup.minute} ${lookup.dayPeriod || ''}`.trim();
    } catch (_) {
        return date.toISOString();
    }
}

function isoInTz(date, tzName) {
    try {
        // Convert the date's UTC ms into the target timezone's wall-clock fields.
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tzName,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const parts = fmt.formatToParts(date).reduce((acc, p) => {
            if (p.type !== 'literal') acc[p.type] = p.value;
            return acc;
        }, {});
        const h = parts.hour === '24' ? '00' : parts.hour;
        return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}`;
    } catch (_) {
        return date.toISOString();
    }
}

function toZonedTime(date, tzName) {
    // We approximate "wall-clock time in tz" by formatting in tz and
    // then re-parsing it as if it were local time. We then derive a
    // UTC Date by computing the offset between that wall-clock and the
    // original UTC instant.
    const localIsoString = isoInTz(date, tzName);
    const tzNowIsoString = isoInTz(new Date(), tzName);
    const tzNow = new Date(tzNowIsoString + 'Z');
    const diffMs = tzNow.getTime() - new Date().toISOString().length;
    // Simpler approach: build a date string with the tz offset.
    try {
        const local = new Date(localIsoString + 'Z'); // interpret as UTC
        const offsetMs = local.getTime() - date.getTime();
        const wallClockDate = new Date(date.getTime() + offsetMs);
        return wallClockDate;
    } catch (_) {
        return date;
    }
}

function generateMockSlots(tzName, count) {
    const slots = [];
    const nowMs = Date.now();
    const hourOptions = [10, 14, 16];
    let dayOffset = 1;

    while (slots.length < count && dayOffset < 14) {
        // Try each future day, skipping weekends (Sat=6, Sun=0).
        const candidate = new Date(nowMs + dayOffset * 86400000);
        dayOffset += 1;
        const dow = candidate.getUTCDay();
        if (dow === 0 || dow === 6) continue;

        for (const hour of hourOptions) {
            if (slots.length >= count) break;
            // Build a UTC Date for that hour on that date, then shift by
            // the timezone offset to get the proper UTC instant.
            const utcMidnight = new Date(Date.UTC(
                candidate.getUTCFullYear(),
                candidate.getUTCMonth(),
                candidate.getUTCDate(),
                hour, 0, 0, 0,
            ));
            // Approximate TZ offset: how many minutes ahead is the tz
            // vs UTC at that instant.
            const tzWallClock = new Date(isoInTz(utcMidnight, tzName) + 'Z');
            const offsetMs = utcMidnight.getTime() - tzWallClock.getTime();
            const slotStart = new Date(utcMidnight.getTime() + offsetMs);

            if (slotStart.getTime() <= nowMs) continue;

            const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60000);
            const slotId = `mock-${slotStart.toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
            slots.push({
                id: slotId,
                start: slotStart,
                end: slotEnd,
                label: slotLabel(slotStart, tzName),
            });
        }
    }
    return slots;
}

async function fetchCalComSlots(tzName, count) {
    const params = new URLSearchParams({
        apiKey: CALCOM_API_KEY,
        eventTypeId: CALCOM_EVENT_TYPE_ID,
        startTime: isoInTz(new Date(), tzName).slice(0, 10),
        endTime: isoInTz(new Date(Date.now() + 7 * 86400000), tzName).slice(0, 10),
        timeZone: tzName,
    });

    const res = await fetch(`${CALCOM_BASE_URL}/slots?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        throw new Error(`Cal.com ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = await res.json();
    const rawSlots = (data && data.slots) || {};

    const slots = [];
    for (const dateStr of Object.keys(rawSlots)) {
        for (const timeStr of rawSlots[dateStr]) {
            if (slots.length >= count) break;
            const localStart = new Date(`${dateStr}T${timeStr}Z`); // treat as UTC for parsing
            if (Number.isNaN(localStart.getTime())) continue;
            const slotEnd = new Date(localStart.getTime() + SLOT_DURATION_MINUTES * 60000);
            if (slotEnd.getTime() <= Date.now()) continue;
            slots.push({
                id: `cal-${dateStr}-${timeStr}`,
                start: localStart,
                end: slotEnd,
                label: slotLabel(localStart, tzName),
            });
        }
        if (slots.length >= count) break;
    }
    return slots;
}

async function getAvailableSlots(tzName, count = SLOT_COUNT) {
    const tz = resolveTimezone(tzName);
    if (CALCOM_API_KEY && CALCOM_EVENT_TYPE_ID) {
        try {
            const real = await fetchCalComSlots(tz, count);
            if (real && real.length) return real;
        } catch (err) {
            console.warn('[calendar] Cal.com fetch failed, using mock:', err.message);
        }
    }
    return generateMockSlots(tz, count);
}

function slotToDict(slot, tzName) {
    return {
        id: slot.id,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: slot.label,
        timezone: tzName,
    };
}

async function createCalComBooking({ start, name, email, tzName }) {
    const res = await fetch(`${CALCOM_BASE_URL}/bookings?apiKey=${encodeURIComponent(CALCOM_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventTypeId: Number(CALCOM_EVENT_TYPE_ID),
            start: start.toISOString(),
            responses: { name, email },
            timeZone: tzName,
            language: 'en',
            metadata: {},
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        throw new Error(`Cal.com booking ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = await res.json();
    const booking = (data && (data.booking || data)) || {};
    return String(booking.id || booking.uid || crypto.randomUUID());
}

async function bookSlot(slotId, { start, end, attendeeName, attendeeEmail, timezoneStr }) {
    const tz = resolveTimezone(timezoneStr);
    let externalId = null;

    if (CALCOM_API_KEY && CALCOM_EVENT_TYPE_ID && !slotId.startsWith('mock-')) {
        try {
            externalId = await createCalComBooking({ start, name: attendeeName, email: attendeeEmail, tzName: tz });
        } catch (err) {
            console.warn('[calendar] Cal.com booking failed:', err.message);
        }
    }

    if (!externalId) externalId = `local-${crypto.randomUUID()}`;

    return {
        external_booking_id: externalId,
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        timezone: tz,
        status: 'confirmed',
    };
}

module.exports = {
    resolveTimezone,
    getAvailableSlots,
    bookSlot,
    slotToDict,
    SLOT_COUNT,
};