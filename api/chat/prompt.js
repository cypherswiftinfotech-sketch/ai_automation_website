// ─────────────────────────────────────────────────────────────
// Prompt builder — assembles the system prompt for the consultant
// LLM. Port of backend/services/persona_service.py +
// backend/services/structured_memory_service.py.
// ─────────────────────────────────────────────────────────────

const { getSettings } = require('./settings');
const { missingQualifyFields } = require('./lead-scoring');

const STAGE_GUIDANCE = {
    discover:
        "Stage: INTRO — Introduce yourself as Avor. In your VERY FIRST turn ONLY, warmly greet them by name, state the problem or service they selected on the form, and explicitly ask if they are ready to learn more about it. CRITICAL: Do NOT repeat the greeting in subsequent turns. WAIT for the user to respond.",
    qualify:
        "Stage: EXPLAIN SERVICE — The user has confirmed they want to learn about the service. Explicitly explain the procedure and details about the service using the knowledge base. Once explained, immediately transition towards suggesting a meeting.",
    anchor:
        "Stage: EXPLAIN SERVICE — (Continued) Answer any remaining questions , then transition to booking.",
    book:
        "Stage: BOOK (Meeting Scheduling) — Verify you have the user's Name, Email, Company, and Team Size. If any are missing, politely ask for them. DO NOT set intent to 'book_meeting' until you have captured at least their Name and Email. Once you have their Name and Email, set intent to 'book_meeting'. The system will show real available slots automatically. If the user has already been shown slots and picks one, set selected_slot_index to that slot's index. CRITICAL: Do NOT invent or hallucinate any meeting times.",
    closed:
        "Stage: CLOSED (Conclusion) — Meeting is already scheduled. Answer any further questions they have about the service. Do NOT attempt to book another meeting.",
};

const FRAMEWORK_INSTRUCTION = `
STRICT CONVERSATION FLOW:
1. Introduction: Introduce yourself as Avor and mention the problem/service selected on their form. (DO THIS ONLY ONCE)
2. Explain Service: Explain the procedure and details about the selected service.
3. Schedule Meeting: Before scheduling, collect their Name, Email, Company, and Team Size. Once Name and Email are captured, set intent to 'book_meeting'. The system will show available slots automatically. NEVER invent times yourself.
4. Post-Booking: After the meeting is scheduled, you can continue discussing the service if they have more questions, but do not ask to book again.

CRITICAL RULES TO AVOID LOOPING:
- NEVER repeat a conversation phase you have already completed.
- NEVER invent, hallucinate, or make up meeting times or dates. The real calendar slots are handled by the system.
- NEVER talk to yourself or generate a response for the user.
- You must ask exactly ONE question at a time and WAIT explicitly for the user to answer before continuing.
`;

const JSON_OUTPUT_INSTRUCTION = `
You MUST respond with valid JSON only — no markdown, no preamble. Use this exact schema:
{
  "intent": "rag_answer" | "qualify" | "book_meeting" | "escalate",
  "answer": "<spoken response, 2-4 sentences max, conversational>",
  "lead_signals": {
    "pain": "<pain point or null>",
    "budget_hint": "<budget signal or null>",
    "timeline_hint": "<timeline signal or null>",
    "authority_hint": "<decision-maker signal or null>",
    "intent_strength": "low" | "medium" | "high" | null
  },
  "qualified_fields": {
    "name": "<prospect's full name — extract from ANY message where they introduce themselves, e.g. 'I'm Sagar', 'my name is John' — or null>",
    "email": "<business email address if mentioned — or null>",
    "phone": "<phone or WhatsApp number if mentioned — or null>",
    "company_name": "<company/org name if mentioned — or null>",
    "role": "<their job title or designation — or null>",
    "industry_type": "<industry/sector they operate in — or null>",
    "budget_range": "<budget range if mentioned — or null>",
    "expected_timeline": "<project timeline e.g. 'immediately', 'within 1 month' — or null>",
    "num_employees": "<team or company size if mentioned — or null>"
  },
  "objections": ["<any new objection heard this turn>"],
  "score_delta": <integer 0-25>,
  "next_stage": "discover" | "qualify" | "anchor" | "book" | "closed",
  "selected_slot_index": null
}

CRITICAL — Field extraction rules:
- Extract name/email/phone/company from ANY turn where the user volunteers this info.
- Example: "I'm Sagar from ABC" → name="Sagar", company_name="ABC"
- Example: "we have a team of 10" → num_employees="10"
- ALWAYS populate qualified_fields keys you know. Never leave a known value as null.
- Only set null if you genuinely don't know the value yet.

IMPORTANT — Oral slot booking:
When the user has been shown available meeting slots and then verbally picks one
(e.g. "book the 2 PM one", "I'll take the first slot", "the second time works",
"book Monday 10 AM", "yes, that one"), set:
  - "intent": "book_meeting"
  - "selected_slot_index": <0-based integer index of the chosen slot from the list in the context>
If the user has NOT picked a specific slot, keep "selected_slot_index": null.
`;

