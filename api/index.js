// ─────────────────────────────────────────────────────────────
// Cypher Swift InfoTech — Vercel Serverless API Handler
// Manages secure Supabase database proxying,
// and handles email delivery using Nodemailer (Gmail SMTP).
// ─────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const {
    defaultSeoPages,
    getSeoForSlug,
    loadSeoPages
} = require('../lib/seo-utils');
const { getBranchBySlug, getSlimBranches, seedBranchesIfEmpty } = require('../lib/branch-db');
const { buildLocalBusinessSchemaObject } = require('../lib/build-schema');

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';
const DEFAULT_AVATAR_ID = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';

// Initialize Supabase Backend Client (lazy)
let supabase = null;
function getSupabase() {
    if (!supabase) {
        supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
    }
    return supabase;
}

// ── In-Memory Database Fallbacks (for out-of-the-box local operation) ──
let memoryLeads = [];
let memorySettings = {
    revenue: "₹3Cr+",
    growth: "2.5x",
    automation: "70%",
    notification_email: "craftersofa974263@gmail.com",
    api_location: "https://ai-automation-website-mnhk.vercel.app"
};
let memorySeoPages = defaultSeoPages.map((p, idx) => ({ id: `seo-${idx + 1}`, ...p }));

let memoryCaseStudies = [
    {
        id: "cs-sample-1",
        category: "B2B SaaS",
        title: "Scalable Qualified Lead Systems",
        summary: "Engineering automated multi-channel acquisition pipelines to replace manual cold sales efforts.",
        challenge: "Outbound sales reps spending 80% of time prospecting manually, leading to low pipeline volume and high customer acquisition costs.",
        solution: "Deployed customized AI intent scrapers coupled with dynamic sequence personalization across LinkedIn & email channels.",
        metric1_val: "2.5x", metric1_lbl: "Qualified Pipeline",
        metric2_val: "60 Days", metric2_lbl: "Deployment Speed",
        metric3_val: "₹48L", metric3_lbl: "New Pipeline Generated"
    },
    {
        id: "cs-sample-2",
        category: "Manufacturing",
        title: "Sales Engagement Redesign",
        summary: "Connecting CRM workflows and auto-dialers to optimize lead contact rate and speed-to-lead times.",
        challenge: "Response time to inbound demo inquiries averaged 14 hours. High drop-off in prospect interest and poor conversion rates.",
        solution: "Integrated automated speed-to-lead triggers using WhatsApp API and custom notification alerts for sales desks.",
        metric1_val: "4 Mins", metric1_lbl: "Avg Speed-To-Lead",
        metric2_val: "180%", metric2_lbl: "Demo Bookings Increase",
        metric3_val: "₹1.2Cr", metric3_lbl: "Sourced Opportunity Value"
    },
    {
        id: "cs-sample-3",
        category: "IT Services",
        title: "Partner Program Growth Blueprint",
        summary: "Setting up custom revenue hubs, pipeline builders, and predictive forecasting dashboards.",
        challenge: "Disparate data across spreadsheets and legacy systems prevented management from forecasting quarterly revenues accurately.",
        solution: "Aligned sales, marketing and service operations onto a single source-of-truth RevOps pipeline infrastructure.",
        metric1_val: "94%", metric1_lbl: "Forecast Accuracy",
        metric2_val: "35%", metric2_lbl: "Sales Cycle Velocity",
        metric3_val: "₹85L", metric3_lbl: "Operational Cost Savings"
    },
    {
        id: "cs-sample-4",
        category: "FinTech",
        title: "RevOps & Pipeline Standardization",
        summary: "Integrating unified marketing and sales automation loops to eliminate duplicate leads and process friction.",
        challenge: "Disjointed data handoffs between marketing tools and CRM resulted in duplicate customer records and missed follow-ups.",
        solution: "Standardized field validations, duplicate filters, and real-time alerts across core business software integrations.",
        metric1_val: "0%", metric1_lbl: "Lost Data Hand-offs",
        metric2_val: "₹65L", metric2_lbl: "Addtl. Annual Revenue",
        metric3_val: "100%", metric3_lbl: "Integrative Accuracy"
    }
];

// Gmail SMTP Transporter (lazy init)
let transporter = null;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return transporter;
}

