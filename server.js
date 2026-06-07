// ─────────────────────────────────────────────────────────────
// Cypher Swift InfoTech — Secure Backend Server
// Serves static files, manages secure Supabase database proxying,
// and handles email delivery using Nodemailer (Gmail SMTP).
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
global.WebSocket = require('ws'); // Shim for older Node versions required by Supabase real-time
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8000;

// Initialize Supabase Backend Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── In-Memory Database Fallbacks (for out-of-the-box local operation) ──
let memoryLeads = [];
let memorySettings = {
    revenue: "₹3Cr+",
    growth: "2.5x",
    automation: "70%",
    notification_email: "craftersofa974263@gmail.com"
};
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve index.html for root route explicitly
// Serve all HTML pages
const htmlPages = ['services', 'industries', 'case-studies', 'pricing', 'contact', 'about', 'admin', 'admin-login'];
htmlPages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => {
        res.sendFile(path.join(__dirname, `${page}.html`));
    });
});
// Gmail SMTP Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify SMTP connection on startup
transporter.verify((error) => {
    if (error) {
        console.error('⚠️  SMTP Connection Error:', error.message);
    } else {
        console.log('✅ SMTP Server is ready to send emails');
    }
});

// ── Helper: Authenticate Admin via Bearer Token ───────────────
async function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Missing authorization header' });
    }
    const token = authHeader.split(' ')[1];

    // Check fallback static token first
    const fallbackEmail = process.env.ADMIN_EMAIL || 'admin@cypherswift.com';
    const staticToken = Buffer.from(fallbackEmail).toString('base64') + "_static_session";
    if (token === staticToken) {
        req.user = { email: fallbackEmail };
        return next();
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Authentication error' });
    }
}

// ── Public Routes ─────────────────────────────────────────────

// 1. Fetch Global Settings
app.get('/api/stats', async (req, res) => {
    try {
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_settings').limit(1);
        if (error) throw error;
        res.json({ success: true, data: data && data.length > 0 ? JSON.parse(data[0].image_url) : memorySettings });
    } catch (err) {
        console.warn('Fetch stats database connection warning (using memory fallback):', err.message);
        res.json({ success: true, data: memorySettings });
    }
});

// 2. Fetch Dynamic Case Studies
app.get('/api/case-studies', async (req, res) => {
    try {
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_case_study').order('created_at', { ascending: true });
        if (error) throw error;

        const formatted = (data || []).map(item => ({
            id: item.id,
            ...JSON.parse(item.image_url)
        }));
        res.json({ success: true, data: formatted.length > 0 ? formatted : memoryCaseStudies });
    } catch (err) {
        console.warn('Fetch case studies database connection warning (using memory fallback):', err.message);
        res.json({ success: true, data: memoryCaseStudies });
    }
});

// 3. Submit Lead form
app.post('/api/leads', async (req, res) => {
    const { name, email, website, companySize, requestType, strategicContext } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const payload = { name, email, website, size: companySize, type: requestType, context: strategicContext };

    // Save to memory storage anyway
    const leadId = "lead_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    memoryLeads.unshift({
        id: leadId,
        image_url: JSON.stringify(payload),
        category: 'cs_lead',
        created_at: new Date().toISOString()
    });

    try {
        // Save to Supabase (Proxy)
        const { error: dbError } = await supabase.from('images').insert([{
            image_url: JSON.stringify(payload),
            category: 'cs_lead'
        }]);
        if (dbError) console.warn("Supabase Lead Insertion Warning:", dbError.message);
    } catch (dbErr) {
        console.warn("Supabase Lead Insertion Error (using memory fallback):", dbErr.message);
    }

    try {
        // Send Email via SMTP
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

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Lead submitted and email sent successfully!' });
    } catch (err) {
        console.error('Lead submission email delivery error:', err.message);
        res.json({ success: true, message: 'Lead logged successfully! (Email notification error)' });
    }
});

// ── Admin Routes ──────────────────────────────────────────────

// 1. Admin Login Proxy
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;

    const fallbackEmail = process.env.ADMIN_EMAIL || 'admin@cypherswift.com';
    const fallbackPassword = process.env.ADMIN_PASSWORD || 'adminpass123';

    if (email === fallbackEmail && password === fallbackPassword) {
        const staticToken = Buffer.from(fallbackEmail).toString('base64') + "_static_session";
        return res.json({
            success: true,
            session: {
                access_token: staticToken,
                user: { email: fallbackEmail }
            }
        });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.json({ success: true, session: data.session });
    } catch (err) {
        console.error('Admin login error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server login error' });
    }
});

