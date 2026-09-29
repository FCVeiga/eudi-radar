"""
Master Daily Workflow orchestrator (spec section 75).
Wires agents together: discovery -> triage -> promotion -> digest.

    python run_daily.py

Needs DATABASE_URL and ANTHROPIC_API_KEY. TAVILY_API_KEY is optional (web
search is skipped without it; TED is keyless). Tunables via env:
TAVILY_QUERIES_PER_RUN (default 20), MAX_TRIAGE_PER_RUN (default 400).
"""
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, date
from types import SimpleNamespace
from urllib.parse import urlparse

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "database"))
sys.path.insert(0, os.path.dirname(__file__))

from database.models import (  # noqa: E402
    init_db, get_session, Source, Country, AgentRun, Candidate, Opportunity, NewsItem,
)
from agents.digest import render_daily_digest, CoverageStats  # noqa: E402
from agents.discovery import run_discovery, build_query_combinations  # noqa: E402
from agents.triage import heuristic_prefilter, run_triage_llm, apply_triage_result  # noqa: E402
from services.deduplicator import fingerprint  # noqa: E402

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")

# TED full-text search is phrase-matched and free, so it gets a fixed,
# high-precision list every day.
TED_PHRASES = [
    "EUDI Wallet", "European Digital Identity Wallet", "digital identity wallet",
    "identity wallet", "digital identity", "verifiable credentials",
    "electronic attestation of attributes", "person identification data",
    "mobile driving licence", "OpenID4VC", "SD-JWT", "ISO 18013-5",
]

# Triage types that are something to bid on / prepare for vs. informational.
OPPORTUNITY_TYPES = {
    "TENDER": "tender", "GRANT": "grant", "PILOT": "pilot",
    "CONSORTIUM_CALL": "consortium", "PIPELINE_SIGNAL": "signal",
}
PROMOTE_THRESHOLD = 50

# Tavily news-mode queries (last 30 days). Only candidates from this pack are
# eligible for the News page — general web results for NEWS_ONLY are mostly
# vendor product pages. Triage relevance is bid-oriented, so news only needs
# relevance > 0 (0 = off-topic / suppressed).
NEWS_QUERIES = [
    "EUDI Wallet", "European Digital Identity Wallet rollout",
    "eIDAS 2 implementing acts", "national digital identity wallet launch",
    "mobile driving licence digital wallet government",
]


def tavily_queries_for_today(n: int) -> list:
    """All keyword-pack queries, rotated so each day covers a different slice
    (keeps Tavily usage to n credits/day while cycling the full set)."""
    with open(os.path.join(CONFIG_DIR, "keywords.yaml")) as f:
        packs = yaml.safe_load(f)
    queries = []
    for name, pack in packs.items():
        if not name.startswith("pack_"):
            continue
        if pack.get("combine_with"):
            queries += build_query_combinations(pack)
        else:
            # Bare terms like "PID" or "mDL" are meaningless on the open web.
            queries += [f"{t} government procurement" for t in pack["terms"]]
    if not queries or n <= 0:
        return []
    start = (date.today().toordinal() * n) % len(queries)
    return [queries[(start + i) % len(queries)] for i in range(min(n, len(queries)))]


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d")
    except ValueError:
        return None


def promote(session, candidate: Candidate, t: dict, country_names: dict):
    """Turn a triaged candidate into an Opportunity or NewsItem row.
    Returns ("opportunity"|"news", row) or None."""
    ctype = (t.get("type") or "").upper()
    relevance = int(t.get("relevance") or 0)
    country = (t.get("country") or "").upper()[:2] or None
    summary = t.get("summary") or t.get("reason") or ""

    if ctype in OPPORTUNITY_TYPES and relevance >= PROMOTE_THRESHOLD:
        opp_id = fingerprint(country or "", t.get("authority") or "", None, candidate.title or "")
        existing = session.get(Opportunity, opp_id)
        now = datetime.utcnow()
        if existing:
            existing.last_checked = now
            return None
        deadline = _parse_date(t.get("deadline"))
        status = ("OPEN" if deadline and deadline >= now else "CLOSED" if deadline
                  else "SIGNAL" if ctype == "PIPELINE_SIGNAL" else "UNCLEAR")
        opp = Opportunity(
            opportunity_id=opp_id, title=candidate.title or "(untitled)",
            country=country, authority=(t.get("authority") or None),
            opportunity_type=OPPORTUNITY_TYPES[ctype], status=status,
            publication_date=_parse_date(candidate.publication_date),
            deadline=deadline, official_url=candidate.source_url,
            first_detected=now, last_checked=now,
            relevance_score=relevance, opportunity_relevance_score=relevance,
        )
        session.add(opp)
        return "opportunity", opp

    from_news_search = "news" in (candidate.potential_categories or [])
    if ctype == "NEWS_ONLY" and from_news_search and relevance > 0:
        news_id = candidate.candidate_id
        if session.get(NewsItem, news_id):
            return None
        category = t.get("news_category") if t.get("news_category") in ("regulation", "govdecision") else "govdecision"
        item = NewsItem(
            news_id=news_id, title=candidate.title or "(untitled)", category=category,
            region=country_names.get(country, "EU / International") if country else "EU / International",
            country=country, published_date=_parse_date(candidate.publication_date) or candidate.discovered_at,
            source_name=urlparse(candidate.source_url or "").netloc,
            source_url=candidate.source_url,
            excerpt=(candidate.description or "")[:400], summary=summary,
            impact_note=t.get("reason") or "",
        )
        session.add(item)
        return "news", item
    return None


