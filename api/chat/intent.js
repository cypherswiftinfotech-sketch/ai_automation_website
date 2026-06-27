// ─────────────────────────────────────────────────────────────
// Intent router — finalises the LLM's chosen intent based on
// lead state. Port of backend/services/intent_router.py.
// ─────────────────────────────────────────────────────────────

const { getSettings } = require('./settings');

const VALID_INTENTS = ['rag_answer', 'qualify', 'book_meeting', 'escalate'];
const VALID_STAGES = ['discover', 'qualify', 'anchor', 'book', 'closed'];

const HUMAN_KEYWORDS = [
    'speak to a human',
    'talk to someone',
    'real person',
    'call me',
    'contact sales',
    'human please',
];

const BOOK_KEYWORDS = [
    'book a meeting',
    'schedule a call',
    'set up a meeting',
    'available times',
    'calendar',
    'book a call',
];

async function routeIntent(llmIntent, opts) {
    const { leadScore = 0, stage = 'discover', userQuery = '', meetingBooked = false } = opts || {};

    if (meetingBooked) return { intent: 'rag_answer', uiAction: null };

    const settings = await getSettings();
    const escalationThreshold = Number(settings.escalation_threshold || 75);
    const bookThreshold = Number(settings.book_meeting_threshold || 60);

    const intent = VALID_INTENTS.includes(llmIntent) ? llmIntent : 'rag_answer';
    const queryLower = String(userQuery || '').toLowerCase();
    const wantsHuman = HUMAN_KEYWORDS.some((kw) => queryLower.includes(kw));
    const wantsBook = BOOK_KEYWORDS.some((kw) => queryLower.includes(kw));

    if (wantsHuman || (intent === 'escalate' && leadScore >= 40)) {
        return { intent: 'escalate', uiAction: { type: 'escalation_pending', message: 'Routing to team' } };
    }

    if (wantsBook || intent === 'book_meeting') {
        if (leadScore >= bookThreshold - 15 || stage === 'anchor' || stage === 'book') {
            return { intent: 'book_meeting', uiAction: { type: 'show_slots_pending' } };
        }
        return { intent: 'qualify', uiAction: null };
    }

    if (leadScore >= escalationThreshold && intent === 'qualify') {
        return {
            intent: 'escalate',
            uiAction: { type: 'escalation_pending', message: 'Hot lead — notify team' },
        };
    }

    if (intent === 'escalate' && leadScore < 40) {
        return { intent: 'qualify', uiAction: null };
    }

    return { intent, uiAction: null };
}

module.exports = {
    routeIntent,
    VALID_INTENTS,
    VALID_STAGES,
};