async function buildStructuredMemory({
    userId,
    conversationId,
    qualifiedFields = {},
    objections = [],
    questionsAsked = [],
    topicsDiscussed = [],
    stageHistory = [],
    historyText = '',
}) {
    // Past summaries from other conversations (best effort).
    const pastSummaries = await fetchPastSummaries(userId, conversationId, 1);

    const parts = [];
    if (pastSummaries.length) {
        parts.push('Prior sessions with this user:');
        pastSummaries.forEach((s, i) => parts.push(`  ${i + 1}. ${s}`));
    }

    const missing = missingQualifyFields(qualifiedFields);
    if (missing.length) parts.push(`\nQualification gaps (still need): ${missing.join(', ')}`);

    const filled = Object.fromEntries(
        Object.entries(qualifiedFields).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    if (Object.keys(filled).length) parts.push(`Known about this lead: ${JSON.stringify(filled)}`);

    if (objections.length) parts.push(`Objections raised: ${objections.slice(-5).join('; ')}`);

    if (questionsAsked.length) {
        parts.push('Questions already asked (do NOT repeat):');
        questionsAsked.slice(-5).forEach((q) => parts.push(`  - ${q}`));
    }

    if (topicsDiscussed.length) parts.push(`Topics covered this session: ${topicsDiscussed.slice(-5).join(', ')}`);

    if (stageHistory.length) {
        const path = stageHistory.slice(-5).map((e) => e.stage).join(' → ');
        parts.push(`Stage path so far: ${path}`);
    }

    if (historyText) parts.push(`\nRecent messages:\n${historyText}`);

    return parts.length ? parts.join('\n') : (historyText || '');
}

async function fetchPastSummaries(userId, excludeConvId, limit = 1) {
    const sb = (() => {
        try {
            const mod = require('../index.js');
            return typeof mod.getSupabase === 'function' ? mod.getSupabase() : null;
        } catch (_) {
            return null;
        }
    })();
    if (!sb) return [];
    try {
        let q = sb.from('conversations').select('id, summary, title').eq('user_id', userId)
            .eq('status', 'ended')
            .not('summary', 'is', null)
            .order('ended_at', { ascending: false })
            .limit(limit + 1);
        const { data, error } = await q;
        if (error || !data) return [];
        const out = [];
        for (const row of data) {
            if (excludeConvId && row.id === excludeConvId) continue;
            const text = row.summary || row.title;
            if (text) out.push(text);
            if (out.length >= limit) break;
        }
        return out;
    } catch (err) {
        console.warn('[prompt] fetchPastSummaries failed:', err.message);
        return [];
    }
}

async function buildSystemPrompt({
    stage = 'discover',
    leadScore = 0,
    leadStatus = 'cold',
    signals = {},
    qualifiedFields = {},
    structuredMemory = '',
    missingFields = null,
    language = 'en',
}) {
    const settings = await getSettings();
    const basePrompt = settings.system_prompt || '';
    const playbook = settings.consultant_playbook || '';
    const qualQuestions = settings.qualification_questions || [];

    let stageBlock = STAGE_GUIDANCE[stage] || STAGE_GUIDANCE.discover;
    if (playbook) stageBlock = `${stageBlock}\n\nPlaybook:\n${playbook}`;

    let qualBlock = '';
    if (qualQuestions.length && (stage === 'discover' || stage === 'qualify')) {
        qualBlock = '\n\nSuggested qualifying questions (use naturally, one at a time):\n';
        qualBlock += qualQuestions.map((q) => `- ${q}`).join('\n');
    }

    const missing = missingFields || missingQualifyFields(qualifiedFields);
    if (missing.length) qualBlock += `\n\nStill need to learn: ${missing.join(', ')}`;

    const leadContext =
        `\n\nLead profile:\n` +
        `- Score: ${leadScore}/100 (${leadStatus})\n` +
        `- Current stage: ${stage}\n` +
        `- Signals so far: ${signals && Object.keys(signals).length ? JSON.stringify(signals) : 'none'}\n` +
        `- Qualified fields: ${qualifiedFields && Object.keys(qualifiedFields).length ? JSON.stringify(qualifiedFields) : 'none'}`;

    const memoryBlock = structuredMemory ? `\n\nStructured memory:\n${structuredMemory}` : '';

    const languageInstruction =
        language === 'multi' || !language
            ? "LANGUAGE RULE: You MUST detect what language the user is speaking and reply in that SAME language. If the user switches language mid-conversation, immediately follow them. Never force a language — always mirror the user."
            : `LANGUAGE RULE: The user has explicitly selected the language code '${language}'. You MUST generate ALL of your spoken responses strictly in the language corresponding to ISO code '${language}'. Even if the user speaks a different language, your response MUST be in the language for code '${language}'.`;

    const routingRules = `
Intent routing rules:
- rag_answer: Answer from knowledge base; default for informational questions.
- qualify: Ask a qualifying question when you need more info.
- book_meeting: When it is time to schedule a meeting, set intent to 'book_meeting'.
  CRITICAL: Do NOT invent, make up, or say ANY specific dates or times (like 'Monday 10 AM').
  Just say something like 'Let me pull up available times for you' and set intent to 'book_meeting'.
  The system will automatically show real available time slots to the user.
  If the user verbally selects a specific slot from the available slots shown, set selected_slot_index to the 0-based index of that slot.
- escalate: Route to human when they explicitly ask, or pain is urgent and score >= threshold.
Keep answers concise — they will be spoken aloud by an avatar.`;

    return (
        `${basePrompt}\n\n${FRAMEWORK_INSTRUCTION}\n\n${stageBlock}${qualBlock}${leadContext}` +
        `${memoryBlock}\n\n${routingRules}\n\n${languageInstruction}\n\n${JSON_OUTPUT_INSTRUCTION}`
    );
}

module.exports = {
    buildSystemPrompt,
    buildStructuredMemory,
    fetchPastSummaries,
};