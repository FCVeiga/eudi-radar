"""
Feed writer — turns radar events into posts for the EUDI Radar home feed.

Events, each becoming one post:
  - a new active opportunity (tender, RFI, grant, signal)
  - a material update to a tracked opportunity (deadline moved, awarded)
  - a news story

The copy comes from the LLM (prompts/feed_post.md), fed only structured
facts so it can't invent details. Ranking mirrors webapp/lib/feed.ts:

    hot = score × 0.5^(age_days / HALF_LIFE_DAYS)

Because every post decays at the same rate, relative order only changes when
posts enter or leave — so each run snapshots ranks (rank / prev_rank) and the
site shows ▲/▼ against the previous run.
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from urllib.parse import urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models import ChangeEvent, Country, FeedPost, NewsItem, Opportunity  # noqa: E402
from services.llm_client import call_llm_json_premium, load_prompt  # noqa: E402

HALF_LIFE_DAYS = 4          # keep in sync with webapp/lib/feed.ts
UNSCORED = 30               # items whose score is unknown rank as "marginal"
UPDATE_WINDOW_DAYS = 14     # only recent changes become posts
SIGNAL_MAX_AGE_DAYS = 183   # keep in sync with webapp/lib/data.ts

CATEGORY_NAMES = {"rfp": "tender (RFP)", "rfi": "request for information / market consultation",
                  "grant": "grant / funding call", "signal": "procurement signal (announced, not open yet)"}
_PROMPT = None


def _naive(d):
    return d.replace(tzinfo=None) if d else None


def hot(score, posted_at, now):
    age_days = max(0.0, (now - _naive(posted_at)).total_seconds() / 86400) if posted_at else 0.0
    return (score if score is not None else UNSCORED) * 0.5 ** (age_days / HALF_LIFE_DAYS)


def is_active(o: Opportunity, now: datetime) -> bool:
    """Same rule as getActiveOpportunities() on the site."""
    if o.status not in ("OPEN", "SIGNAL"):
        return False
    if o.deadline and _naive(o.deadline) < now:
        return False
    if o.status == "SIGNAL" and not o.deadline and o.publication_date \
            and now - _naive(o.publication_date) > timedelta(days=SIGNAL_MAX_AGE_DAYS):
        return False
    return True


def _fmt(d):
    return _naive(d).strftime("%d %b %Y") if d else None


def _facts(lines: dict) -> str:
    return "\n".join(f"{k}: {v}" for k, v in lines.items() if v)


def opportunity_facts(o: Opportunity, country_names: dict) -> dict:
    return {
        "Category": CATEGORY_NAMES.get(o.opportunity_type, o.opportunity_type),
        "Original title": o.title,
        "Country": country_names.get(o.country, o.country),
        "Buyer": o.authority,
        "Deadline": _fmt(o.deadline),
        "Estimated value": f"{o.currency or ''} {o.estimated_value:,.0f}".strip() if o.estimated_value else None,
        "Analyst summary": o.summary,
        "Source": urlparse(o.official_url or "").netloc,
    }


def write(event: str, facts: dict) -> dict:
    global _PROMPT
    if _PROMPT is None:
        _PROMPT = load_prompt("feed_post.md")
    out = call_llm_json_premium(_PROMPT, f"Event: {event}\n{_facts(facts)}")
    headline, body = (out.get("headline") or "").strip(), (out.get("body") or "").strip()
    if not headline:
        raise ValueError(f"empty headline: {out}")
    return {"headline": headline[:140], "body": body[:400]}


def plan_posts(session, now: datetime) -> list:
    """Events that should be posts but aren't yet: (post fields, event, facts)."""
    have = {pid for (pid,) in session.query(FeedPost.post_id)}
    country_names = {c.code: c.name for c in session.query(Country)}
    opps = {o.opportunity_id: o for o in session.query(Opportunity)}
    plans = []

    for o in opps.values():
        pid = f"opp:{o.opportunity_id}"
        if pid in have or not is_active(o, now):
            continue
        plans.append((dict(post_id=pid, kind="opportunity", event="new_opportunity",
                           opportunity_id=o.opportunity_id, category=o.opportunity_type,
                           country=o.country, score=o.opportunity_relevance_score,
                           posted_at=_naive(o.first_detected) or now),
                      "New opportunity", opportunity_facts(o, country_names)))

    # Only the latest change per opportunity and kind: an older deadline move
    # that has since been superseded would just be stale news.
    since = now - timedelta(days=UPDATE_WINDOW_DAYS)
    latest = {}
    for c in (session.query(ChangeEvent).filter(ChangeEvent.detected_at >= since)
              .order_by(ChangeEvent.detected_at, ChangeEvent.id)):
        latest[(c.opportunity_id, c.event_type)] = c
    for c in latest.values():
        pid, o = f"chg:{c.id}", opps.get(c.opportunity_id)
        if pid in have or not o:
            continue
        desc = c.description or ""
        if c.event_type == "deadline" and is_active(o, now):
            event, label = "deadline_change", "Deadline change"
        elif c.event_type == "status" and "award" in desc.lower():
            event, label = "awarded", "Contract awarded"
        else:
            continue  # e.g. a deadline simply passing isn't news
        facts = opportunity_facts(o, country_names) | {"What changed": desc}
        plans.append((dict(post_id=pid, kind="opportunity", event=event, opportunity_id=o.opportunity_id,
                           change_event_id=c.id, category=o.opportunity_type, country=o.country,
                           score=o.opportunity_relevance_score, posted_at=_naive(c.detected_at)),
                      label, facts))

    for n in session.query(NewsItem):
        pid = f"news:{n.news_id}"
        if pid in have:
            continue
        plans.append((dict(post_id=pid, kind="news", event="news", news_id=n.news_id, category=n.category,
                           country=n.country, score=n.relevance_score,
                           posted_at=_naive(n.published_date) or _naive(n.created_at) or now),
                      f"News ({n.category})",
                      {"Original title": n.title, "Region": n.region, "Source": n.source_name,
                       "Published": _fmt(n.published_date), "Analyst summary": n.summary,
                       "Excerpt": (n.excerpt or "")[:400]}))
    return plans


