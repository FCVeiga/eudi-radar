# EUDI Radar Dashboard (Next.js)

Real Next.js app, tested — `npm install && npx next build` completes with
zero errors.

## What's live vs. still mock

Every page here queries Supabase directly via server components — no
hardcoded sample data. That means pages will show genuinely empty states
until:

1. `database/supabase_migration.sql` has been run against your Supabase project
2. `database/seed.py` has populated `countries`, `sources`, etc.
3. The daily pipeline (`run_daily.py`, via GitHub Actions) has run at
   least once to populate `opportunities`, `requirements`, `news_items`

## Local development

```bash
cd webapp
npm install
cp .env.local.example .env.local   # fill in your real Supabase values
npm run dev
```

## Deploying to Vercel

1. Push this repo to GitHub. Set the Vercel project's Root Directory to `webapp`.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as Vercel environment variables.
3. Deploy.

## What's not built yet

- Landscape page's company/partner data — empty until agents/consortium.py's
  partner graph gets populated.
- No auth — internal-tool assumption; add real auth before external access.
- Extraction/download buttons render real `documents` rows if present, but
  nothing populates that table with actual files yet.
