const { buildSitemapXml } = require('../lib/sitemap');
const { seedBranchesIfEmpty } = require('../lib/branch-db');

module.exports = async function handler(req, res) {
    seedBranchesIfEmpty();
    let apiLocation = null;
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
        const { data, error } = await supabase.from('images').select('*').eq('category', 'cs_settings').limit(1);
        if (!error && data && data.length > 0) {
            const parsed = JSON.parse(data[0].image_url);
            if (parsed.api_location) apiLocation = parsed.api_location;
        }
    } catch(err) {}

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buildSitemapXml(apiLocation));
};
