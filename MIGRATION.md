# Moving Tender Town to new accounts (Supabase, Vercel, Tavily)

Do the steps in order. Keep the **old** Supabase project and Vercel project
running until step 8 — the database copy reads from the old project, and the
`tender-town.vercel.app` address is still held by the old Vercel project.

What moves: the code (GitHub, unchanged), the database (all tables, your user
and login, scopes, sources, tenders, news, posts), and settings. Storage is
empty today (no uploaded files), so only the three buckets need creating.

---

## 1. On the new computer

Install: Git, Node.js 20+, Python 3.11, the GitHub CLI (`gh`), the Vercel CLI
(`npm i -g vercel`), the Supabase CLI and Docker Desktop (the Supabase CLI
runs `pg_dump` in Docker), and the Postgres 17 client (`psql`).

```bash
git clone git@github.com:FCVeiga/tender-town.git
cd tender-town
pip install -r requirements.txt
cd webapp && npm install && cd ..
gh auth login
```

## 2. New Supabase project

1. Create a project (region: an EU one, e.g. Frankfurt). Save the database password.
2. From **Project Settings**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (API keys) → `SUPABASE_SERVICE_KEY` — server-side only, never in the browser
   - **Connection string → Session pooler** (IPv4) → `DATABASE_URL`
     (the direct `db.<ref>.supabase.co` host is IPv6-only; GitHub Actions can't reach it)
3. In the **SQL Editor**, enable the vector extension before restoring:
   ```sql
   create extension if not exists vector;
   ```

## 3. Copy the database from the old project

You need the **old** Session pooler URL too (old Supabase → Project Settings →
Database), with the old database password. This follows Supabase's guide
"Migrating within Supabase" (https://supabase.com/docs/guides/platform/migrating-within-supabase).

```bash
export OLD_DB_URL='postgresql://…old session pooler…'
export NEW_DB_URL='postgresql://…new session pooler…'

supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_DB_URL"
```

The dump files contain user data (emails, password hashes): keep them out of
the repo and delete them when you're done.

Then create the storage buckets (SQL Editor; harmless if the copy already made them):

```sql
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('post-media', 'post-media', true),
  ('company-files', 'company-files', false)
on conflict (id) do nothing;
```

Check the copy (SQL Editor):

```sql
select (select count(*) from auth.users) users, (select count(*) from scopes) scopes,
       (select count(*) from sources) sources, (select count(*) from opportunities) tenders,
       (select count(*) from news_items) news;
```

Expect 1 user (you), 2 scopes (General — the default — and EUDI Wallet &
digital identity), ~79 sources, ~71 tenders, ~100 news. You log in with the
same email and password; your platform-admin flag and Teams plan come along.

## 4. Supabase Auth settings

**Authentication → URL Configuration**
- Site URL: `https://tendertown.io`
- Redirect URLs: `https://tendertown.io/auth/callback`, `https://tendertown.io/**`, `http://localhost:3000/**`

**Authentication → Providers**
- Email: enabled. Sign-ups create confirmed users from the server, so "Confirm email" doesn't matter.
- For password-reset emails, set up custom SMTP (Authentication → SMTP settings) — the built-in sender is heavily rate-limited.
- Google (optional — makes "Continue with Google" and Settings → Account → Google work): create an OAuth client in Google Cloud, paste its ID/secret here, add the Supabase callback URL shown on that page to the Google client, and turn on **Allow manual linking** (Authentication → Sign In / Providers) for "Connect Google".

## 5. Tavily and Anthropic

- **Tavily**: create an account and an API key → `TAVILY_API_KEY`.
- **Anthropic**: you can keep the current key or create one. It must be
  workspace-scoped (or also set `ANTHROPIC_WORKSPACE_ID`). The current account
  ran out of credit on 2026-10-02 — top up, or triage, translation, summaries,
  feed posts and the on-click agents won't run (the General scope and plain
  feed posts work without it).

## 6. Vercel

1. In the **old** Vercel account (team `biometrid`), delete the `tender-town`
   project (or rename it) — this frees the `tender-town.vercel.app` address.
   The old `eudi-radar.vercel.app` redirect goes with it.
2. In the new account: **Add New → Project → Import** `FCVeiga/tender-town`
   (install the Vercel GitHub app on the repo when asked).
   - Root Directory: `webapp` · Framework: Next.js
   - Environment variables (Production and Preview):
     `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`
     (+ `ANTHROPIC_WORKSPACE_ID` if needed), `TAVILY_API_KEY`.
     Later, for paid plans: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAMS`
     (webhook endpoint: `https://<domain>/api/stripe/webhook`).
3. Name the project `tender-town` so it gets `tender-town.vercel.app` (or add
   that domain under Project → Domains once step 1 freed it). Pushes to `main`
   deploy automatically.

## 7. GitHub Actions (the pipeline, every 4 hours)

```bash
gh secret set DATABASE_URL          # new Session pooler URL
gh secret set SUPABASE_URL
gh secret set SUPABASE_SERVICE_KEY
gh secret set TAVILY_API_KEY
gh secret set ANTHROPIC_API_KEY
gh workflow run daily.yml           # one run now; then check: gh run list --workflow daily.yml
```

## 8. Check, then retire the old accounts

1. Open https://tendertown.io: tenders and news show, you can log in,
   Workspaces lists your workspaces, Settings opens.
2. After a pipeline run, Home shows new General items.
3. Then: pause or delete the old Supabase project, revoke the old Tavily key,
   and remove anything left in the old Vercel team.

## 9. Local development

Repo-root `.env` (for the pipeline; gitignored):

```
SUPABASE_URL=…
SUPABASE_SERVICE_KEY=…
DATABASE_URL=…            # Session pooler URL
ANTHROPIC_API_KEY=…
TAVILY_API_KEY=…
```

`webapp/.env.local` (for `npm run dev`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`.

```bash
set -a && source .env && set +a && python3 run_daily.py   # pipeline
cd webapp && npm run dev                                   # site on http://localhost:3000
```

## Starting from an empty database instead (not recommended)

`database/supabase_migration.sql` plus `database/migrations/*.sql` describe how
the schema grew, but several migrations also seed data for the original
accounts, so an empty install needs hand-fixing (default scope, platform
workspace, sources, countries). Copying the database (step 3) avoids all of it.
