// ─────────────────────────────────────────────────────────────
// Conversation service — manages conversations and message storage.
// Port of backend/services/conversation_service.py.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

function getSupabase() {
    try {
        const mod = require('../index.js');
        if (typeof mod.getSupabase === 'function') return mod.getSupabase();
    } catch (_) {}
    return null;
}

const _IN_MEMORY_CONVERSATIONS = new Map(); // id -> conv
const _IN_MEMORY_MESSAGES = []; // [{conversation_id, role, content, ...}]

function nowIso() {
    return new Date().toISOString();
}

function newUuid() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // fallback (older Node)
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createConversation(userId, language = 'en', avatarId = null, title = null) {
    const data = {
        id: newUuid(),
        user_id: userId,
        language,
        status: 'active',
        started_at: nowIso(),
        summary: 'New conversation',
    };
    if (avatarId) data.avatar_id = avatarId;
    if (title) data.title = title;

    const sb = getSupabase();
    if (!sb) {
        _IN_MEMORY_CONVERSATIONS.set(data.id, data);
        return data;
    }

    // upsert user (Python does this too)
    try {
        await sb.from('users').upsert([{ id: userId }]);
    } catch (err) {
        console.warn('[conversation] user upsert warning:', err.message);
    }

    try {
        const { data: inserted, error } = await sb.from('conversations').insert(data).select().limit(1);
        if (!error && inserted && inserted.length) {
            _IN_MEMORY_CONVERSATIONS.set(inserted[0].id, inserted[0]);
            return inserted[0];
        }
        if (error) console.warn('[conversation] insert failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[conversation] insert exception, in-memory:', err.message);
    }

    _IN_MEMORY_CONVERSATIONS.set(data.id, data);
    return data;
}

async function getActiveConversation(userId) {
    const sb = getSupabase();
    if (!sb) {
        const matches = [..._IN_MEMORY_CONVERSATIONS.values()].filter(
            (c) => c.user_id === userId && c.status === 'active',
        );
        if (!matches.length) return null;
        matches.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
        return matches[0];
    }

    try {
        const { data, error } = await sb
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1);
        if (error) {
            console.warn('[conversation] getActive error:', error.message);
            return null;
        }
        return data && data.length ? data[0] : null;
    } catch (err) {
        console.warn('[conversation] getActive exception:', err.message);
        return null;
    }
}

async function getOrCreateConversation(userId, language = 'en', avatarId = null) {
    const active = await getActiveConversation(userId);
    if (active) return active;
    return createConversation(userId, language, avatarId);
}

async function getConversationById(conversationId) {
    const sb = getSupabase();
    if (!sb) return _IN_MEMORY_CONVERSATIONS.get(conversationId) || null;

    try {
        const { data, error } = await sb
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .limit(1);
        if (error) {
            console.warn('[conversation] getById error:', error.message);
            return _IN_MEMORY_CONVERSATIONS.get(conversationId) || null;
        }
        return data && data.length ? data[0] : _IN_MEMORY_CONVERSATIONS.get(conversationId) || null;
    } catch (err) {
        console.warn('[conversation] getById exception:', err.message);
        return _IN_MEMORY_CONVERSATIONS.get(conversationId) || null;
    }
}

async function saveMessage(conversationId, role, content, opts = {}) {
    const { tokenCount = null, responseTimeMs = null, metadata = null } = opts;

    const sb = getSupabase();
    if (!sb) {
        const msg = { conversation_id: conversationId, role, content, created_at: nowIso() };
        _IN_MEMORY_MESSAGES.push(msg);
        return msg;
    }

    const data = { conversation_id: conversationId, role, content };
    if (tokenCount !== null) data.token_count = tokenCount;
    if (responseTimeMs !== null) data.response_time_ms = responseTimeMs;
    if (metadata) data.metadata = metadata;

    try {
        const { data: inserted, error } = await sb.from('messages').insert(data).select().limit(1);
        if (!error && inserted && inserted.length) return inserted[0];
        if (error) console.warn('[conversation] saveMessage failed, in-memory:', error.message);
    } catch (err) {
        console.warn('[conversation] saveMessage exception, in-memory:', err.message);
    }

    const msg = { conversation_id: conversationId, role, content, created_at: nowIso() };
    _IN_MEMORY_MESSAGES.push(msg);
    return msg;
}

async function getConversationMessages(conversationId, limit = 100, offset = 0) {
    const sb = getSupabase();
    if (!sb) {
        const filtered = _IN_MEMORY_MESSAGES.filter((m) => m.conversation_id === conversationId);
        return filtered.slice(offset, offset + limit);
    }

    try {
        const { data, error } = await sb.rpc('get_conversation_messages', {
            p_conversation_id: conversationId,
            p_limit: limit,
            p_offset: offset,
        });
        if (!error && data) return data;
        if (error) console.warn('[conversation] RPC get_conversation_messages failed:', error.message);
    } catch (err) {
        console.warn('[conversation] RPC exception:', err.message);
    }

    // Fallback to plain select
    try {
        const { data, error } = await sb
            .from('messages')
            .select('id, role, content, metadata, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);
        if (error) {
            console.warn('[conversation] messages select error:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('[conversation] messages select exception:', err.message);
        return [];
    }
}

function fallbackTitle(messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    const text = (firstUser && firstUser.content) || 'Untitled';
    return text.slice(0, 60);
}

async function endConversation(conversationId) {
    const sb = getSupabase();
    if (!sb) throw new Error('Database is not configured.');

    const { data: messages, error: msgErr } = await sb
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    const msgList = messages || [];

    if (!msgList.length) {
        await sb
            .from('conversations')
            .update({ status: 'ended', ended_at: nowIso() })
            .eq('id', conversationId);
        return { conversation_id: conversationId, summary: null };
    }

    let summary = fallbackTitle(msgList);
    // Without an LLM here we leave summary as the fallback; admin can edit later.
    const firstUserMsg = msgList.find((m) => m.role === 'user');
    let title = null;
    if (firstUserMsg && firstUserMsg.content) {
        title =
            firstUserMsg.content.length > 80
                ? firstUserMsg.content.slice(0, 80) + '...'
                : firstUserMsg.content;
    }

    const updateData = { summary, status: 'ended', ended_at: nowIso() };
    if (title) updateData.title = title;

    await sb.from('conversations').update(updateData).eq('id', conversationId);

    return { conversation_id: conversationId, summary, title };
}

module.exports = {
    createConversation,
    getActiveConversation,
    getOrCreateConversation,
    getConversationById,
    saveMessage,
    getConversationMessages,
    endConversation,
    newUuid,
};