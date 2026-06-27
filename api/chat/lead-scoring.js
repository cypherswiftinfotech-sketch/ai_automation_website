// ─────────────────────────────────────────────────────────────
// Lead scoring + stage machine + conversation state.
// Port of backend/services/lead_scoring_service.py,
// backend/services/stage_machine_service.py,
// backend/services/conversation_state_service.py.
// ─────────────────────────────────────────────────────────────

const { getSettings } = require('./settings');
const { scoreToStatus } = require('./lead');

const SIGNAL_WEIGHTS = {
    pain: 8,
    budget_hint: 10,
    timeline_hint: 7,
    authority_hint: 8,
};

const INTENT_STRENGTH_BONUS = {
    low: 2,
    medium: 5,
    high: 10,
};

const STAGE_ORDER = ['discover', 'qualify', 'anchor', 'book', 'closed'];
const QUALIFY_FIELDS = ['company_size', 'role', 'budget', 'timeline'];

function computeScoreDelta(signals, llmDelta) {
    let delta = Math.max(0, Math.min(25, Number(llmDelta || 0)));
    for (const [field, weight] of Object.entries(SIGNAL_WEIGHTS)) {
        if (signals && signals[field]) delta += weight;
    }
    const bonus = INTENT_STRENGTH_BONUS[signals && signals.intent_strength];
    if (typeof bonus === 'number') delta += bonus;
    return Math.max(0, Math.min(25, delta));
}

function applyScore(currentScore, delta) {
    return Math.max(0, Math.min(100, Number(currentScore || 0) + Number(delta || 0)));
}

function resolveStatus(score, intent, currentStatus) {
    if (intent === 'escalate') return 'escalated';
    if (intent === 'book_meeting' && score >= 50) return 'hot';
    if (currentStatus === 'booked' || currentStatus === 'escalated') return currentStatus;
    return scoreToStatus(score);
}

function countQualifiedFields(qualifiedFields) {
    if (!qualifiedFields) return 0;
    return QUALIFY_FIELDS.filter(
        (f) => qualifiedFields[f] !== undefined && qualifiedFields[f] !== null && qualifiedFields[f] !== '' && qualifiedFields[f] !== 'null',
    ).length;
}

function missingQualifyFields(qualifiedFields) {
    if (!qualifiedFields) return [...QUALIFY_FIELDS];
    return QUALIFY_FIELDS.filter(
        (f) => qualifiedFields[f] === undefined || qualifiedFields[f] === null || qualifiedFields[f] === '' || qualifiedFields[f] === 'null',
    );
}

function stageIndex(stage) {
    const idx = STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx : 0;
}

function maxStage(a, b) {
    return stageIndex(a) >= stageIndex(b) ? a : b;
}

async function resolveStage(currentStage, llmSuggested, opts) {
    const { qualifiedFields = {}, leadScore = 0, turnCount = 0, signals = {}, intent = 'rag_answer', meetingBooked = false } = opts || {};
    if (meetingBooked) return 'closed';

    const current = STAGE_ORDER.includes(currentStage) ? currentStage : 'discover';
    const settings = await getSettings();
    const bookThreshold = Number(settings.book_meeting_threshold || 60);

    const filled = countQualifiedFields(qualifiedFields);
    const hasPain = Boolean(signals && signals.pain);

    let autoStage = current;
    if (current === 'discover' && (turnCount >= 2 || hasPain)) autoStage = 'qualify';
    if (filled >= 2 || (filled >= 1 && leadScore >= 35)) autoStage = maxStage(autoStage, 'qualify');
    if (filled >= 2 && (hasPain || leadScore >= 30)) autoStage = maxStage(autoStage, 'anchor');
    if (filled >= 3 && leadScore >= bookThreshold - 10) autoStage = maxStage(autoStage, 'book');
    if (intent === 'book_meeting' && leadScore >= bookThreshold - 15) autoStage = maxStage(autoStage, 'book');

    const llmStage = STAGE_ORDER.includes(llmSuggested) ? llmSuggested : current;
    const llmIdx = stageIndex(llmStage);
    const currentIdx = stageIndex(current);

    let llmCapped;
    if (llmIdx <= currentIdx) llmCapped = current;
    else if (llmIdx === currentIdx + 1) llmCapped = llmStage;
    else llmCapped = STAGE_ORDER[currentIdx + 1] || current;

    let finalStage = maxStage(autoStage, llmCapped);
    if (stageIndex(finalStage) < stageIndex(current) && current !== 'closed') finalStage = current;
    return finalStage;
}

