const { BASE_URL } = require('./constants');

// NAP (Name, Address, Phone) in this schema must exactly match your Google Business Profile

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function expandDayOfWeek(dayOfWeek) {
    if (!Array.isArray(dayOfWeek)) return ALL_DAYS;
    const expanded = [];
    for (const entry of dayOfWeek) {
        if (entry.includes('-')) {
            const [start, end] = entry.split('-').map(s => s.trim());
            const startIdx = ALL_DAYS.indexOf(start);
            const endIdx = ALL_DAYS.indexOf(end);
            if (startIdx !== -1 && endIdx !== -1) {
                for (let i = startIdx; i <= endIdx; i++) expanded.push(ALL_DAYS[i]);
            }
        } else {
            expanded.push(entry);
        }
    }
    return expanded.length ? expanded : ALL_DAYS;
}

function buildOpeningHoursSpecification(openingHours) {
    if (!openingHours || !openingHours.length) return [];
    return openingHours.map(hours => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: expandDayOfWeek(hours.dayOfWeek),
        opens: hours.opens,
        closes: hours.closes
    }));
}

function buildLocalBusinessSchemaObject(branch, siteUrl = BASE_URL) {
    const pageUrl = `${siteUrl}/locations/${branch.slug}`;
    const schema = {
        '@context': 'https://schema.org',
        '@type': branch.businessType || 'ProfessionalService',
        name: branch.name,
        url: branch.website || pageUrl,
        telephone: branch.phone,
        address: {
            '@type': 'PostalAddress',
            streetAddress: branch.street,
            addressLocality: branch.city,
            addressRegion: branch.state,
            postalCode: branch.pincode,
            addressCountry: branch.country || 'IN'
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: branch.lat,
            longitude: branch.lng
        },
        openingHoursSpecification: buildOpeningHoursSpecification(branch.openingHours),
        hasMap: `https://maps.google.com/?q=${branch.lat},${branch.lng}`,
        potentialAction: {
            '@type': 'ViewAction',
            target: pageUrl
        }
    };

    if (branch.rating && branch.reviewCount) {
        schema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: String(branch.rating),
            reviewCount: String(branch.reviewCount)
        };
    }

    if (branch.imageUrl) {
        schema.image = branch.imageUrl;
    }

    if (branch.deliveryAvailable || branch.inStorePickup) {
        schema.hasOfferCatalog = {
            '@type': 'OfferCatalog',
            name: 'Service Delivery Options',
            itemListElement: []
        };
        if (branch.deliveryAvailable) {
            schema.hasOfferCatalog.itemListElement.push({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: 'Remote & On-site Delivery' }
            });
        }
        if (branch.inStorePickup) {
            schema.hasOfferCatalog.itemListElement.push({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: 'In-Person Consultation' }
            });
        }
    }

    return schema;
}

function buildLocalBusinessSchemaScript(branch, siteUrl = BASE_URL) {
    const schema = buildLocalBusinessSchemaObject(branch, siteUrl);
    return `<script type="application/ld+json" id="cs-local-schema">${JSON.stringify(schema)}</script>`;
}

function buildOrganizationSchema(siteUrl = BASE_URL) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Cypher Swift InfoTech',
        url: siteUrl,
        logo: `${siteUrl}/logo.svg`,
        description: 'AI-Powered Business Transformation & Revenue Systems Company',
        contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+91-7204468429',
            contactType: 'sales',
            areaServed: 'IN',
            availableLanguage: ['English', 'Hindi']
        },
        sameAs: []
    };
}

module.exports = {
    buildLocalBusinessSchemaObject,
    buildLocalBusinessSchemaScript,
    buildOrganizationSchema,
    expandDayOfWeek
};
