// ─────────────────────────────────────────────────────────────
// Anthropic LLM wrapper — calls Claude via raw fetch (no SDK
// dependency). Port of the parts of
// backend/services/consultant_service.py that call
// anthropic_client.messages.create.
// ─────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function isConfigured() {
    return Boolean(ANTHROPIC_API_KEY);
}

/**
 * Call Anthropic messages.create.
 * @param {object} opts
 * @param {string} opts.model
 * @param {string} opts.system
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {number} [opts.maxTokens=768]
 * @returns {Promise<{text: string, raw: object}>}
 */
async function createMessage({ model = DEFAULT_MODEL, system = '', messages = [], maxTokens = 768 } = {}) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured.');
    }

    const body = {
        model,
        max_tokens: maxTokens,
        system,
        messages,
    };

    const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Anthropic ${res.status}: ${text}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`Anthropic returned invalid JSON: ${err.message}`);
    }

    const content = parsed && parsed.content && parsed.content[0] && parsed.content[0].text;
    if (!content) {
        throw new Error('Anthropic returned no text content');
    }
    return { text: content, raw: parsed };
}

module.exports = {
    isConfigured,
    createMessage,
    DEFAULT_MODEL,
};