// 2. Fetch Leads (Protected)
app.get('/api/admin/leads', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_lead').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data.length > 0 ? data : memoryLeads });
    } catch (err) {
        console.warn('Get leads DB warning, returning memory fallback:', err.message);
        res.json({ success: true, data: memoryLeads });
    }
});

// 3. Delete Lead (Protected)
app.delete('/api/admin/leads/:id', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    memoryLeads = memoryLeads.filter(l => String(l.id) !== String(id));
    try {
        const { error } = await supabase.from('images').delete().eq('id', id);
        if (error) console.warn("Supabase Delete Lead Warning:", error.message);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (err) {
        console.warn('Delete lead DB error (completed in memory):', err.message);
        res.json({ success: true, message: 'Lead deleted successfully (memory fallback)' });
    }
});

// 4. Fetch Global Settings (Protected)
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_settings').limit(1);
        if (error) throw error;
        res.json({ success: true, data: data && data.length > 0 ? data[0] : { id: 'memory_settings', image_url: JSON.stringify(memorySettings) } });
    } catch (err) {
        console.warn('Get settings DB error, returning memory settings:', err.message);
        res.json({ success: true, data: { id: 'memory_settings', image_url: JSON.stringify(memorySettings) } });
    }
});

// 5. Save Global Settings (Protected)
app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
    const { id, payload } = req.body;
    memorySettings = { ...memorySettings, ...payload };
    try {
        if (id && id !== 'memory_settings') {
            const { error } = await supabase.from('images').update({
                image_url: JSON.stringify(payload)
            }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('images').insert([{
                image_url: JSON.stringify(payload),
                category: 'cs_settings'
            }]);
            if (error) throw error;
        }
        res.json({ success: true, message: 'Global config saved successfully' });
    } catch (err) {
        console.warn('Save settings DB error (completed in memory):', err.message);
        res.json({ success: true, message: 'Global config saved successfully (memory fallback)' });
    }
});

// 6. Fetch Case Studies (Protected)
app.get('/api/admin/case-studies', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_case_study').order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: data.length > 0 ? data : memoryCaseStudies.map((s, idx) => ({ id: s.id || `cs-sample-${idx}`, image_url: JSON.stringify(s) })) });
    } catch (err) {
        console.warn('Get case studies DB error, returning memory fallback:', err.message);
        res.json({ success: true, data: memoryCaseStudies.map((s, idx) => ({ id: s.id || `cs-sample-${idx}`, image_url: JSON.stringify(s) })) });
    }
});

// 7. Save Case Study (Protected)
app.post('/api/admin/case-studies', authenticateAdmin, async (req, res) => {
    const { id, payload } = req.body;

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
            const { error } = await supabase.from('images').update({
                image_url: JSON.stringify(payload)
            }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('images').insert([{
                image_url: JSON.stringify(payload),
                category: 'cs_case_study'
            }]);
            if (error) throw error;
        }
        res.json({ success: true, message: 'Case study saved successfully' });
    } catch (err) {
        console.warn('Save case study DB error (completed in memory):', err.message);
        res.json({ success: true, message: 'Case study saved successfully (memory fallback)' });
    }
});

// 8. Delete Case Study (Protected)
app.delete('/api/admin/case-studies/:id', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    memoryCaseStudies = memoryCaseStudies.filter(s => String(s.id) !== String(id));
    try {
        const { error } = await supabase.from('images').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Case study deleted successfully' });
    } catch (err) {
        console.warn('Delete case study DB error (completed in memory):', err.message);
        res.json({ success: true, message: 'Case study deleted successfully (memory fallback)' });
    }
});

// 9. Seed Sample Case Studies (Protected)
app.post('/api/admin/case-studies/seed', authenticateAdmin, async (req, res) => {
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
        const { error } = await supabase.from('images').insert(inserts);
        if (error) throw error;
        res.json({ success: true, message: 'Sample case studies seeded successfully' });
    } catch (err) {
        console.warn('Seed studies database connection warning (seeded in memory):', err.message);
        res.json({ success: true, message: 'Sample case studies seeded successfully (memory fallback)' });
    }
});

// ── Start Server (local only) / Export for Vercel ─────────────
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🌐 CypherSwift InfoTech Secure Server running at http://localhost:${PORT}`);
        console.log(`📧 Email notifications → ${process.env.EMAIL_USER}\n`);
    });
}

module.exports = app;