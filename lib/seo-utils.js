const { BASE_URL } = require('./constants');
const { buildOrganizationSchema } = require('./build-schema');

const orgSchemaJson = JSON.stringify(buildOrganizationSchema(BASE_URL));

const defaultSeoPages = [
    { slug: 'index', page_name: 'Home', path: '/', meta_title: 'Cypher Swift InfoTech | AI-Powered Revenue Systems & Sales Automation', meta_keywords: 'AI revenue systems, B2B sales automation, RevOps consulting, AI marketing', meta_description: 'Build predictable growth systems for SaaS, IT, FinTech & enterprise brands. Align Strategy, Marketing, Sales, and AI into a unified B2B revenue engine.', canonical_url: `${BASE_URL}/`, schema_json: orgSchemaJson },
    { slug: 'services', page_name: 'Services', path: '/services', meta_title: 'Enterprise Automation & Advisory Services | Cypher Swift InfoTech', meta_keywords: 'AI advisory services, marketing automation, sales workflows, RevOps services', meta_description: 'Explore our four operational pillars: Strategic Growth Advisory, AI-Powered Marketing, Intelligent Sales Workflows, and Revenue Operations (RevOps).', canonical_url: `${BASE_URL}/services`, schema_json: '' },
    { slug: 'industries', page_name: 'Industries', path: '/industries', meta_title: 'B2B Verticals Supported | Cypher Swift InfoTech', meta_keywords: 'B2B SaaS, FinTech automation, manufacturing sales, IT services revenue', meta_description: 'We deploy custom AI-powered revenue architectures across B2B SaaS, FinTech, Manufacturing, IT Services, Renewable Energy, and Enterprise Software.', canonical_url: `${BASE_URL}/industries`, schema_json: '' },
    { slug: 'case-studies', page_name: 'Case Studies', path: '/case-studies', meta_title: 'B2B Success Stories & Metrics | Cypher Swift InfoTech', meta_keywords: 'B2B case studies, revenue growth results, sales automation success', meta_description: 'Read real results from B2B SaaS, manufacturing, real estate, and education firms. See how we improved qualified pipeline metrics, efficiency, and revenue visibility.', canonical_url: `${BASE_URL}/case-studies`, schema_json: '' },
    { slug: 'pricing', page_name: 'Pricing', path: '/pricing', meta_title: 'B2B Revenue System Engagement Models | Cypher Swift InfoTech', meta_keywords: 'B2B pricing models, AI growth diagnostic, revenue system engagement', meta_description: 'Explore our flexible partnership models: From our 5-day AI Growth Diagnostic to end-to-end custom Revenue System builds with a 100% money-back guarantee framework.', canonical_url: `${BASE_URL}/pricing`, schema_json: '' },
    { slug: 'contact', page_name: 'Contact', path: '/contact', meta_title: 'Book a B2B Consultation | Cypher Swift InfoTech', meta_keywords: 'B2B consultation, strategy session, AI growth diagnostic booking', meta_description: 'Request a Case Study, book a strategy session, or apply for our 5-day AI Growth Diagnostic with Cypher Swift InfoTech.', canonical_url: `${BASE_URL}/contact`, schema_json: '' },
    { slug: 'about', page_name: 'About Us', path: '/about', meta_title: 'About Us | Cypher Swift InfoTech', meta_keywords: 'about Cypher Swift, AI business transformation, revenue systems company', meta_description: 'Positioned as a premier AI-Powered Business Transformation & Revenue Systems Company, we focus on engineering stable B2B workflows and strategic advisory.', canonical_url: `${BASE_URL}/about`, schema_json: orgSchemaJson }
];

const PUBLIC_PAGE_SLUGS = defaultSeoPages.map(p => p.slug);

function slugToFilename(slug) {
    return slug === 'index' ? 'index.html' : `${slug}.html`;
}

function escapeAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function replaceMetaByName(html, name, content) {
    const pattern = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`, 'i');
    const tag = `<meta name="${name}" content="${escapeAttr(content)}">`;
    if (pattern.test(html)) {
        return html.replace(pattern, tag);
    }
    return html.replace(/<\/title>/i, `</title>\n    ${tag}`);
}

function replaceMetaProperty(html, property, content) {
    const pattern = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`, 'i');
    const tag = `<meta property="${property}" content="${escapeAttr(content)}">`;
    if (pattern.test(html)) {
        return html.replace(pattern, tag);
    }
    return html;
}

function buildSchemaTag(schemaRaw) {
    const trimmed = schemaRaw.trim();
    if (!trimmed) return '';

    if (/<script/i.test(trimmed)) {
        if (!/id="cs-seo-schema"/i.test(trimmed)) {
            return trimmed.replace(/<script/i, '<script id="cs-seo-schema"');
        }
        return trimmed;
    }

    return `<script type="application/ld+json" id="cs-seo-schema">${trimmed}</script>`;
}

function injectSeoIntoHtml(html, seo, apiLocation) {
    if (!seo) return html;

    let out = html;
    let finalCanonical = seo.canonical_url;
    let finalSchema = seo.schema_json || '';

    if (apiLocation && apiLocation !== BASE_URL) {
        if (finalCanonical) finalCanonical = finalCanonical.replace(new RegExp(BASE_URL, 'g'), apiLocation);
        if (finalSchema) finalSchema = finalSchema.replace(new RegExp(BASE_URL, 'g'), apiLocation);
    }

    if (seo.meta_title) {
        out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeAttr(seo.meta_title)}</title>`);
        out = replaceMetaProperty(out, 'og:title', seo.meta_title);
        out = replaceMetaProperty(out, 'twitter:title', seo.meta_title);
    }

    if (seo.meta_description) {
        out = replaceMetaByName(out, 'description', seo.meta_description);
        out = replaceMetaProperty(out, 'og:description', seo.meta_description);
        out = replaceMetaProperty(out, 'twitter:description', seo.meta_description);
    }

    if (seo.meta_keywords) {
        out = replaceMetaByName(out, 'keywords', seo.meta_keywords);
    }

    if (finalCanonical) {
        const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
        const canonicalTag = `<link rel="canonical" href="${escapeAttr(finalCanonical)}">`;
        if (canonicalPattern.test(out)) {
            out = out.replace(canonicalPattern, canonicalTag);
        } else {
            out = out.replace(/<\/title>/i, `</title>\n    ${canonicalTag}`);
        }
        out = replaceMetaProperty(out, 'og:url', finalCanonical);
        out = replaceMetaProperty(out, 'twitter:url', finalCanonical);
    }

    out = out.replace(/<script[^>]*id="cs-seo-schema"[^>]*>[\s\S]*?<\/script>/gi, '');

    const schemaTag = buildSchemaTag(finalSchema);
    if (schemaTag) {
        out = out.replace('</head>', `    ${schemaTag}\n</head>`);
    }

    return out;
}

async function loadSeoPages(supabase) {
    try {
        const { data, error } = await supabase
            .from('images')
            .select('*')
            .eq('category', 'cs_seo')
            .order('created_at', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
            return data.map(row => ({ id: row.id, ...JSON.parse(row.image_url) }));
        }
    } catch (err) {
        console.warn('Load SEO pages warning:', err.message);
    }
    return defaultSeoPages.map((p, idx) => ({ id: `seo-${idx + 1}`, ...p }));
}

async function getSeoForSlug(supabase, slug, memorySeoPages) {
    if (memorySeoPages && memorySeoPages.length > 0) {
        const fromMemory = memorySeoPages.find(p => p.slug === slug);
        if (fromMemory) return fromMemory;
    }

    const pages = await loadSeoPages(supabase);
    return pages.find(p => p.slug === slug) || defaultSeoPages.find(p => p.slug === slug) || null;
}

module.exports = {
    BASE_URL,
    defaultSeoPages,
    PUBLIC_PAGE_SLUGS,
    slugToFilename,
    injectSeoIntoHtml,
    loadSeoPages,
    getSeoForSlug
};
