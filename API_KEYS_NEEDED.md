# API Keys & Signups — Fill This In

Every row below is a real, verified link found via research on 2026-09-04.
Where I found a genuinely free/keyless option, I've flagged it — you may
not need to pay for everything on day one.

---

## 1. LLM calls (triage, requirement extraction, digest generation)

| What | Link | Notes |
|---|---|---|
| Anthropic API key | https://console.anthropic.com | Required. Pay-as-you-go, no free tier for API (separate from claude.ai subscriptions). |

**Fill in:** `ANTHROPIC_API_KEY=`

---

## 2. General web search (Discovery agent fallback, when a source has no direct API)

| Provider | Signup | Free tier | Pricing after |
|---|---|---|---|
| Serper.dev | https://serper.dev | 2,500 queries, no credit card | $50/mo for 50K queries ($1/1K), credits valid 6 months |
| Tavily | https://tavily.com | Free Research plan available | ~$50/mo for 10K queries — pricier per-query than Serper but returns cleaned/summarized content, which may save you an extraction step |

**Recommendation:** start with Serper's free tier — it's genuinely free with no card, and cheap enough for a daily-run system to stay on the free/low tier for a while, especially since section 3 below covers most of your actual opportunity data with zero-cost APIs.

**Fill in:** `SEARCH_API_KEY=` (pick one)

---

## 3. Opportunity scouting — confirmed keyless/free APIs (no signup needed)

These don't need a key at all. Wire them in first — they cover EU procurement and all World Bank-financed opportunities (which is most of your Africa/LatAm coverage) for $0.

| Source | Endpoint | Auth | Docs |
|---|---|---|---|
| TED (EU procurement) | `https://api.ted.europa.eu/v3/notices/search` | None — public read access | https://docs.ted.europa.eu/api/ |
| World Bank procurement (100+ countries) | `https://search.worldbank.org/api/v2/procnotices` | None — CC BY 4.0, fully open | Referenced in World Bank's FinancesOne data catalog |

Already wired into `adapters/ted.py` and `adapters/world_bank.py` — nothing to fill in here, just deploy somewhere with open network access.

**Partially open (bulk data, not live query API):**
- IDB (Inter-American Development Bank): open datasets at https://data.iadb.org/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards (CC BY 4.0) — no confirmed real-time query endpoint, may need scheduled bulk-download + diff instead of live polling.

**No API found:**
- AfDB: portal-only (https://www.afdb.org/en/projects-and-operations/procurement) — no structured API found in this research pass. Needs either a dedicated scraper or manual/periodic monitoring.

---

## 4. Social monitoring

### Twitter/X
| What | Link | Notes |
|---|---|---|
| X Developer Portal | https://developer.twitter.com/en/portal/dashboard | As of Feb 2026, X moved new signups to a **pay-per-use** model (credits, no subscription floor) — likely cheaper than the old fixed tiers for low-volume account monitoring, but costs scale with read volume so a misconfigured polling loop can run up a bill fast. The old fixed "Basic" tier (~$200/mo) still exists for legacy subscribers only, closed to new signups. Confirm current pricing at signup — this has changed multiple times in the past two years. |

**Fill in:** `TWITTER_BEARER_TOKEN=`

### LinkedIn — the decision you're deferring, links ready for when you're not
| Option | Link | Notes |
|---|---|---|
| Apify (scraping provider) | https://apify.com | Search the Apify Store for "LinkedIn posts" actors once signed up — several community actors exist, pick one and note its actor ID. Operates against LinkedIn's ToS. |
| PhantomBuster (alternative) | https://phantombuster.com | Similar model to Apify, LinkedIn-specific automations. |

**Fill in (when ready):** `APIFY_API_TOKEN=`, and the specific actor ID inside `adapters/linkedin.py`.

---

## 5. Infrastructure

| What | Link | Notes |
|---|---|---|
| GitHub (host the repo + run the daily Action) | https://github.com/new | Free for public or small private repos. |
| Supabase (Postgres + pgvector) | https://supabase.com/dashboard | Free tier: 500MB DB, plenty to start. |
| Vercel (dashboard hosting) | https://vercel.com/new | Free tier covers this scale easily. |

**Fill in:** `DATABASE_URL=`, `SUPABASE_URL=`, `SUPABASE_SERVICE_KEY=` (all from your Supabase project settings once created).

---

## Summary — what to sign up for first

Given the zero-cost APIs in section 3 cover EU + World Bank-financed Africa/LatAm opportunities already, your minimum viable signup list to get *tender/RFI/grant* monitoring live is just:

1. Anthropic API key (section 1) — required for any LLM-based triage/extraction
2. GitHub + Supabase + Vercel accounts (section 5) — required for anything to run/persist/display
3. Serper.dev free tier (section 2) — for the general-web-search fallback

Everything in section 4 (social/Twitter/LinkedIn) can wait — you already said LinkedIn is deferred, and Twitter only matters once the tender pipeline is live and you want to add the social layer on top.