// ── Helper: Fetch HeyGen avatar metadata (server-side) ───────
function fetchHeygenAvatar(avatarId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.liveavatar.com',
            path: `/v1/avatars/${encodeURIComponent(avatarId)}`,
            method: 'GET',
            headers: { 'X-API-KEY': HEYGEN_API_KEY },
            timeout: 10000,
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HeyGen returned ${res.statusCode}: ${body}`));
                }
                try {
                    const parsed = JSON.parse(body);
                    const avatar = parsed && parsed.data ? parsed.data : parsed;
                    resolve(avatar);
                } catch (err) {
                    reject(new Error(`Invalid JSON from HeyGen: ${err.message}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('HeyGen request timed out')); });
        req.end();
    });
}

// ── Helper: Authenticate Admin via Bearer Token ───────────────
async function authenticateAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, status: 401, message: 'Missing authorization header' };
    }
    const token = authHeader.split(' ')[1];

    // Check fallback static token first
    const fallbackEmail = process.env.ADMIN_EMAIL || 'admin@cypherswift.com';
    const staticToken = Buffer.from(fallbackEmail).toString('base64') + "_static_session";
    if (token === staticToken) {
        return { authenticated: true, user: { email: fallbackEmail } };
    }

    try {
        const { data: { user }, error } = await getSupabase().auth.getUser(token);
        if (error || !user) {
            return { authenticated: false, status: 401, message: 'Invalid or expired session' };
        }
        return { authenticated: true, user };
    } catch (err) {
        return { authenticated: false, status: 401, message: 'Authentication error' };
    }
}

