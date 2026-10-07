# Tender Town — web app

Next.js 14 (App Router, server components and server actions) on Supabase.
Deployed on Vercel with the project's Root Directory set to `webapp`.

## Local development

```bash
cd webapp
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

## Environment

| Variable | Used for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | database, auth (server-side only), storage |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID`) | on-click agents, Config Agent |
| `TAVILY_API_KEY` | News Report Agent (article text) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PRO/TEAMS` | plans and billing (optional until set) |

## Map

- `app/` — pages: home feed, `tenders`, `news`, `history`, `community`,
  `posts`, `u/[username]`, `chat`, `notifications`, `workspaces`
  (+ `[id]`, `scopes/[id]`), `settings/{account,profile,privacy,preferences,notifications}`,
  auth pages, legal pages; `actions.ts` files hold server actions.
- `components/` — UI; `components/settings/` holds Workspaces and Settings UI.
- `lib/` — data access (feed, scopes, accounts, sources, search…),
  `lib/i18n/` (interface languages: `t('English text')`, dictionaries in
  `lib/i18n/messages/*.json`).
- `agents/` — prompts of the on-click agents (Tender Evaluation, Proposal
  Manager, News Report, Config Agent).

## Conventions

- Interface text goes through `t()` (`getT()` / `getTSync()` on the server,
  `useT()` on the client); add new keys to a dictionary in `lib/i18n/messages/`.
- Colours come from the tokens in `app/globals.css`; dark mode redefines them.
- Copy is short: a title and the controls, hints only where needed.
