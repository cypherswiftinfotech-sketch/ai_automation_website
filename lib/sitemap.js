const { BASE_URL, defaultSeoPages } = require('./seo-utils');
const { getAllBranches } = require('./branch-db');

function buildSitemapXml(apiLocation) {
    const currentApiLocation = apiLocation || BASE_URL;
    const urls = [];

    for (const page of defaultSeoPages) {
        let loc = page.canonical_url || `${BASE_URL}${page.path}`;
        if (currentApiLocation && currentApiLocation !== BASE_URL) {
            loc = loc.replace(new RegExp(BASE_URL, 'g'), currentApiLocation);
        }
        urls.push({
            loc: loc,
            changefreq: page.slug === 'index' ? 'weekly' : 'monthly',
            priority: page.slug === 'index' ? '1.0' : '0.8'
        });
    }

    for (const branch of getAllBranches()) {
        urls.push({
            loc: `${currentApiLocation}/locations/${branch.slug}`,
            changefreq: 'monthly',
            priority: '0.7'
        });
    }

    const entries = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

module.exports = { buildSitemapXml };