// ── Helper: Parse JSON body ───────────────────────────────────
function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body) {
            resolve(req.body);
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

// ── Helper: Set CORS headers ─────────────────────────────────
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Main Route Handler ───────────────────────────────────────
module.exports = async function handler(req, res) {
    setCors(res);

    // Handle preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parse the route path: /api/stats, /api/leads, /api/admin/login, etc.
    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';

    // Also parse the /query/* chat routes so the same handler can serve
    // the embedded chatbot (frontend calls /query/init, /query/ask,
    // /query/book-meeting, /query/lead/{id}). Strips /query prefix.
    const queryPath = url.pathname.replace(/^\/query/, '').replace(/\/$/, '') || '/';

    try {
        // ── Public Routes ─────────────────────────────────────

        // GET /api/health
        if (path === '/health' && req.method === 'GET') {
            return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        }

        // GET /api/avatar-preview?avatar_id=...
        // Proxies HeyGen's /v1/avatars/{id} endpoint server-side and returns
        // the preview_url so the frontend chat button can show the avatar image
        // without exposing the HEYGEN_API_KEY.
        if (path === '/avatar-preview' && req.method === 'GET') {
            const avatarId = url.searchParams.get('avatar_id') || DEFAULT_AVATAR_ID;
            if (!HEYGEN_API_KEY) {
                return res.status(500).json({ success: false, message: 'HEYGEN_API_KEY is not configured on the server.' });
            }
            try {
                const avatar = await fetchHeygenAvatar(avatarId);
                return res.status(200).json({
                    success: true,
                    data: { id: avatar.id, name: avatar.name, preview_url: avatar.preview_url },
                });
            } catch (err) {
                console.error('avatar-preview error:', err);
                return res.status(502).json({ success: false, message: `HeyGen avatar fetch failed: ${err.message}` });
            }
        }

        // GET /api/schema?location=slug
        if (path === '/schema' && req.method === 'GET') {
            seedBranchesIfEmpty();
            const slug = url.searchParams.get('location');
            if (!slug) {
                return res.status(400).json({ error: 'location query parameter is required' });
            }
            const branch = getBranchBySlug(slug);
            if (!branch) {
                return res.status(404).json({ error: 'Branch not found' });
            }
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).json(buildLocalBusinessSchemaObject(branch));
        }

        // GET /api/branches
        if (path === '/branches' && req.method === 'GET') {
            seedBranchesIfEmpty();
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).json(getSlimBranches());
        }

        // GET /api/stats
        if (path === '/stats' && req.method === 'GET') {
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_settings').limit(1);
                if (error) throw error;
                return res.status(200).json({ success: true, data: data && data.length > 0 ? JSON.parse(data[0].image_url) : memorySettings });
            } catch (err) {
                console.warn('Fetch stats database connection warning (using memory fallback):', err.message);
                return res.status(200).json({ success: true, data: memorySettings });
            }
        }

        // GET /api/seo
        if (path === '/seo' && req.method === 'GET') {
            try {
                const slug = url.searchParams.get('slug');
                if (slug) {
                    const seo = await getSeoForSlug(getSupabase(), slug, memorySeoPages);
                    return res.status(200).json({ success: true, data: seo });
                }
                const pages = memorySeoPages.length > 0
                    ? memorySeoPages
                    : await loadSeoPages(getSupabase());
                return res.status(200).json({ success: true, data: pages });
            } catch (err) {
                console.warn('Fetch SEO warning:', err.message);
                return res.status(200).json({ success: true, data: defaultSeoPages });
            }
        }

        // GET /api/case-studies
        if (path === '/case-studies' && req.method === 'GET') {
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_case_study').order('created_at', { ascending: true });
                if (error) throw error;
                const formatted = (data || []).map(item => ({
                    id: item.id,
                    ...JSON.parse(item.image_url)
                }));
                return res.status(200).json({ success: true, data: formatted.length > 0 ? formatted : memoryCaseStudies });
            } catch (err) {
                console.warn('Fetch case studies database connection warning (using memory fallback):', err.message);
                return res.status(200).json({ success: true, data: memoryCaseStudies });
            }
        }

        // POST /api/leads
        if (path === '/leads' && req.method === 'POST') {
            const body = await parseBody(req);
            const { name, email, website, companySize, requestType, strategicContext } = body;

            if (!name || !email) {
                return res.status(400).json({ success: false, message: 'Name and email are required.' });
            }

            const payload = { name, email, website, size: companySize, type: requestType, context: strategicContext };

            // Save to memory storage
            const leadId = "lead_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
            memoryLeads.unshift({
                id: leadId,
                image_url: JSON.stringify(payload),
                category: 'cs_lead',
                created_at: new Date().toISOString()
            });

            try {
                const { error: dbError } = await getSupabase().from('images').insert([{
                    image_url: JSON.stringify(payload),
                    category: 'cs_lead'
                }]);
                if (dbError) console.warn("Supabase Lead Insertion Warning:", dbError.message);
            } catch (dbErr) {
                console.warn("Supabase Lead Insertion Error (using memory fallback):", dbErr.message);
            }

            try {
                const readableType = {
                    'diagnostic': '5-Day AI Growth Diagnostic',
                    'strategy': 'Strategy Blueprint Session',
                    'case-study': 'Full Case Study Request',
                    'partnership': 'Retainer Partnership Discussion'
                }[requestType] || requestType;

                const htmlBody = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f111a; color: #e2e8f0; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
                    <div style="background: linear-gradient(135deg, #5c67f2, #a855f7); padding: 24px 32px;">
                        <h1 style="margin: 0; font-size: 22px; color: #fff;">🚀 New Lead Inquiry</h1>
                        <p style="margin: 6px 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">CypherSwift InfoTech — Revenue Management Hub</p>
                    </div>
                    <div style="padding: 28px 32px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; color: #94a3b8; font-size: 13px; width: 140px; vertical-align: top;">Full Name</td>
                                <td style="padding: 10px 0; color: #fff; font-weight: 600;">${name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #94a3b8; font-size: 13px; border-top: 1px solid #1e293b;">Business Email</td>
                                <td style="padding: 10px 0; color: #38bdf8; border-top: 1px solid #1e293b;">
                                    <a href="mailto:${email}" style="color: #38bdf8; text-decoration: none;">${email}</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #94a3b8; font-size: 13px; border-top: 1px solid #1e293b;">Company Website</td>
                                <td style="padding: 10px 0; color: #38bdf8; border-top: 1px solid #1e293b;">
                                    <a href="${website}" target="_blank" style="color: #38bdf8; text-decoration: none;">${website || 'Not provided'}</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #94a3b8; font-size: 13px; border-top: 1px solid #1e293b;">Company Size</td>
                                <td style="padding: 10px 0; color: #fff; border-top: 1px solid #1e293b;">${companySize || 'Not specified'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #94a3b8; font-size: 13px; border-top: 1px solid #1e293b;">Request Type</td>
                                <td style="padding: 10px 0; border-top: 1px solid #1e293b;">
                                    <span style="background: rgba(92,103,242,0.2); color: #818cf8; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">${readableType}</span>
                                </td>
                            </tr>
                            ${strategicContext ? `
                            <tr>
                                <td colspan="2" style="padding: 16px 0 0; border-top: 1px solid #1e293b;">
                                    <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">Strategic Context</div>
                                    <div style="background: #1e293b; padding: 14px; border-radius: 8px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">${strategicContext}</div>
                                </td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    <div style="background: #0b0d14; padding: 16px 32px; text-align: center; font-size: 12px; color: #475569;">
                        Sent from CypherSwift InfoTech Website • ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                </div>
                `;

                const mailOptions = {
                    from: `"CypherSwift InfoTech" <${process.env.EMAIL_USER}>`,
                    to: [process.env.NOTIFICATION_EMAIL || 'info@cypherswift.com', process.env.EMAIL_USER].join(', '),
                    replyTo: email,
                    subject: `🚀 New Lead: ${name} — ${readableType}`,
                    html: htmlBody
                };

                await getTransporter().sendMail(mailOptions);
                return res.status(200).json({ success: true, message: 'Lead submitted and email sent successfully!' });
            } catch (err) {
                console.error('Lead submission email delivery error:', err.message);
                return res.status(200).json({ success: true, message: 'Lead logged successfully! (Email notification error)' });
            }
        }

        // ── Admin Routes ──────────────────────────────────────

        // POST /api/admin/login
        if (path === '/admin/login' && req.method === 'POST') {
            const body = await parseBody(req);
            const { email, password } = body;

            const fallbackEmail = process.env.ADMIN_EMAIL || 'admin@cypherswift.com';
            const fallbackPassword = process.env.ADMIN_PASSWORD || 'adminpass123';

            if (email === fallbackEmail && password === fallbackPassword) {
                const staticToken = Buffer.from(fallbackEmail).toString('base64') + "_static_session";
                return res.status(200).json({
                    success: true,
                    session: {
                        access_token: staticToken,
                        user: { email: fallbackEmail }
                    }
                });
            }

            try {
                const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
                if (error) {
                    return res.status(400).json({ success: false, message: error.message });
                }
                return res.status(200).json({ success: true, session: data.session });
            } catch (err) {
                console.error('Admin login error:', err.message);
                return res.status(500).json({ success: false, message: 'Internal server login error' });
            }
        }

        // GET /api/admin/leads
        if (path === '/admin/leads' && req.method === 'GET') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_lead').order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, data: data.length > 0 ? data : memoryLeads });
            } catch (err) {
                console.warn('Get leads DB warning, returning memory fallback:', err.message);
                return res.status(200).json({ success: true, data: memoryLeads });
            }
        }

        // DELETE /api/admin/leads/:id
        if (path.startsWith('/admin/leads/') && req.method === 'DELETE') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            const id = path.split('/admin/leads/')[1];
            memoryLeads = memoryLeads.filter(l => String(l.id) !== String(id));
            try {
                const { error } = await getSupabase().from('images').delete().eq('id', id);
                if (error) console.warn("Supabase Delete Lead Warning:", error.message);
                return res.status(200).json({ success: true, message: 'Lead deleted successfully' });
            } catch (err) {
                console.warn('Delete lead DB error (completed in memory):', err.message);
                return res.status(200).json({ success: true, message: 'Lead deleted successfully (memory fallback)' });
            }
        }

        // GET /api/admin/settings
        if (path === '/admin/settings' && req.method === 'GET') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_settings').limit(1);
                if (error) throw error;
                return res.status(200).json({ success: true, data: data && data.length > 0 ? data[0] : { id: 'memory_settings', image_url: JSON.stringify(memorySettings) } });
            } catch (err) {
                console.warn('Get settings DB error, returning memory settings:', err.message);
                return res.status(200).json({ success: true, data: { id: 'memory_settings', image_url: JSON.stringify(memorySettings) } });
            }
        }

        // POST /api/admin/settings
        if (path === '/admin/settings' && req.method === 'POST') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            const body = await parseBody(req);
            const { id, payload } = body;
            memorySettings = { ...memorySettings, ...payload };
            try {
                if (id && id !== 'memory_settings') {
                    const { error } = await getSupabase().from('images').update({
                        image_url: JSON.stringify(payload)
                    }).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await getSupabase().from('images').insert([{
                        image_url: JSON.stringify(payload),
                        category: 'cs_settings'
                    }]);
                    if (error) throw error;
                }
                return res.status(200).json({ success: true, message: 'Global config saved successfully' });
            } catch (err) {
                console.warn('Save settings DB error (completed in memory):', err.message);
                return res.status(200).json({ success: true, message: 'Global config saved successfully (memory fallback)' });
            }
        }

        // GET /api/admin/case-studies
        if (path === '/admin/case-studies' && req.method === 'GET') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_case_study').order('created_at', { ascending: true });
                if (error) throw error;
                return res.status(200).json({ success: true, data: data.length > 0 ? data : memoryCaseStudies.map((s, idx) => ({ id: s.id || `cs-sample-${idx}`, image_url: JSON.stringify(s) })) });
            } catch (err) {
                console.warn('Get case studies DB error, returning memory fallback:', err.message);
                return res.status(200).json({ success: true, data: memoryCaseStudies.map((s, idx) => ({ id: s.id || `cs-sample-${idx}`, image_url: JSON.stringify(s) })) });
            }
        }

        // POST /api/admin/case-studies
        if (path === '/admin/case-studies' && req.method === 'POST') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            const body = await parseBody(req);
            const { id, payload } = body;

            if (id) {
                const idx = memoryCaseStudies.findIndex(s => String(s.id) === String(id));
                if (idx !== -1) {
                    memoryCaseStudies[idx] = { id, ...payload };
                } else {
                    memoryCaseStudies.push({ id, ...payload });
                }
            } else {
                const newId = "study_" + Date.now();
                memoryCaseStudies.push({ id: newId, ...payload });
            }

            try {
                if (id && !String(id).startsWith('study_') && !String(id).startsWith('cs-sample-')) {
                    const { error } = await getSupabase().from('images').update({
                        image_url: JSON.stringify(payload)
                    }).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await getSupabase().from('images').insert([{
                        image_url: JSON.stringify(payload),
                        category: 'cs_case_study'
                    }]);
                    if (error) throw error;
                }
                return res.status(200).json({ success: true, message: 'Case study saved successfully' });
            } catch (err) {
                console.warn('Save case study DB error (completed in memory):', err.message);
                return res.status(200).json({ success: true, message: 'Case study saved successfully (memory fallback)' });
            }
        }

        // DELETE /api/admin/case-studies/:id
        if (path.startsWith('/admin/case-studies/') && req.method === 'DELETE') {
            // Exclude /admin/case-studies/seed
            if (path === '/admin/case-studies/seed') {
                // handled below
            } else {
                const auth = await authenticateAdmin(req);
                if (!auth.authenticated) {
                    return res.status(auth.status).json({ success: false, message: auth.message });
                }
                const id = path.split('/admin/case-studies/')[1];
                memoryCaseStudies = memoryCaseStudies.filter(s => String(s.id) !== String(id));
                try {
                    const { error } = await getSupabase().from('images').delete().eq('id', id);
                    if (error) throw error;
                    return res.status(200).json({ success: true, message: 'Case study deleted successfully' });
                } catch (err) {
                    console.warn('Delete case study DB error (completed in memory):', err.message);
                    return res.status(200).json({ success: true, message: 'Case study deleted successfully (memory fallback)' });
                }
            }
        }

        // GET /api/admin/seo
        if (path === '/admin/seo' && req.method === 'GET') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            try {
                const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_seo').order('created_at', { ascending: true });
                if (error) throw error;
                if (data && data.length > 0) {
                    return res.status(200).json({ success: true, data });
                }
                return res.status(200).json({ success: true, data: memorySeoPages.map(p => ({ id: p.id, image_url: JSON.stringify(p) })) });
            } catch (err) {
                console.warn('Get SEO DB error, returning memory fallback:', err.message);
                return res.status(200).json({ success: true, data: memorySeoPages.map(p => ({ id: p.id, image_url: JSON.stringify(p) })) });
            }
        }

        // POST /api/admin/seo
        if (path === '/admin/seo' && req.method === 'POST') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            const body = await parseBody(req);
            const { id, payload } = body;

            if (!payload || !payload.slug) {
                return res.status(400).json({ success: false, message: 'Page slug is required' });
            }
            if (!payload.meta_description || !payload.meta_description.trim()) {
                return res.status(400).json({ success: false, message: 'Meta Description is required' });
            }

            const idx = memorySeoPages.findIndex(p => p.slug === payload.slug);
            if (idx !== -1) {
                memorySeoPages[idx] = { ...memorySeoPages[idx], ...payload, id: id || memorySeoPages[idx].id };
            } else {
                memorySeoPages.push({ id: id || `seo_${Date.now()}`, ...payload });
            }

            try {
                if (id && !String(id).startsWith('seo-') && !String(id).startsWith('seo_')) {
                    const { error } = await getSupabase().from('images').update({
                        image_url: JSON.stringify(payload)
                    }).eq('id', id);
                    if (error) throw error;
                } else {
                    const { data: existing } = await getSupabase().from('images').select('id, image_url').eq('category', 'cs_seo');
                    const existingRow = (existing || []).find(row => {
                        try { return JSON.parse(row.image_url).slug === payload.slug; } catch (e) { return false; }
                    });
                    if (existingRow) {
                        const { error } = await getSupabase().from('images').update({
                            image_url: JSON.stringify(payload)
                        }).eq('id', existingRow.id);
                        if (error) throw error;
                    } else {
                        const { error } = await getSupabase().from('images').insert([{
                            image_url: JSON.stringify(payload),
                            category: 'cs_seo'
                        }]);
                        if (error) throw error;
                    }
                }
                return res.status(200).json({ success: true, message: 'SEO settings saved successfully' });
            } catch (err) {
                console.warn('Save SEO DB error (completed in memory):', err.message);
                return res.status(200).json({ success: true, message: 'SEO settings saved successfully (memory fallback)' });
            }
        }

        // POST /api/admin/seo/seed
        if (path === '/admin/seo/seed' && req.method === 'POST') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            memorySeoPages = defaultSeoPages.map((p, idx) => ({ id: `seo-${idx + 1}`, ...p }));

            try {
                const { error: deleteError } = await getSupabase().from('images').delete().eq('category', 'cs_seo');
                if (deleteError) console.warn('SEO seed delete warning:', deleteError.message);

                const inserts = defaultSeoPages.map(page => ({
                    image_url: JSON.stringify(page),
                    category: 'cs_seo'
                }));
                const { error } = await getSupabase().from('images').insert(inserts);
                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Default SEO pages seeded successfully' });
            } catch (err) {
                console.warn('Seed SEO database warning (seeded in memory):', err.message);
                return res.status(200).json({ success: true, message: 'Default SEO pages seeded successfully (memory fallback)' });
            }
        }

        // POST /api/admin/case-studies/seed
        if (path === '/admin/case-studies/seed' && req.method === 'POST') {
            const auth = await authenticateAdmin(req);
            if (!auth.authenticated) {
                return res.status(auth.status).json({ success: false, message: auth.message });
            }
            const sampleStudies = [
                {
                    category: "B2B SaaS",
                    title: "Scalable Qualified Lead Systems",
                    summary: "Engineering automated multi-channel acquisition pipelines to replace manual cold sales efforts.",
                    challenge: "Outbound sales reps spending 80% of time prospecting manually, leading to low pipeline volume and high customer acquisition costs.",
                    solution: "Deployed customized AI intent scrapers coupled with dynamic sequence personalization across LinkedIn & email channels.",
                    metric1_val: "2.5x", metric1_lbl: "Qualified Pipeline",
                    metric2_val: "60 Days", metric2_lbl: "Deployment Speed",
                    metric3_val: "₹48L", metric3_lbl: "New Pipeline Generated"
                },
                {
                    category: "Manufacturing",
                    title: "Sales Engagement Redesign",
                    summary: "Connecting CRM workflows and auto-dialers to optimize lead contact rate and speed-to-lead times.",
                    challenge: "Response time to inbound demo inquiries averaged 14 hours. High drop-off in prospect interest and poor conversion rates.",
                    solution: "Integrated automated speed-to-lead triggers using WhatsApp API and custom notification alerts for sales desks.",
                    metric1_val: "4 Mins", metric1_lbl: "Avg Speed-To-Lead",
                    metric2_val: "180%", metric2_lbl: "Demo Bookings Increase",
                    metric3_val: "₹1.2Cr", metric3_lbl: "Sourced Opportunity Value"
                },
                {
                    category: "IT Services",
                    title: "Partner Program Growth Blueprint",
                    summary: "Setting up custom revenue hubs, pipeline builders, and predictive forecasting dashboards.",
                    challenge: "Disparate data across spreadsheets and legacy systems prevented management from forecasting quarterly revenues accurately.",
                    solution: "Aligned sales, marketing and service operations onto a single source-of-truth RevOps pipeline infrastructure.",
                    metric1_val: "94%", metric1_lbl: "Forecast Accuracy",
                    metric2_val: "35%", metric2_lbl: "Sales Cycle Velocity",
                    metric3_val: "₹85L", metric3_lbl: "Operational Cost Savings"
                },
                {
                    category: "FinTech",
                    title: "RevOps & Pipeline Standardization",
                    summary: "Integrating unified marketing and sales automation loops to eliminate duplicate leads and process friction.",
                    challenge: "Disjointed data handoffs between marketing tools and CRM resulted in duplicate customer records and missed follow-ups.",
                    solution: "Standardized field validations, duplicate filters, and real-time alerts across core business software integrations.",
                    metric1_val: "0%", metric1_lbl: "Lost Data Hand-offs",
                    metric2_val: "₹65L", metric2_lbl: "Addtl. Annual Revenue",
                    metric3_val: "100%", metric3_lbl: "Integrative Accuracy"
                }
            ];

            memoryCaseStudies = sampleStudies.map((s, idx) => ({ id: `cs-sample-${idx + 1}`, ...s }));

            try {
                const inserts = sampleStudies.map(study => ({
                    image_url: JSON.stringify(study),
                    category: 'cs_case_study'
                }));
                const { error } = await getSupabase().from('images').insert(inserts);
                if (error) throw error;
                return res.status(200).json({ success: true, message: 'Sample case studies seeded successfully' });
            } catch (err) {
                console.warn('Seed studies database connection warning (seeded in memory):', err.message);
                return res.status(200).json({ success: true, message: 'Sample case studies seeded successfully (memory fallback)' });
            }
        }

        // ── Chatbot / Query Routes ────────────────────────────
        // The embedded chatbot (public/chatbot.js) calls these to drive
        // conversation: init session, run a turn, fetch captured lead
        // info, and finalise a booking. Mounted under /query/* (no /api
        // prefix) to match what the frontend sends.

        // POST /query/init
        if (queryPath === '/init' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const userId = body.user_id || ('anon-' + Date.now());
                const language = body.language || 'en';
                const preChatData = body.pre_chat_data || {};

                const convMod = require('./chat/conversation');
                const leadMod = require('./chat/lead');
                const conv = await convMod.getOrCreateConversation(userId, language);
                await leadMod.getOrCreateLead(userId, conv.id);

                if (preChatData && Object.keys(preChatData).length) {
                    // Pull canonical names so the LLM sees them on the
                    // very next ask turn. Map the form's `name`/`email`
                    // keys alongside the LLM's preferred `full_name` etc.
                    const qf = { ...preChatData };
                    if (qf.name && !qf.full_name) qf.full_name = qf.name;
                    if (qf.email && !qf.business_mail) qf.business_mail = qf.email;
                    if (qf.phone && !qf.calling_whatsapp_number) qf.calling_whatsapp_number = qf.phone;
                    if (qf.company && !qf.company_name) qf.company_name = qf.company;
                    await leadMod.updateLead(conv.id, { qualified_fields: qf });

                    // Also insert the pre-chat form into login_form_info
                    // (mirrors backend/routers/query.py behaviour).
                    try {
                        const row = { ...preChatData, conversation_id: conv.id };
                        const { error: formErr } = await getSupabase()
                            .from('login_form_info')
                            .insert(row);
                        if (formErr) console.warn('[query/init] login_form_info insert warning:', formErr.message);
                    } catch (formErr) {
                        console.warn('[query/init] login_form_info insert exception:', formErr.message);
                    }
                }

                return res.status(200).json({ conversation_id: conv.id });
            } catch (err) {
                console.error('[query/init] error:', err);
                return res.status(500).json({ success: false, message: err.message || 'init failed' });
            }
        }

        // POST /query/ask
        if (queryPath === '/ask' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const userId = body.user_id || ('anon-' + Date.now());
                const language = body.language || 'en';
                const timezone = body.timezone || 'UTC';
                const query = String(body.query || '').trim();
                if (!query) {
                    return res.status(400).json({ success: false, message: 'query is required' });
                }

                const convMod = require('./chat/conversation');
                const { processTurn } = require('./chat/process-turn');

                let convId = body.conversation_id;
                if (!convId) {
                    const conv = await convMod.getOrCreateConversation(userId, language);
                    convId = conv.id;
                }

                const result = await processTurn(userId, convId, query, language, timezone);
                return res.status(200).json({
                    answer: result.answer,
                    user_id: userId,
                    conversation_id: convId,
                    intent: result.intent,
                    lead_score: result.lead_score,
                    stage: result.stage,
                    status: result.status,
                    score_delta: result.score_delta,
                    ui_action: result.ui_action || null,
                });
            } catch (err) {
                console.error('[query/ask] error:', err);
                return res.status(500).json({ success: false, message: err.message || 'ask failed' });
            }
        }

        // GET /query/lead/{conversation_id}
        if (queryPath.startsWith('/lead/') && req.method === 'GET') {
            try {
                const conversationId = queryPath.slice('/lead/'.length);
                if (!conversationId) {
                    return res.status(400).json({ success: false, message: 'conversation_id is required' });
                }
                const leadMod = require('./chat/lead');
                const lead = await leadMod.getLeadByConversation(conversationId);
                if (!lead) {
                    return res.status(404).json({ success: false, message: 'Conversation not found.' });
                }
                const q = lead.qualified_fields || {};
                return res.status(200).json({
                    conversation_id: conversationId,
                    qualified_fields: {
                        name: q.name || q.full_name || q.contact_name || null,
                        email: q.email || q.business_mail || null,
                        phone: q.phone || q.calling_whatsapp_number || null,
                        company_name: q.company_name || q.company || null,
                        role: q.role || q.role_designation || null,
                        industry_type: q.industry_type || q.industry || null,
                        budget_range: q.budget_range || q.budget || null,
                        expected_timeline: q.expected_timeline || q.timeline || null,
                    },
                });
            } catch (err) {
                console.error('[query/lead] error:', err);
                return res.status(500).json({ success: false, message: err.message || 'lead fetch failed' });
            }
        }

        // POST /query/book-meeting
        if (queryPath === '/book-meeting' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { conversation_id, slot_id, slot_start, slot_end, timezone = 'UTC' } = body || {};
                if (!conversation_id || !slot_id || !slot_start || !slot_end) {
                    return res.status(400).json({ success: false, message: 'conversation_id, slot_id, slot_start, slot_end are required' });
                }

                const leadMod = require('./chat/lead');
                const calMod = require('./chat/calendar');
                const bookMod = require('./chat/booking');

                const lead = await leadMod.getLeadByConversation(conversation_id);
                if (!lead) return res.status(404).json({ success: false, message: 'Conversation not found.' });

                const qualified = lead.qualified_fields || {};
                const name = qualified.name || qualified.full_name || qualified.contact_name;
                const email = qualified.email || qualified.business_mail;
                if (!name || !email) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot book yet — name and email haven't been captured in this conversation. Please share them with the assistant first.",
                    });
                }

                let start, end;
                try {
                    start = new Date(slot_start);
                    end = new Date(slot_end);
                    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('invalid date');
                } catch (e) {
                    return res.status(400).json({ success: false, message: `Invalid slot datetime: ${e.message}` });
                }

                const calResult = await calMod.bookSlot(slot_id, {
                    start,
                    end,
                    attendeeName: name,
                    attendeeEmail: email,
                    timezoneStr: timezone,
                });

                const booking = await bookMod.saveBooking({
                    userId: lead.user_id || 'anon',
                    conversationId: conversation_id,
                    leadId: lead.id || null,
                    slotStart: calResult.slot_start,
                    slotEnd: calResult.slot_end,
                    timezoneStr: calResult.timezone,
                    attendeeEmail: email,
                    attendeeName: name,
                    externalBookingId: calResult.external_booking_id,
                });
                await bookMod.markLeadBooked(conversation_id);

                let localLabel;
                try {
                    localLabel = new Intl.DateTimeFormat('en-US', {
                        timeZone: calResult.timezone,
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                    }).format(start);
                    // Convert e.g. "Mon Jan 1, 10:00 AM" to "Mon Jan 1 at 10:00 AM"
                    localLabel = localLabel.replace(',', ' at');
                } catch (_) {
                    localLabel = start.toUTCString();
                }

                return res.status(200).json({
                    booking,
                    message: bookMod.formatConfirmationMessage(localLabel, name),
                    stage: 'closed',
                    status: 'booked',
                });
            } catch (err) {
                console.error('[query/book-meeting] error:', err);
                return res.status(500).json({ success: false, message: err.message || 'booking failed' });
            }
        }

        // 404 for any unmatched API route
        return res.status(404).json({ success: false, message: 'API route not found: ' + path });

    } catch (err) {
        console.error('Unhandled API error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
