// ─────────────────────────────────────────────────────────────
// RAG — embeddings via HuggingFace Inference API + cosine
// similarity. Port of backend/services/embedding_service.py +
// backend/services/knowledge_store.py.
// ─────────────────────────────────────────────────────────────
//
// Uses HF router (https://router.huggingface.co/hf-inference/...)
// which works with HF_API_KEY. Embeddings are 384-dim from
// sentence-transformers/all-MiniLM-L6-v2.

const HF_API_KEY = (process.env.HF_API_KEY || '').trim();
const HF_EMBEDDING_MODEL = (process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2').trim();
const EMBEDDING_DIM = 384;

const HF_URLS = [
    `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}`,
    `https://api-inference.huggingface.co/models/${HF_EMBEDDING_MODEL}`,
];

function getSupabase() {
    try {
        const mod = require('../index.js');
        if (typeof mod.getSupabase === 'function') return mod.getSupabase();
    } catch (_) {}
    return null;
}

function toVectors(result) {
    if (!result) return [];
    if (Array.isArray(result)) {
        if (result.length === 0) return [];
        if (Array.isArray(result[0])) return result.map((row) => row.map(Number));
        return [result.map(Number)];
    }
    return [];
}

function padToDim(vector) {
    if (!Array.isArray(vector)) return new Array(EMBEDDING_DIM).fill(0);
    if (vector.length >= EMBEDDING_DIM) return vector.slice(0, EMBEDDING_DIM);
    return vector.concat(new Array(EMBEDDING_DIM - vector.length).fill(0));
}

async function embedText(text) {
    if (!HF_API_KEY) {
        // No embedding key — return zero vector so downstream similarity
        // is 0 and we fall through to "no relevant context" without
        // crashing the whole chat.
        return new Array(EMBEDDING_DIM).fill(0);
    }

    let lastErr;
    for (const url of HF_URLS) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: text }),
                signal: AbortSignal.timeout(30000),
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                lastErr = new Error(`HF ${res.status}: ${errText}`);
                continue;
            }
            const data = await res.json();
            const vecs = toVectors(data);
            if (!vecs.length) {
                lastErr = new Error('HF returned no vectors');
                continue;
            }
            return padToDim(vecs[0]);
        } catch (err) {
            lastErr = err;
        }
    }
    console.warn('[rag] embed failed:', lastErr ? lastErr.message : 'unknown');
    return new Array(EMBEDDING_DIM).fill(0);
}

function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// In-memory knowledge store (matches Python IN_MEMORY_KNOWLEDGE)
const _IN_MEMORY_KNOWLEDGE = [];
const CYPHERSWIFT_DOMAIN_SUFFIX = '@cypherswift.com';

function storeChunks(rows, { companyId = null } = {}) {
    for (const row of rows || []) {
        _IN_MEMORY_KNOWLEDGE.push({
            content: row.content,
            embedding: row.embedding,
            source_file: row.source_file || '',
            company_id: companyId,
        });
    }
    return (rows || []).length;
}

function searchChunksInMemory(queryEmbedding, topK = 5, { companyId = null } = {}) {
    if (!_IN_MEMORY_KNOWLEDGE.length) return [];
    const qNorm = Math.sqrt(queryEmbedding.reduce((s, v) => s + v * v, 0));
    if (qNorm === 0) return [];

    const scored = [];
    for (const chunk of _IN_MEMORY_KNOWLEDGE) {
        if (companyId && chunk.company_id && chunk.company_id !== companyId) continue;
        const vNorm = Math.sqrt((chunk.embedding || []).reduce((s, v) => s + v * v, 0));
        if (vNorm === 0) continue;
        const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
        scored.push({ sim, content: chunk.content });
    }
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, topK).map((s) => s.content);
}

async function retrieveContext(query, opts = {}) {
    const { user = null, topK = 5 } = opts;
    const queryEmbedding = await embedText(query);
    const allZero = queryEmbedding.every((v) => v === 0);

    let chunks = [];

    const sb = getSupabase();
    if (sb && !allZero) {
        try {
            const { data, error } = await sb.rpc('match_chunks', {
                query_embedding: queryEmbedding,
                match_count: topK,
            });
            if (!error && data) {
                const valid = (data || []).filter(
                    (row) =>
                        row.similarity !== undefined &&
                        row.similarity !== null &&
                        !Number.isNaN(Number(row.similarity)) &&
                        Number(row.similarity) > 0,
                );
                chunks = valid.map((row) => row.content);
            }
        } catch (err) {
            console.warn('[rag] Supabase match_chunks failed:', err.message);
        }
    }

    if (!chunks.length) {
        let companyId = null;
        try {
            const email = (user && user.email) || '';
            if (email.toLowerCase().endsWith(CYPHERSWIFT_DOMAIN_SUFFIX)) companyId = 'cypherswift';
        } catch (_) {
            companyId = null;
        }
        chunks = searchChunksInMemory(queryEmbedding, topK, { companyId });
    }

    if (!chunks.length) return 'No relevant information found.';
    return chunks.join('\n\n---\n\n');
}

module.exports = {
    embedText,
    cosineSimilarity,
    storeChunks,
    searchChunksInMemory,
    retrieveContext,
    EMBEDDING_DIM,
};