def main():
    engine = init_db()
    session = get_session(engine)
    errors = []

    run_id = f"RUN-{uuid.uuid4().hex[:10]}"
    agent_run = AgentRun(run_id=run_id, agent_name="daily_orchestrator",
                         started_at=datetime.utcnow(), status="RUNNING")
    session.add(agent_run)
    session.commit()

    sources = session.query(Source).all()
    countries = session.query(Country).all()
    country_codes = [c.code for c in countries]
    country_names = {c.code: c.name for c in countries}

    # --- 1. Discovery -------------------------------------------------------
    from adapters.ted import TedSearchProvider
    query_count = len(TED_PHRASES)
    candidates = run_discovery(session, TedSearchProvider(), {"ted": TED_PHRASES},
                               country_codes, errors=errors)
    print(f"TED: {len(candidates)} new candidates from {len(TED_PHRASES)} phrases")

    if os.environ.get("TAVILY_API_KEY"):
        from adapters.tavily import TavilySearchProvider
        web_queries = tavily_queries_for_today(int(os.environ.get("TAVILY_QUERIES_PER_RUN", 20)))
        query_count += len(web_queries)
        web = run_discovery(session, TavilySearchProvider(), {"web": web_queries},
                            country_codes, errors=errors)
        candidates += web
        print(f"Tavily: {len(web)} new candidates from {len(web_queries)} queries")
        news = run_discovery(session, TavilySearchProvider(topic="news", days=30),
                             {"news": NEWS_QUERIES}, country_codes, errors=errors)
        query_count += len(NEWS_QUERIES)
        candidates += news
        print(f"Tavily news: {len(news)} new candidates from {len(NEWS_QUERIES)} queries")
    else:
        errors.append("TAVILY_API_KEY not set — web search skipped")

    # --- 2. Triage (all unprocessed, including leftovers from earlier runs) --
    max_triage = int(os.environ.get("MAX_TRIAGE_PER_RUN", 400))
    pending = (session.query(Candidate).filter(Candidate.processed.is_(False))
               .order_by(Candidate.discovered_at).limit(max_triage).all())
    to_llm = []
    for c in pending:
        if heuristic_prefilter(c):
            to_llm.append(c)
        else:
            apply_triage_result(session, c, {
                "relevance": 0, "type": "FALSE_POSITIVE",
                "reason": "Matched automatic suppression term list.",
            })

    # Worker threads get detached copies: ORM objects are expired on every
    # commit and must not be lazy-loaded from other threads.
    snapshots = [SimpleNamespace(title=c.title, description=c.description,
                                 source_url=c.source_url, country=c.country,
                                 discovery_query=c.discovery_query) for c in to_llm]

    def _triage(snap):
        try:
            return run_triage_llm(snap), None
        except Exception as e:
            return None, e

    new_opps, new_news = [], []
    failures = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, (c, (result, err)) in enumerate(zip(to_llm, pool.map(_triage, snapshots)), 1):
            if err:
                errors.append(f"triage {c.candidate_id}: {err}")
                failures += 1
                if i >= 5 and failures == i:  # nothing has worked: bad key/config
                    errors.append("Triage aborted: first calls all failed.")
                    pool.shutdown(wait=False, cancel_futures=True)
                    break
                continue
            apply_triage_result(session, c, result)
            promoted = promote(session, c, result, country_names)
            if promoted and promoted[0] == "opportunity":
                new_opps.append(promoted[1])
            elif promoted:
                new_news.append(promoted[1])
            session.commit()
            if i % 25 == 0:
                print(f"  triaged {i}/{len(to_llm)}")
    print(f"Triage: {len(to_llm)} LLM calls -> {len(new_opps)} opportunities, {len(new_news)} news items")

    # --- 3. Digest ------------------------------------------------------------
    digest_opps = [{
        "priority": "P1" if (o.opportunity_relevance_score or 0) >= 75 else "P2",
        "country": country_names.get(o.country, o.country or "International"),
        "project": o.title, "authority": o.authority or "UNCLEAR",
        "type": o.opportunity_type, "deadline": o.deadline.date().isoformat() if o.deadline else "NOT_DISCLOSED",
        "opportunity_score": o.opportunity_relevance_score,
        "details": {"sources": o.official_url or ""},
    } for o in new_opps if o.opportunity_type != "signal"]
    signals = [{
        "country": country_names.get(o.country, o.country or "International"),
        "signal": o.title, "action": f"Review: {o.official_url}",
    } for o in new_opps if o.opportunity_type == "signal"]

    coverage = CoverageStats(
        countries_checked=len(countries), countries_total=len(countries),
        sources_checked=len(sources), sources_total=len(sources),
        queries_executed=query_count, candidates_found=len(candidates),
        deep_analyses_executed=0, new_opportunities=len(digest_opps),
        material_updates=0, errors=errors,
    )
    digest_md = render_daily_digest(
        run_date=date.today(), coverage=coverage, new_opportunities=digest_opps,
        rollout_changes=[], early_signals=signals, existing_updates=[],
    )
    out_dir = os.path.join(os.path.dirname(__file__), "reports", "daily")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{date.today().isoformat()}.md")
    with open(out_path, "w") as f:
        f.write(digest_md)

    agent_run.finished_at = datetime.utcnow()
    agent_run.status = "COMPLETE"
    session.commit()
    session.close()
    print(f"Digest written to {out_path}" + (f" ({len(errors)} errors)" if errors else ""))
    return out_path


if __name__ == "__main__":
    main()
