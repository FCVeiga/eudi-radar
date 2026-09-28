# EUDI Wallet Global Opportunity Radar

Implementation of the 8-agent opportunity-intelligence architecture for
Biometrid, tracking EUDI Wallet / digital identity tenders, RFIs, grants,
and pilots across Europe, Africa, and Latin America.

## Status

- **Database schema**: 22 tables (spec section 59 + News/social additions),
  tested, works on both SQLite (local dev) and Postgres/Supabase (prod).
- **Real, sourced data**: all 32 tracked countries have real wallet
  authority/status data (from the iGrant.io tracker) and 30/32 have a
  confirmed real national procurement portal URL.
- **Real LLM wiring**: `services/llm_client.py` + real calls in
  `agents/triage.py` and `agents/requirements.py` against Anthropic's API.
- **Real search adapters**: TED and World Bank (both keyless, confirmed
  free), plus Tavily (needs your API key).
- **Real Next.js dashboard**: `webapp/` — built and verified with
  `npx next build`, zero errors. Four pages, all querying Supabase live.
- **GitHub Actions**: daily pipeline workflow ready to deploy.

See `SETUP_CHECKLIST.md` for what's still needed from you, and
`API_KEYS_NEEDED.md` for every signup link required.

## Repository layout

```
config/       countries.yaml (real data), sources.yaml, keywords.yaml,
              programmes.yaml, company_profile.yaml, tracked_accounts.yaml,
              sources_africa_latam.yaml
agents/       discovery, triage (real LLM), document_analyser, requirements
              (real LLM), pipeline_intelligence, consortium, ranking, digest,
              source_discovery, social_monitor
adapters/     web_search.py (interface), ted.py, world_bank.py, tavily.py,
              twitter.py, linkedin.py (all real implementations)
services/     llm_client.py (real Anthropic wrapper), deduplicator.py,
              change_detector.py
database/     models.py (22 tables), seed.py, supabase_migration.sql
prompts/      7 prompt files for every LLM call in the pipeline
webapp/       real Next.js dashboard (News, Opportunities, Database, Landscape)
dashboard/    static HTML mock (earlier prototype, kept for reference)
.github/workflows/  daily.yml (real), weekly_source_discovery.yml (stub)
reports/daily/      generated digests land here
```

## Quick start (local, SQLite)

```bash
pip install -r requirements.txt
cd database && python3 seed.py
```

## Deploying for real

See `SETUP_CHECKLIST.md` — the short version: run
`database/supabase_migration.sql` against a Supabase project, set
`DATABASE_URL` + the API key secrets in GitHub Actions, deploy `webapp/`
to Vercel with root directory set to `webapp`.

## Known gaps

- `agents/document_analyser.py` is structurally correct but untested
  against a real PDF (needs deployed network access).
- Landscape page's wallet-space company data is empty — needs
  `agents/consortium.py`'s partner graph populated.
- No auth on the webapp — fine for internal use only.
- LinkedIn monitoring deliberately deferred (see `adapters/linkedin.py`
  for the ToS/risk tradeoffs involved).
