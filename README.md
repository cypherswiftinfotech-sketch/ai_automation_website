# CypherSwift AI Automation Website

Backend: `server.js` (Express) with Local SEO Schema API for location-based rich results.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file (required for Supabase and SMTP):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` (optional, default `8000`)
   - `SITE_URL` (optional, used for canonical URLs and schema)
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `ADMIN_EMAIL` (optional)
   - `ADMIN_PASSWORD` (optional)
   - `NOTIFICATION_EMAIL` (optional)
3. Seed location branches and run:
   ```bash
   npm run seed
   npm run dev
   ```

## Local SEO Schema API

Powers location-based rich results (ratings, hours, phone, open/closed status) for Google local pack-style listings.

### API endpoints

**Health check**
```bash
curl http://localhost:8000/api/health
# → { "status": "ok", "timestamp": "..." }
```

**Get JSON-LD schema for a location**
```bash
curl "http://localhost:8000/api/schema?location=bangalore-hq"
# → valid JSON-LD object (LocalBusiness / ProfessionalService)
```

**Branch not found**
```bash
curl "http://localhost:8000/api/schema?location=fake"
# → 404 { "error": "Branch not found" }
```

**List all branches (slim)**
```bash
curl http://localhost:8000/api/branches
# → [{ id, slug, name, city, rating }, ...]
```

**Sitemap**
```bash
curl http://localhost:8000/sitemap.xml
```

### Location pages

- Clean URLs: `http://localhost:8000/locations/bangalore-hq`
- Legacy query param: `http://localhost:8000/location.html?location=bangalore-hq`

JSON-LD is **rendered server-side** in production so Googlebot sees schema without JavaScript.

### Seeded locations

| Slug | City |
|------|------|
| `bangalore-hq` | Bengaluru (India HQ) |
| `mumbai` | Mumbai |
| `delhi-ncr` | Gurugram / Delhi NCR |
| `hyderabad` | Hyderabad |
| `pune` | Pune |

### Adding a new branch

Insert via SQLite or call `upsertBranch()` in `lib/branch-db.js`:

```js
const { upsertBranch } = require('./lib/branch-db');

upsertBranch({
  slug: 'chennai',
  name: 'Cypher Swift InfoTech — Chennai',
  businessType: 'ProfessionalService',
  street: 'OMR, Sholinganallur',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600119',
  country: 'IN',
  phone: '+917204468429',
  website: 'https://yoursite.com',
  lat: 12.9010,
  lng: 80.2279,
  rating: 4.5,
  reviewCount: 10,
  openingHours: [{ dayOfWeek: ['Monday-Sunday'], opens: '09:00', closes: '18:00' }],
  deliveryAvailable: true,
  inStorePickup: true
});
```

Then re-run `npm run seed` or restart the server (auto-seeds on startup if DB is empty).

### Integrate with Next.js / React

Fetch schema at build time or in `getServerSideProps` and inject into `<head>`:

```jsx
// pages/locations/[slug].js
export async function getServerSideProps({ params }) {
  const res = await fetch(`${process.env.SITE_URL}/api/schema?location=${params.slug}`);
  if (!res.ok) return { notFound: true };
  const schema = await res.json();
  return { props: { schema } };
}

export default function LocationPage({ schema }) {
  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>
      {/* page content */}
    </>
  );
}
```

### Test with Google Rich Results

1. Open a location page: `/locations/bangalore-hq`
2. View page source — confirm `<script type="application/ld+json">` is in `<head>`
3. Paste the URL into [Google Rich Results Test](https://search.google.com/test/rich-results)

> **Production note:** Always render JSON-LD server-side (SSR) so Googlebot reads it without JavaScript execution. Client-side injection is a dev fallback only.

## Notes

- Do **not** commit secrets. `.env` is ignored by Git.
- Branch database: `data/branches.db` (SQLite, gitignored via `*.db`)
- NAP (Name, Address, Phone) in schema must exactly match your Google Business Profile
# ai_automation_website
