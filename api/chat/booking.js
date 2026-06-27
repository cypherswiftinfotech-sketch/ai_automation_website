// ─────────────────────────────────────────────────────────────
// Booking service — persists bookings and updates lead status.
// Port of backend/services/booking_service.py.
// ─────────────────────────────────────────────────────────────

const { updateLead } = require('./lead');

const _IN_MEMORY_BOOKINGS = [];

function getSupabase() {
    try {
        const mod = require('../index.js');
        return typeof mod.getSupabase === 'function' ? mod.getSupabase() : null;
    } catch (_) {
        return null;
    }
}

async function saveBooking({
    userId,
    conversationId,
    leadId = null,
    slotStart,
    slotEnd,
    timezoneStr,
    attendeeEmail,
    attendeeName,
    externalBookingId,
}) {
    const data = {
        user_id: userId,
        conversation_id: conversationId,
        lead_id: leadId,
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezoneStr,
        attendee_email: attendeeEmail,
        attendee_name: attendeeName,
        external_booking_id: externalBookingId,
        status: 'confirmed',
    };

    const sb = getSupabase();
    if (!sb) {
        const booking = { id: externalBookingId, ...data };
        _IN_MEMORY_BOOKINGS.push(booking);
        return booking;
    }

    try {
        const { data: inserted, error } = await sb.from('bookings').insert(data).select().limit(1);
        if (!error && inserted && inserted.length) return inserted[0];
        if (error) console.warn('[booking] insert failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[booking] insert exception, in-memory:', err.message);
    }
    const booking = { id: externalBookingId, ...data };
    _IN_MEMORY_BOOKINGS.push(booking);
    return booking;
}

async function markLeadBooked(conversationId) {
    return updateLead(conversationId, { stage: 'closed', status: 'booked' });
}

function formatConfirmationMessage(slotLabel, attendeeName) {
    return 'Thank you, the meeting is booked. Ending conversation.';
}

module.exports = {
    saveBooking,
    markLeadBooked,
    formatConfirmationMessage,
};