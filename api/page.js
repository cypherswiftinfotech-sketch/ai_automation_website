const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
    PUBLIC_PAGE_SLUGS,
    slugToFilename,
    getSeoForSlug,
    injectSeoIntoHtml
} = require('../lib/seo-utils');

let supabase = null;
function getSupabase() {
    if (!supabase) {
        supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
    }
    return supabase;
}

module.exports = async function handler(req, res) {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const slug = url.searchParams.get('slug') || 'index';

    if (!PUBLIC_PAGE_SLUGS.includes(slug)) {
        return res.status(404).send('Page not found');
    }

    try {
        const filePath = path.join(process.cwd(), 'public', slugToFilename(slug));
        let html = await fs.readFile(filePath, 'utf8');
        let apiLocation = null;
        try {
            const { data, error } = await getSupabase().from('images').select('*').eq('category', 'cs_settings').limit(1);
            if (!error && data && data.length > 0) {
                const parsed = JSON.parse(data[0].image_url);
                if (parsed.api_location) apiLocation = parsed.api_location;
            }
        } catch(err) {}

        const seo = await getSeoForSlug(getSupabase(), slug, null);
        html = injectSeoIntoHtml(html, seo, apiLocation);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.status(200).send(html);
    } catch (err) {
        console.error('Page render error:', err.message);
        return res.status(500).send('Error loading page');
    }
};