// ── Conversation state (per-conversation turn bookkeeping) ──

const DEFAULT_STATE = {
    turn_count: 0,
    questions_asked: [],
    topics_discussed: [],
    stage_history: [],
    last_intent: null,
};

const _IN_MEMORY_STATE = new Map();

function getSupabase() {
    try {
        const mod = require('../index.js');
        if (typeof mod.getSupabase === 'function') return mod.getSupabase();
    } catch (_) {}
    return null;
}

function nowIso() {
    return new Date().toISOString();
}

async function getOrCreateState(conversationId) {
    const sb = getSupabase();
    if (!sb) {
        let state = _IN_MEMORY_STATE.get(conversationId);
        if (!state) {
            state = { conversation_id: conversationId, ...DEFAULT_STATE, updated_at: nowIso() };
            _IN_MEMORY_STATE.set(conversationId, state);
        }
        return state;
    }

    try {
        const { data, error } = await sb
            .from('conversation_state')
            .select('*')
            .eq('conversation_id', conversationId)
            .limit(1);
        if (!error && data && data.length) return data[0];
    } catch (err) {
        console.warn('[state] get error:', err.message);
    }

    // create
    const newState = { conversation_id: conversationId, ...DEFAULT_STATE };
    try {
        const { data, error } = await sb.from('conversation_state').insert(newState).select().limit(1);
        if (!error && data && data.length) {
            _IN_MEMORY_STATE.set(conversationId, data[0]);
            return data[0];
        }
        if (error) console.warn('[state] insert failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[state] insert exception, in-memory:', err.message);
    }
    const state = { ...newState, updated_at: nowIso() };
    _IN_MEMORY_STATE.set(conversationId, state);
    return state;
}

async function recordTurn(conversationId, { intent, stage, assistantMessage, userQuery }) {
    const state = await getOrCreateState(conversationId);
    const turnCount = Number(state.turn_count || 0) + 1;

    const questions = [...(state.questions_asked || [])];
    if (intent === 'qualify' && assistantMessage && assistantMessage.includes('?')) {
        const q = assistantMessage.trim();
        if (q && !questions.includes(q)) questions.push(q.slice(0, 200));
    }

    const topics = [...(state.topics_discussed || [])];
    const topicHint = (userQuery || '').trim().slice(0, 80);
    if (topicHint && !topics.includes(topicHint)) topics.push(topicHint);
    while (topics.length > 10) topics.shift();

    const history = [...(state.stage_history || [])];
    const prevStage = history.length ? history[history.length - 1].stage : null;
    if (stage !== prevStage) {
        history.push({ stage, at_turn: turnCount, at: nowIso() });
    }
    while (history.length > 20) history.shift();

    const updates = {
        turn_count: turnCount,
        questions_asked: questions.slice(-15),
        topics_discussed: topics,
        stage_history: history,
        last_intent: intent,
        updated_at: nowIso(),
    };

    const sb = getSupabase();
    if (!sb) {
        const merged = { ...state, ...updates };
        _IN_MEMORY_STATE.set(conversationId, merged);
        return merged;
    }

    try {
        const { data, error } = await sb
            .from('conversation_state')
            .update(updates)
            .eq('conversation_id', conversationId)
            .select()
            .limit(1);
        if (!error && data && data.length) {
            _IN_MEMORY_STATE.set(conversationId, data[0]);
            return data[0];
        }
        if (error) console.warn('[state] update failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[state] update exception, in-memory:', err.message);
    }

    const merged = { ...state, ...updates };
    _IN_MEMORY_STATE.set(conversationId, merged);
    return merged;
}

module.exports = {
    computeScoreDelta,
    applyScore,
    resolveStatus,
    resolveStage,
    countQualifiedFields,
    missingQualifyFields,
    getOrCreateState,
    recordTurn,
    STAGE_ORDER,
    QUALIFY_FIELDS,
};