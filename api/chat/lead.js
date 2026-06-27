// ─────────────────────────────────────────────────────────────
// Lead service — tracks per-conversation lead profile, scoring
// and stage. Falls back to in-memory storage when Supabase
// isn't writable.
//
// Port of backend/services/lead_service.py.
// ─────────────────────────────────────────────────────────────

const STAGES = ['discover', 'qualify', 'anchor', 'book', 'closed'];
const STATUSES = ['cold', 'warm', 'hot', 'booked', 'escalated'];

const DEFAULT_LEAD = {
    stage: 'discover',
    score: 0,
    status: 'cold',
    signals: {},
    qualified_fields: {},
    objections: [],
};

const _IN_MEMORY_LEADS = new Map(); // conversation_id -> lead row

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

function scoreToStatus(score) {
    if (score >= 60) return 'hot';
    if (score >= 31) return 'warm';
    return 'cold';
}

async function getLeadByConversation(conversationId) {
    const sb = getSupabase();
    if (!sb) return _IN_MEMORY_LEADS.get(conversationId) || null;

    try {
        const { data, error } = await sb
            .from('leads')
            .select('*')
            .eq('conversation_id', conversationId)
            .limit(1);
        if (error) {
            console.warn('[lead] getLeadByConversation error:', error.message);
            return _IN_MEMORY_LEADS.get(conversationId) || null;
        }
        return data && data.length ? data[0] : _IN_MEMORY_LEADS.get(conversationId) || null;
    } catch (err) {
        console.warn('[lead] getLeadByConversation exception:', err.message);
        return _IN_MEMORY_LEADS.get(conversationId) || null;
    }
}

async function getOrCreateLead(userId, conversationId) {
    const existing = await getLeadByConversation(conversationId);
    if (existing) return existing;

    const data = {
        user_id: userId,
        conversation_id: conversationId,
        ...DEFAULT_LEAD,
    };

    const sb = getSupabase();
    if (!sb) {
        const lead = { id: conversationId, ...data, created_at: nowIso(), updated_at: nowIso() };
        _IN_MEMORY_LEADS.set(conversationId, lead);
        return lead;
    }

    try {
        const { data: inserted, error } = await sb.from('leads').insert(data).select().limit(1);
        if (!error && inserted && inserted.length) return inserted[0];
        if (error) console.warn('[lead] insert failed, using memory fallback:', error.message);
    } catch (err) {
        console.warn('[lead] insert exception, using memory fallback:', err.message);
    }

    const lead = { id: conversationId, ...data, created_at: nowIso(), updated_at: nowIso() };
    _IN_MEMORY_LEADS.set(conversationId, lead);
    return lead;
}

async function updateLead(conversationId, updates = {}) {
    const lead = await getLeadByConversation(conversationId);
    if (!lead) throw new Error(`No lead found for conversation ${conversationId}`);

    const patch = { updated_at: nowIso() };
    if (updates.stage !== undefined) patch.stage = updates.stage;
    if (updates.score !== undefined) patch.score = Math.max(0, Math.min(100, Number(updates.score) || 0));
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.signals !== undefined) {
        const merged = { ...(lead.signals || {}) };
        for (const [k, v] of Object.entries(updates.signals)) {
            if (v !== undefined && v !== null) merged[k] = v;
        }
        patch.signals = merged;
    }
    if (updates.qualified_fields !== undefined) {
        const merged = { ...(lead.qualified_fields || {}) };
        for (const [k, v] of Object.entries(updates.qualified_fields)) {
            if (v !== undefined && v !== null) merged[k] = v;
        }
        patch.qualified_fields = merged;
    }
    if (updates.objections !== undefined) patch.objections = updates.objections;

    const sb = getSupabase();
    if (!sb) {
        const updated = { ...lead, ...patch };
        _IN_MEMORY_LEADS.set(conversationId, updated);
        return updated;
    }

    try {
        const { data, error } = await sb
            .from('leads')
            .update(patch)
            .eq('conversation_id', conversationId)
            .select()
            .limit(1);
        if (!error && data && data.length) {
            _IN_MEMORY_LEADS.set(conversationId, data[0]);
            return data[0];
        }
        if (error) console.warn('[lead] update failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[lead] update exception, in-memory:', err.message);
    }

    const updated = { ...lead, ...patch };
    _IN_MEMORY_LEADS.set(conversationId, updated);
    return updated;
}

module.exports = {
    STAGES,
    STATUSES,
    DEFAULT_LEAD,
    scoreToStatus,
    getLeadByConversation,
    getOrCreateLead,
    updateLead,
};