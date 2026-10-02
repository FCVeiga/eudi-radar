"""
News analyst — reads each news story in full and writes, for its page on the
site: a complete summary with key facts, and an analysis of what WalliD
should do about it (post about it, take part in a consultation / standards
group / pilot, announce something, reach out, bid, or just monitor).

The company context comes from config/company_brief.md (team-editable).
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.llm_client import call_llm_json_premium, load_prompt  # noqa: E402

MAX_PER_RUN = 25
_ROOT = os.path.join(os.path.dirname(__file__), "..")
_PROMPT = None
ACTION_TYPES = {"content", "participate", "announce", "outreach", "bid", "product", "monitor"}


def _prompt() -> str:
    global _PROMPT
    if _PROMPT is None:
        with open(os.path.join(_ROOT, "config", "company_brief.md")) as f:
            brief = f.read()
        _PROMPT = load_prompt("news_analysis.md").replace("{company_brief}", brief)
    return _PROMPT


def analyse(story: dict, page_text: str) -> dict:
    facts = "\n".join(f"{k}: {v}" for k, v in story.items() if v)
    out = call_llm_json_premium(_prompt(), f"{facts}\n\nArticle text:\n{page_text or '(not available)'}",
                                max_tokens=8000, effort="medium")
    a = out.get("analysis") or {}
    actions = [x for x in (a.get("actions") or []) if isinstance(x, dict) and x.get("type") in ACTION_TYPES and x.get("title")]
    return {
        "summary": (out.get("summary") or "").strip(),
        "key_facts": [str(k) for k in (out.get("key_facts") or [])][:6],
        "analysis": {"verdict": a.get("verdict") if a.get("verdict") in ("act", "consider", "monitor") else "monitor",
                     "take": (a.get("take") or "").strip(), "actions": actions[:5]},
    }


def analyse_news(session, errors: list, limit: int = MAX_PER_RUN) -> int:
    rows = session.execute(text("""select news_id, title, title_en, category, region, published_date, source_name,
               source_url, summary from news_items where analysed_at is null
               order by published_date desc nulls last limit :n"""), {"n": limit}).fetchall()
    if not rows:
        return 0
    from agents.verification import fetch_page_text
    tavily = None
    if os.environ.get("TAVILY_API_KEY"):
        from adapters.tavily import TavilySearchProvider
        tavily = TavilySearchProvider()

    def run(r):
        try:
            try:
                page = fetch_page_text(r.source_url, tavily)[:14000] if r.source_url else ""
            except Exception:
                page = ""
            story = {"Title": r.title_en or r.title, "Category": r.category, "Region": r.region,
                     "Published": r.published_date.date().isoformat() if r.published_date else None,
                     "Source": r.source_name, "Earlier short summary": r.summary}
            return r.news_id, analyse(story, page), None
        except Exception as e:
            return r.news_id, None, e

    done, failures = 0, 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        for news_id, res, err in pool.map(run, rows):
            if err:
                errors.append(f"news analysis {news_id}: {err}"[:300])
                failures += 1
                if failures >= 5 and done == 0:
                    break  # API down / no credit: retry next run
                continue
            import json
            session.execute(text("""update news_items set summary_long = :s, key_facts = cast(:k as jsonb),
                                    analysis = cast(:a as jsonb), analysed_at = :t where news_id = :id"""),
                            {"s": res["summary"] or None, "k": json.dumps(res["key_facts"]),
                             "a": json.dumps(res["analysis"]), "t": datetime.utcnow(), "id": news_id})
            session.commit()
            done += 1
    return done
