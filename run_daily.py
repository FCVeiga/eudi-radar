"""
Master Daily Workflow orchestrator (spec section 75).
Wires agents together: discovery -> triage -> promotion -> digest.

    python run_daily.py

Needs DATABASE_URL and ANTHROPIC_API_KEY. TAVILY_API_KEY is optional (web
search is skipped without it; TED is keyless). Tunables via env:
TAVILY_QUERIES_PER_RUN (default 20), MAX_TRIAGE_PER_RUN (default 400).
"""
import os
import re
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, date, timedelta
from types import SimpleNamespace
from urllib.parse import urlparse

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "database"))
sys.path.insert(0, os.path.dirname(__file__))

from database.models import (  # noqa: E402
    init_db, get_session, Source, Country, AgentRun, Candidate, Opportunity, NewsItem,
    ChangeEvent, ChangeImportance,
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

def _local_ted_phrases() -> list:
    """Wallet phrases in every EU language (config/languages.yaml): TED matches
    each notice in its own language, so English-only phrases miss most of them.
    The generic 'electronic identification' terms are left out on purpose —
    like bare 'eIDAS', they match e-signature boilerplate in unrelated notices."""
    with open(os.path.join(CONFIG_DIR, "languages.yaml")) as f:
        phrases = yaml.safe_load(f)["phrases"]
    return [p for lang, ps in phrases.items() if lang != "en" for p in ps[:2]]


TED_PHRASES = list(dict.fromkeys(TED_PHRASES + _local_ted_phrases()))

# Triage type -> opportunity category shown on the site (Opportunities subpages).
OPPORTUNITY_TYPES = {
    "TENDER": "rfp", "RFI": "rfi", "GRANT": "grant", "CONSORTIUM_CALL": "grant",
    "PILOT": "grant", "PIPELINE_SIGNAL": "signal",
}
NEWS_CATEGORIES = ("regulation", "industry", "market")
PROMOTE_THRESHOLD = 50

# Tavily news-mode queries (last 30 days). Only candidates from this pack are
# eligible for the News page — general web results for NEWS_ONLY are mostly
# vendor product pages. Triage relevance is bid-oriented, so news only needs
# relevance > 0 (0 = off-topic / suppressed).
NEWS_QUERIES = [
    # market: adopters (governments, banks, …)
    "EUDI Wallet", "European Digital Identity Wallet rollout",
    "national digital identity wallet launch",
    "mobile driving licence digital wallet government",
    # regulation
    "eIDAS 2 implementing acts", "European Commission digital identity regulation wallet certification",
    # industry: vendors / competitors
    "digital identity wallet company funding acquisition partnership",
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


def ted_meta(candidate: Candidate) -> dict:
    """Fields the TED adapter writes into the snippet: notice type, procedure
    id (shared by every notice of one procurement) and tender deadline."""
    if "ted.europa.eu" not in (candidate.source_url or ""):
        return {}
    text = candidate.description or ""
    grab = lambda pat: (m.group(1) if (m := re.search(pat, text)) else None)
    return {
        "notice_type": grab(r"Notice type: ([a-z0-9-]+)"),
        "procedure": grab(r"TED procedure: ([0-9a-f-]{36})"),
        "deadline": _parse_date(grab(r"Tender deadline: (\d{4}-\d{2}-\d{2})")),
    }


def ted_notice_order(url: str):
    """TED publication numbers ("671205-2026") increase over time: (year, n)."""
    m = re.search(r"/(\d+)-(\d{4})$", url or "")
    return (int(m.group(2)), int(m.group(1))) if m else None


def ted_notice_type(candidate: Candidate):
    return ted_meta(candidate).get("notice_type")


def _fmt(d):
    return d.strftime("%d %b %Y") if d else "none"


def record_changes(session, opp: Opportunity, new: dict, now: datetime,
                   notice_url: str = None, note: str = None) -> list:
    """Diff an existing opportunity against incoming values; log each material
    change as a ChangeEvent so the site can show what moved. notice_url / note
    carry what the change notice itself says (see agents/updates.py)."""
    events = []
    old_dl = opp.deadline.replace(tzinfo=None) if opp.deadline else None
    new_dl = new.get("deadline")
    if new_dl and old_dl != new_dl:
        verb = "extended" if old_dl and new_dl > old_dl else "brought forward" if old_dl else "set"
        events.append(("deadline", f"Deadline {verb}: {_fmt(old_dl)} → {_fmt(new_dl)}"))
    finished = ("AWARDED", "CLOSED")
    newly_finished = new.get("status") in finished and opp.status != new.get("status")
    reopened = opp.status in finished and new.get("status") == "OPEN"
    if newly_finished or reopened:
        events.append(("status", f"Status changed: {opp.status} → {new['status']}"))
    for event_type, description in events:
        session.add(ChangeEvent(opportunity_id=opp.opportunity_id, event_type=event_type,
                                importance=ChangeImportance.MATERIAL, description=description,
                                detected_at=now, notice_url=notice_url, note_source=note))
    return [d for _, d in events]


def classify_opportunity(candidate: Candidate, t: dict):
    """(category, awarded) — TED's notice type overrides the LLM when present:
    cn-* and pin-cfc-* (PIN used as the call itself) = RFP; pmc = market
    consultation (RFI); other pin-* = prior information notice, i.e. a planned
    procurement (signal); can-*/veat = award (already awarded, never active)."""
    category = OPPORTUNITY_TYPES.get((t.get("type") or "").upper())
    nt = ted_notice_type(candidate)
    if nt:
        if nt.startswith(("can-", "veat")):
            return category or "rfp", True
        if nt.startswith(("cn-", "pin-cfc")):
            return "rfp", False
        if nt == "pmc":
            return "rfi", False
        if nt.startswith("pin-"):
            return "signal", False
    return category, False


def promote(session, candidate: Candidate, t: dict, country_names: dict):
    """Turn a triaged candidate into an Opportunity or NewsItem row.
    Returns ("opportunity"|"news", row), ("updated", opp, [change, ...]) or None."""
    ctype = (t.get("type") or "").upper()
    relevance = int(t.get("relevance") or 0)
    country = (t.get("country") or "").upper()[:2] or None
    summary = t.get("summary") or t.get("reason") or ""

    category, awarded = classify_opportunity(candidate, t)
    if category and relevance >= PROMOTE_THRESHOLD:
        now = datetime.utcnow()
        ted = ted_meta(candidate)
        # Only TED's structured deadline is trusted at this point. Anything else
        # starts UNVERIFIED and is settled by verify_opportunities() against
        # the source page (triage only saw a snippet and doesn't know the date).
        deadline = ted.get("deadline")
        if awarded:
            status = "AWARDED"
        elif deadline:
            status = "OPEN" if deadline >= now else "CLOSED"
        else:
            status, deadline = "UNVERIFIED", _parse_date(t.get("deadline"))
        reference = f"TED:{ted['procedure']}" if ted.get("procedure") else None
        fields = dict(
            title=candidate.title or "(untitled)", country=country,
            title_en=(t.get("title_en") or None), language=(t.get("language") or None),
            authority=(t.get("authority") or None), opportunity_type=category,
            status=status, summary=summary, deadline=deadline,
            publication_date=_parse_date(candidate.publication_date),
            official_url=candidate.source_url, last_checked=now,
            relevance_score=relevance, opportunity_relevance_score=relevance,
        )
        if reference:
            fields["reference"] = reference

        # Is this an update of something we already track? TED republishes a
        # procurement as a new notice for every change (deadline extensions,
        # corrigenda), all sharing one procedure id. Fall back to the same
        # notice URL (re-triage), then same TED title + country.
        q = session.query(Opportunity)
        existing = (q.filter_by(reference=reference).first() if reference else None) \
            or (q.filter_by(official_url=candidate.source_url).first() if candidate.source_url else None)
        if not existing and ted:
            existing = q.filter(Opportunity.title == fields["title"], Opportunity.country == country,
                                Opportunity.official_url.like("%ted.europa.eu%")).first()
        opp_id = fingerprint(country or "", t.get("authority") or "", None, candidate.title or "")
        existing = existing or session.get(Opportunity, opp_id)

        if existing:
            held, incoming = ted_notice_order(existing.official_url), ted_notice_order(candidate.source_url)
            if held and incoming and incoming < held:
                existing.last_checked = now
                return None  # an older notice of a procurement we hold a newer version of
            # publication_date = when the procurement first appeared (drives "New");
            # a later notice is an update, not a new opportunity.
            old_pub = existing.publication_date.replace(tzinfo=None) if existing.publication_date else None
            if old_pub and (not fields["publication_date"] or old_pub < fields["publication_date"]):
                fields["publication_date"] = old_pub
            if existing.verified_at and not awarded and not ted.get("deadline"):
                # Keep the status/deadline verification established; a snippet
                # re-triage is weaker evidence.
                fields.pop("status"); fields.pop("deadline")
            # A newer TED notice is a change notice: keep what it says changed.
            notice_note, notice_changes = None, None
            if ted and incoming and (not held or incoming > held):
                try:
                    from adapters.ted import TedSearchProvider
                    from agents.updates import note_source
                    notice_changes = TedSearchProvider().notice_changes(candidate.source_url.rstrip("/").split("/")[-1])
                    notice_note = note_source(notice_changes)
                except Exception:
                    pass
            changes = record_changes(session, existing, fields, now, candidate.source_url if notice_note else None, notice_note)
            if not changes and notice_note:
                # Clarifications, amended documents…: an update even without a new deadline.
                from agents.updates import fallback_description
                desc = fallback_description(notice_changes)
                session.add(ChangeEvent(opportunity_id=existing.opportunity_id, event_type="notice_update",
                                        importance=ChangeImportance.MATERIAL, description=desc, detected_at=now,
                                        notice_url=candidate.source_url, note_source=notice_note))
                changes = [desc]
            for k, v in fields.items():
                setattr(existing, k, v)
            if changes:
                existing.last_change = now
                return "updated", existing, changes
            return None
        opp = Opportunity(opportunity_id=opp_id, first_detected=now, **fields)
        session.add(opp)
        return "opportunity", opp

    from_news_search = "news" in (candidate.potential_categories or [])
    if ctype == "NEWS_ONLY" and from_news_search and relevance > 0:
        category = t.get("news_category") if t.get("news_category") in NEWS_CATEGORIES else "market"
        fields = dict(
            title=candidate.title or "(untitled)", category=category,
            title_en=(t.get("title_en") or None), language=(t.get("language") or None),
            region=country_names.get(country, "EU / International") if country else "EU / International",
            country=country, published_date=_parse_date(candidate.publication_date) or candidate.discovered_at,
            source_name=urlparse(candidate.source_url or "").netloc,
            source_url=candidate.source_url,
            excerpt=(candidate.description or "")[:400], summary=summary,
            impact_note=t.get("reason") or "",
            relevance_score=int(t.get("importance") or 0) or None,
        )
        existing = session.get(NewsItem, candidate.candidate_id)
        if existing:  # re-triage: refresh in place
            for k, v in fields.items():
                setattr(existing, k, v)
            return None
        item = NewsItem(news_id=candidate.candidate_id, **fields)
        session.add(item)
        return "news", item
    return None


def verify_opportunities(session, errors: list) -> int:
    """Check every not-yet-settled opportunity against its source: TED XML
    for TED notices without a deadline, page text + LLM for everything else.
    Re-checks items without a firm deadline weekly, since pages change."""
    from adapters.ted import TedSearchProvider
    from agents import verification as V
    tavily = None
    if os.environ.get("TAVILY_API_KEY"):
        from adapters.tavily import TavilySearchProvider
        tavily = TavilySearchProvider()
    ted = TedSearchProvider()
    now = datetime.utcnow()
    stale = now - timedelta(days=V.REVERIFY_AFTER_DAYS)
    todo = (session.query(Opportunity)
            .filter(~Opportunity.status.in_(["CLOSED", "AWARDED", "REJECTED"]))
            .filter((Opportunity.verified_at.is_(None)) | (Opportunity.verified_at < stale))
            .all())
    checked = 0
    for o in todo:
        is_ted = "ted.europa.eu" in (o.official_url or "")
        if is_ted and o.deadline:
            continue  # TED's structured deadline already decides it
        try:
            if is_ted:
                status, deadline, evidence = V.verify_ted(ted, o.official_url.rstrip("/").split("/")[-1],
                                                          o.opportunity_type, now)
                category = o.opportunity_type
            else:
                v = V.llm_verify(o.opportunity_type, o.title, V.fetch_page_text(o.official_url, tavily), now)
                status, deadline, dated, category = V.resolve(o.opportunity_type, v, now)
                evidence = (f'"{v["evidence"]}" — {v.get("reason") or ""}' if v.get("evidence")
                            else v.get("reason") or "No dates found on the source page")
                if dated and not o.publication_date:
                    o.publication_date = dated
        except Exception as e:
            errors.append(f"verify {o.opportunity_id}: {e}")
            status, deadline, category, evidence = "UNVERIFIED", None, o.opportunity_type, f"Source could not be read: {e}"[:300]
        if o.verified_at:  # the first check is a correction, not a change worth announcing
            record_changes(session, o, {"status": status, "deadline": deadline}, now)
        o.status, o.opportunity_type, o.status_evidence, o.verified_at = status, category, evidence, now
        if deadline:
            o.deadline = deadline
        session.commit()
        checked += 1
    return checked


def main():
    engine = init_db()
    session = get_session(engine)
    errors = []

    run_id = f"RUN-{uuid.uuid4().hex[:10]}"
    agent_run = AgentRun(run_id=run_id, agent_name="daily_orchestrator",
                         started_at=datetime.utcnow(), status="RUNNING")
    session.add(agent_run)
    session.commit()

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

    # Followed sources (Following sidebar): RSS feeds and domain searches on
    # their own schedules; whatever they surface joins the triage queue.
    from agents.source_monitor import check_sources, ingest_activity
    monitored = check_sources(session, errors)
    from_sources = ingest_activity(session)
    print(f"Sources: {monitored['checked']} of {monitored['total']} monitored sources due and checked, "
          f"{monitored['found']} new items, {from_sources} new candidates")

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

    new_opps, new_news, updates = [], [], []
    failures = streak = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, (c, (result, err)) in enumerate(zip(to_llm, pool.map(_triage, snapshots)), 1):
            if err:
                errors.append(f"triage {c.candidate_id}: {err}")
                failures += 1
                streak += 1
                # Bad key, no credit, outage: stop instead of failing the whole queue.
                if (i >= 5 and failures == i) or streak >= 10:
                    errors.append(f"Triage aborted after {streak} consecutive failures: {err}"[:300])
                    pool.shutdown(wait=False, cancel_futures=True)
                    break
                continue
            streak = 0
            apply_triage_result(session, c, result)
            promoted = promote(session, c, result, country_names)
            if promoted and promoted[0] == "opportunity":
                new_opps.append(promoted[1])
            elif promoted and promoted[0] == "updated":
                updates.append({"opportunity": promoted[1].title, "change": "; ".join(promoted[2]),
                                "action": f"Review: {promoted[1].official_url}"})
            elif promoted:
                new_news.append(promoted[1])
            session.commit()
            if i % 25 == 0:
                print(f"  triaged {i}/{len(to_llm)}")
    print(f"Triage: {len(to_llm)} LLM calls -> {len(new_opps)} opportunities, {len(updates)} updates, {len(new_news)} news items")

    from agents.source_monitor import mark_relevance
    mark_relevance(session)

    # --- 3. Verification: is each opportunity actually open today? ----------
    verified = verify_opportunities(session, errors)
    print(f"Verification: {verified} opportunities checked against their source")

    # English titles for anything that predates triage's title_en, and for activity;
    # English notes for tender updates (shown as comments).
    from agents.translator import backfill_english_titles
    translated = backfill_english_titles(session, errors)
    from agents.translator import write_update_notes
    noted = write_update_notes(session, errors)
    if noted:
        print(f"Update notes: {noted} written")
    if translated:
        print(f"Translation: {translated} titles given an English version")

    # --- 4. Feed: agents post new events, then the feed is re-ranked ---------
    from agents.feed_writer import publish_new_posts, rank_posts
    posted = publish_new_posts(session, errors)
    ranked = rank_posts(session)
    print(f"Feed: {posted} new posts, {ranked} posts ranked")

    # --- 5. Digest ------------------------------------------------------------
    digest_opps = [{
        "priority": "P1" if (o.opportunity_relevance_score or 0) >= 75 else "P2",
        "country": country_names.get(o.country, o.country or "International"),
        "project": o.title, "authority": o.authority or "UNCLEAR",
        "type": o.opportunity_type, "deadline": o.deadline.date().isoformat() if o.deadline else "NOT_DISCLOSED",
        "opportunity_score": o.opportunity_relevance_score,
        "details": {"sources": o.official_url or ""},
    } for o in new_opps if o.opportunity_type != "signal" and o.status != "AWARDED"]
    signals = [{
        "country": country_names.get(o.country, o.country or "International"),
        "signal": o.title, "action": f"Review: {o.official_url}",
    } for o in new_opps if o.opportunity_type == "signal"]

    coverage = CoverageStats(
        countries_checked=len(countries), countries_total=len(countries),
        sources_checked=monitored["checked"] + 1, sources_total=monitored["total"],  # +1: TED
        queries_executed=query_count, candidates_found=len(candidates),
        deep_analyses_executed=0, new_opportunities=len(digest_opps),
        material_updates=len(updates), errors=errors,
    )
    digest_md = render_daily_digest(
        run_date=date.today(), coverage=coverage, new_opportunities=digest_opps,
        rollout_changes=[], early_signals=signals, existing_updates=updates,
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
