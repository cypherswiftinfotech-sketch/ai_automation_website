// ─────────────────────────────────────────────────────────────
// Settings service — reads avatar consultant settings.
// Port of backend/services/settings_service.py.
// ─────────────────────────────────────────────────────────────
//
// Resolution order:
//   1. In-process cache (30s TTL)
//   2. Supabase `global_settings` (durable, shared across restarts)
//   3. backend/settings.json on disk (local dev fallback)
//   4. DEFAULT_SETTINGS in-memory (last resort)
//
// Exports:
//   getSettings() -> object
//   invalidateSettingsCache()
//   updateSettings(partial) -> object
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'backend', 'settings.json');

const DEFAULT_SETTINGS = {
    avatar_name: 'Avor',
    avatar_intro:
        "Hello {user_name}, I'm {avatar_name}. I help organizations explore AI automation, marketing and sales systems, AI agents, revenue operations, and business growth opportunities. How may I assist you today?",
    system_prompt:
        "You are a helpful, friendly AI avatar consultant.\nAnswer the user's question using only the provided knowledge base context.\nIf the context does not contain the answer, say you don't have that information.\nKeep answers concise and conversational — they will be spoken aloud by an avatar.",
    consultant_playbook: '',
    qualification_questions: [],
    escalation_threshold: 75,
    book_meeting_threshold: 60,
};

const CACHE_TTL_SECONDS = 30;
let cache = { data: null, expiresAt: 0 };

function getSupabase() {
    // Lazy require so circular-deps aren't an issue.
    try {
        const mod = require('../index.js');
        if (typeof mod.getSupabase === 'function') return mod.getSupabase();
    } catch (_) {
        // ignore — fall back to file/in-memory
    }
    return null;
}

function fromFile() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
        const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        const out = { ...DEFAULT_SETTINGS };
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (raw[key] !== undefined && raw[key] !== null) out[key] = raw[key];
        }
        out.updated_at = raw.updated_at;
        out.updated_by = raw.updated_by;
        return out;
    } catch (err) {
        console.warn('[settings] Failed to read settings.json:', err.message);
        return { ...DEFAULT_SETTINGS };
    }
}

function toFile(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 4), 'utf8');
    } catch (err) {
        console.warn('[settings] Failed to write settings.json:', err.message);
    }
}

function normalize(row) {
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (row[key] !== undefined && row[key] !== null) out[key] = row[key];
    }
    out.updated_at = row.updated_at;
    out.updated_by = row.updated_by;
    return out;
}

async function fromSupabase() {
    const sb = getSupabase();
    if (!sb) return null;
    try {
        const { data, error } = await sb.from('global_settings').select('*').eq('id', 1).limit(1);
        if (error) {
            console.warn('[settings] Supabase read failed:', error.message);
            return null;
        }
        const rows = data || [];
        if (!rows.length) return null;
        return normalize(rows[0]);
    } catch (err) {
        console.warn('[settings] Supabase read error:', err.message);
        return null;
    }
}

async function getSettings() {
    const now = Date.now() / 1000;
    if (cache.data && cache.expiresAt > now) return cache.data;

    const fromDb = await fromSupabase();
    const settings = fromDb || fromFile();

    cache = { data: settings, expiresAt: now + CACHE_TTL_SECONDS };
    return settings;
}

function invalidateSettingsCache() {
    cache = { data: null, expiresAt: 0 };
}

async function updateSettings(partial) {
    const base = await getSettings();
    const merged = { ...base };
    for (const [k, v] of Object.entries(partial || {})) {
        if (v !== undefined && v !== null) merged[k] = v;
    }

    const dbPayload = {
        id: 1,
        avatar_name: merged.avatar_name || DEFAULT_SETTINGS.avatar_name,
        avatar_intro: merged.avatar_intro || DEFAULT_SETTINGS.avatar_intro,
        system_prompt: merged.system_prompt || DEFAULT_SETTINGS.system_prompt,
        consultant_playbook: merged.consultant_playbook || '',
        qualification_questions: merged.qualification_questions || [],
        escalation_threshold: Number(merged.escalation_threshold || DEFAULT_SETTINGS.escalation_threshold),
        book_meeting_threshold: Number(merged.book_meeting_threshold || DEFAULT_SETTINGS.book_meeting_threshold),
    };

    const sb = getSupabase();
    if (sb) {
        try {
            const { error } = await sb.from('global_settings').upsert(dbPayload, { onConflict: 'id' });
            if (!error) {
                invalidateSettingsCache();
                const fresh = await fromSupabase();
                return fresh || fromFile();
            }
            console.warn('[settings] Supabase upsert failed:', error.message);
        } catch (err) {
            console.warn('[settings] Supabase upsert error:', err.message);
        }
    }

    // File fallback
    const filePayload = { ...dbPayload };
    delete filePayload.id;
    toFile(filePayload);
    invalidateSettingsCache();
    return fromFile();
}

module.exports = {
    DEFAULT_SETTINGS,
    getSettings,
    invalidateSettingsCache,
    updateSettings,
};