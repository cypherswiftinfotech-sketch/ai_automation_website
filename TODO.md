# TODO

## Goal: Fix large loading time

### Step 1 — Baseline measurement
- [ ] Identify which endpoints/resources are slow (server vs client).
- [ ] Capture timings using browser DevTools (Network/Performance) for at least: main route and services.html.

### Step 2 — Server-side performance hot spots
- [ ] Remove per-request redundant Supabase calls for SEO/settings in `server.js` by caching results in memory with TTL.
- [ ] Fix any N+1 or repeated reads in `servePageWithSeo` and related handlers.

### Step 3 — Client-side performance
- [ ] Audit `public/script.js` and per-page inline scripts for heavy blocking work.
- [ ] Ensure JS is deferred/loaded efficiently; move inline logic to external files if needed.

### Step 4 — Static asset optimization
- [ ] Ensure CSS/JS are not blocking render: use `defer` for scripts, preload critical CSS if applicable.

### Step 5 — Re-test and verify improvements
- [ ] Run a second timing capture after changes.
- [ ] Compare TTFB/LCP/Network waterfall and confirm improvement.

