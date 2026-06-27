// ─────────────────────────────────────────────────────────────
// processTurn — orchestrates one full chat turn.
// Port of backend/services/consultant_service.py.process_turn.
// ─────────────────────────────────────────────────────────────

const { getOrCreateLead, getLeadByConversation, updateLead } = require('./lead');
const { saveMessage, getConversationMessages } = require('./conversation');
const { getOrCreateState, recordTurn, resolveStage, computeScoreDelta, applyScore, resolveStatus, missingQualifyFields } = require('./lead-scoring');
const { routeIntent } = require('./intent');
const { retrieveContext } = require('./rag');
const { getAvailableSlots, slotToDict, resolveTimezone } = require('./calendar');
const { isConfigured: anthropicConfigured, createMessage } = require('./anthropic');
const { buildSystemPrompt, buildStructuredMemory } = require('./prompt');

const MODEL = 'claude-haiku-4-5-20251001';

// In-memory cache of pending slots per conversation so the LLM can
// match oral slot picks on subsequent turns. Mirrors Python.
const _PENDING_SLOTS = new Map();

function parseLlmJson(raw) {
    let text = String(raw || '').trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();

    try {
        return JSON.parse(text);
    } catch (_) {
        // fall through
    }
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) {
        try {
            return JSON.parse(brace[0]);
        } catch (_) {
            // fall through
        }
    }

    console.warn('[processTurn] failed to parse LLM JSON, using fallback');
    return {
        intent: 'rag_answer',
        answer: raw,
        lead_signals: {},
        qualified_fields: {},
        objections: [],
        score_delta: 0,
        next_stage: 'discover',
    };
}

async function buildUiAction(intent, uiActionHint, timezoneStr, conversationId) {
    // Forward the propose_oral_booking card without rebuilding slots.
    if (uiActionHint && uiActionHint.type === 'propose_oral_booking') return uiActionHint;
    if (intent !== 'book_meeting') return uiActionHint || null;

    const tz = resolveTimezone(timezoneStr);
    const slots = await getAvailableSlots(tz);
    const slotDicts = slots.map((s) => slotToDict(s, tz));

    if (conversationId) _PENDING_SLOTS.set(conversationId, slotDicts);

    return {
        type: 'show_slots',
        timezone: tz,
        message: 'Pick a time that works for you',
        slots: slotDicts,
    };
}

function mergeQualified(existing, patch) {
    const out = { ...(existing || {}) };
    for (const [k, v] of Object.entries(patch || {})) {
        if (v !== undefined && v !== null && v !== '') out[k] = v;
    }
    return out;
}

function mergeSignals(existing, patch) {
    const out = { ...(existing || {}) };
    for (const [k, v] of Object.entries(patch || {})) {
        if (v !== undefined && v !== null) out[k] = v;
    }
    return out;
}

async function finalize(conversationId, startTime, result, lead, extras = {}) {
    const { intent = 'rag_answer', scoreDelta = 0 } = extras;
    const responseTimeMs = (Date.now() - startTime);
    await saveMessage(conversationId, 'assistant', result.answer, {
        responseTimeMs,
        metadata: {
            intent: result.intent || intent,
            lead_score: result.lead_score || lead.score || 0,
            stage: result.stage || lead.stage || 'discover',
            status: result.status || lead.status || 'cold',
            score_delta: scoreDelta,
            ui_action: result.ui_action || null,
        },
    });
    return result;
}

