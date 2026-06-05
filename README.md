# CypherSwift AI Automation Website

Backend: `server.js` (Express)

## Local setup
1. Install dependencies:
   - `npm install`
2. Create a `.env` file (required for Supabase and SMTP):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` (optional)
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `ADMIN_EMAIL` (optional)
   - `ADMIN_PASSWORD` (optional)
   - `NOTIFICATION_EMAIL` (optional)
3. Run:
   - `npm start`

## Notes
- Do **not** commit secrets. `.env` is ignored by Git.

