// ─────────────────────────────────────────────────────────────
// Vercel Services framework entrypoint for the "backend" service.
// Mounted at /_/backend on the deployed domain.
//
// This service exists because Vercel's project framework is set
// to "Services", which requires experimentalServices in vercel.json
// pointing at real entrypoints. We re-export the existing Node API
// handler from api/index.js so the same logic continues to work
// under the Services architecture.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const apiHandler = require('../api/index.js');

const app = express();

// Forward the request to the existing Vercel serverless handler.
// Strip the /_/backend prefix so paths inside the handler match
// what they used to be under /api/...
app.use(async (req, res, next) => {
    try {
        req.url = req.url.replace(/^\/_?backend/, '') || '/';
        if (!req.url.startsWith('/api')) req.url = '/api' + req.url;
        return await apiHandler(req, res);
    } catch (err) {
        console.error('[backend service] handler error:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[backend service] listening on port ${PORT}`);
});