def publish_new_posts(session, errors: list, now=None) -> int:
    """Write and store posts for every new event. Failed posts are retried next run."""
    now = now or datetime.utcnow()
    plans = plan_posts(session, now)

    def run(plan):
        fields, event, facts = plan
        try:
            return fields, write(event, facts), None
        except Exception as e:
            return fields, None, e

    published = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for fields, copy, err in pool.map(run, plans):
            if err:
                errors.append(f"feed post {fields['post_id']}: {err}")
                continue
            session.add(FeedPost(**fields, **copy, created_at=now))
            session.commit()
            published += 1
    return published


def visible(p: FeedPost, opps: dict, now: datetime) -> bool:
    if p.kind == "news" or p.event == "awarded":
        return True
    o = opps.get(p.opportunity_id)
    return bool(o) and is_active(o, now)


def rank_posts(session, now=None) -> int:
    """Refresh scores from their sources, rank visible posts by hot, and keep
    the previous rank so the site can show movement."""
    now = now or datetime.utcnow()
    opps = {o.opportunity_id: o for o in session.query(Opportunity)}
    news = {n.news_id: n for n in session.query(NewsItem)}
    posts = session.query(FeedPost).all()
    for p in posts:
        if p.opportunity_id in opps:
            p.score = opps[p.opportunity_id].opportunity_relevance_score
        elif p.news_id in news:
            p.score = news[p.news_id].relevance_score
    shown = sorted((p for p in posts if visible(p, opps, now)), key=lambda p: hot(p.score, p.posted_at, now),
                   reverse=True)
    shown_ids = {p.post_id for p in shown}
    for i, p in enumerate(shown, 1):
        p.prev_rank, p.rank, p.ranked_at = p.rank, i, now
    for p in posts:
        if p.post_id not in shown_ids:
            p.prev_rank, p.rank = p.rank, None
    session.commit()
    return len(shown)