async function processTurn(userId, conversationId, query, language = 'en', timezoneStr = 'UTC') {
    const startTime = Date.now();

    // Persist the user message immediately.
    await saveMessage(conversationId, 'user', query);

    const lead = await getOrCreateLead(userId, conversationId);
    const convState = await getOrCreateState(conversationId);
    const meetingBooked = (lead.status === 'booked');

    // Short-circuit: already booked.
    if (meetingBooked || (lead.stage || 'discover') === 'closed') {
        const result = {
            answer: 'Thank you, the meeting is already booked. Our team will reach out to you soon. Have a great day!',
            intent: 'rag_answer',
            lead_score: Number(lead.score || 0),
            stage: 'closed',
            status: lead.status || 'booked',
            score_delta: 0,
            ui_action: null,
        };
        return finalize(conversationId, startTime, result, lead, { intent: 'rag_answer', scoreDelta: 0 });
    }

    const currentScore = Number(lead.score || 0);
    const currentStage = lead.stage || 'discover';
    const currentStatus = lead.status || 'cold';
    const signals = lead.signals || {};
    const qualifiedFields = lead.qualified_fields || {};
    const objections = lead.objections || [];
    const turnCount = Number(convState.turn_count || 0);

    const context = await retrieveContext(query);
    const history = await getConversationMessages(conversationId, 10);
    const historyText = history
        .filter((m) => m && m.content)
        .map((m) => `${(m.role || 'user').replace(/^./, (c) => c.toUpperCase())}: ${m.content}`)
        .join('\n');

    const structuredMemory = await buildStructuredMemory({
        userId,
        conversationId,
        qualifiedFields,
        objections,
        questionsAsked: convState.questions_asked || [],
        topicsDiscussed: convState.topics_discussed || [],
        stageHistory: convState.stage_history || [],
        historyText,
    });

    const systemPrompt = await buildSystemPrompt({
        stage: currentStage,
        leadScore: currentScore,
        leadStatus: currentStatus,
        signals,
        qualifiedFields,
        structuredMemory,
        missingFields: missingQualifyFields(qualifiedFields),
        language,
    });

    if (!anthropicConfigured()) {
        const fallback = 'I apologize, but my AI service is not configured. Please contact the administrator.';
        return finalize(
            conversationId,
            startTime,
            { answer: fallback, intent: 'rag_answer', lead_score: currentScore, stage: currentStage, status: currentStatus, score_delta: 0, ui_action: null },
            lead,
            { intent: 'rag_answer', scoreDelta: 0 },
        );
    }

    // Build pending-slots context for oral slot picking.
    const pending = _PENDING_SLOTS.get(conversationId) || [];
    let pendingContext = '';
    if (pending.length) {
        const lines = pending.map((s, idx) => `  Slot ${idx}: ${s.label} (${s.start} to ${s.end})`);
        pendingContext =
            '\n\nAvailable meeting slots currently shown to the user:\n' +
            lines.join('\n') +
            '\nIf the user picks one of these, set selected_slot_index to its index.';
    }

    let rawText;
    try {
        const response = await createMessage({
            model: MODEL,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: `Knowledge base context:\n${context}\n\nUser message: ${query}${pendingContext}`,
                },
            ],
            maxTokens: 768,
        });
        rawText = response.text;
    } catch (err) {
        console.error('[processTurn] Anthropic call failed:', err.message);
        const fallback = `I apologize, but I encountered an error: ${err.message}`;
        return finalize(
            conversationId,
            startTime,
            { answer: fallback, intent: 'rag_answer', lead_score: currentScore, stage: currentStage, status: currentStatus, score_delta: 0, ui_action: null },
            lead,
            { intent: 'rag_answer', scoreDelta: 0 },
        );
    }

    const parsed = parseLlmJson(rawText);
    const answer = parsed.answer || rawText;
    const llmSignals = parsed.lead_signals || {};
    const newQualified = parsed.qualified_fields || {};
    const newObjections = parsed.objections || [];
    const llmDelta = Number(parsed.score_delta || 0);

    const mergedQualified = mergeQualified(qualifiedFields, newQualified);
    const mergedSignals = mergeSignals(signals, llmSignals);

    const scoreDelta = computeScoreDelta(llmSignals, llmDelta);
    const newScore = applyScore(currentScore, scoreDelta);

    const nextStage = await resolveStage(currentStage, parsed.next_stage || currentStage, {
        qualifiedFields: mergedQualified,
        leadScore: newScore,
        turnCount: turnCount + 1,
        signals: mergedSignals,
        intent: parsed.intent || 'rag_answer',
        meetingBooked,
    });

    const { intent, uiAction: uiActionHint } = await routeIntent(parsed.intent || 'rag_answer', {
        leadScore: newScore,
        stage: nextStage,
        userQuery: query,
        meetingBooked,
    });
    const newStatus = resolveStatus(newScore, intent, currentStatus);

    // Oral slot booking: if LLM selected a slot index, propose it.
    let chosenSlotHint = null;
    const selectedSlotIndex = parsed.selected_slot_index;
    const pendingSlots = _PENDING_SLOTS.get(conversationId) || [];
    if (
        selectedSlotIndex !== undefined &&
        selectedSlotIndex !== null &&
        Number.isInteger(selectedSlotIndex) &&
        selectedSlotIndex >= 0 &&
        selectedSlotIndex < pendingSlots.length &&
        intent === 'book_meeting'
    ) {
        const chosen = pendingSlots[selectedSlotIndex];
        chosenSlotHint = {
            type: 'propose_oral_booking',
            slot: chosen,
            message: `Please confirm your booking details for ${chosen.label}.`,
        };
    }

    let uiAction = await buildUiAction(
        intent,
        chosenSlotHint || uiActionHint,
        timezoneStr,
        conversationId,
    );

    const mergedObjections = [...(objections || [])];
    for (const obj of newObjections) {
        if (obj && !mergedObjections.includes(obj)) mergedObjections.push(obj);
    }

    const updatedLead = await updateLead(conversationId, {
        stage: nextStage,
        score: newScore,
        status: newStatus,
        signals: mergedSignals,
        qualified_fields: mergedQualified,
        objections: mergedObjections,
    });

    await recordTurn(conversationId, {
        intent,
        stage: nextStage,
        assistantMessage: answer,
        userQuery: query,
    });

    const finalAnswer = chosenSlotHint
        ? `I've selected the ${pendingSlots[selectedSlotIndex].label} slot for you. Please verify and confirm your details on the screen to finalize your booking.`
        : answer;

    const result = {
        answer: finalAnswer,
        intent,
        lead_score: Number(updatedLead.score || newScore),
        stage: updatedLead.stage || nextStage,
        status: updatedLead.status || newStatus,
        score_delta: scoreDelta,
        ui_action: uiAction,
    };

    return finalize(conversationId, startTime, result, updatedLead, { intent, scoreDelta });
}

module.exports = {
    processTurn,
    parseLlmJson,
};