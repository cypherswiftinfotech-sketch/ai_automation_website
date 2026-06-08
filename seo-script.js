const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const BASE_URL = 'https://ai-automation-website-mnhk.vercel.app';

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Skip if already has OG tags to avoid duplication if run multiple times
    if (content.includes('og:title')) {
        console.log(`Skipping ${file}, already has SEO tags.`);
        return;
    }

    // Handle admin pages specifically
    if (file === 'admin.html' || file === 'admin-login.html') {
        const noIndexTag = `    <meta name="robots" content="noindex, nofollow">\n`;
        content = content.replace('</title>', `</title>\n${noIndexTag}`);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Added noindex to ${file}`);
        return;
    }

    // Extract title and description
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const descMatch = content.match(/<meta name="description" content="(.*?)">/);

    const title = titleMatch ? titleMatch[1] : 'Cypher Swift InfoTech';
    const desc = descMatch ? descMatch[1] : 'AI-Powered Revenue Systems & Sales Automation';
    const url = file === 'index.html' ? BASE_URL + '/' : `${BASE_URL}/${file.replace('.html', '')}`;

    const seoTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${BASE_URL}/logo.svg">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${url}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${desc}">
    <meta property="twitter:image" content="${BASE_URL}/logo.svg">

    <!-- Canonical URL -->
    <link rel="canonical" href="${url}">
`;

    // Insert after the description tag, or after the title tag if description is missing
    if (descMatch) {
        content = content.replace(descMatch[0], `${descMatch[0]}\n${seoTags}`);
    } else if (titleMatch) {
        content = content.replace(titleMatch[0], `${titleMatch[0]}\n${seoTags}`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Added SEO tags to ${file}`);
});
