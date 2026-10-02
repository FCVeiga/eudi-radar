"""
News summariser — reads each news story in full and writes, for its page on
the site, a complete English digest (summary_long) and key facts, so readers
get the full grasp of the original without opening it.

The "what should WalliD do" report is not written here: the site's News
Report Agent writes it on demand (webapp/lib/newsReport.ts).
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.llm_client import call_llm_json_premium, load_prompt  # noqa: E402

MAX_PER_RUN = 30


def summarise(story: dict, page_text: str) -> dict:
    facts = "\n".join(f"{k}: {v}" for k, v in story.items() if v)
    out = call_llm_json_premium(load_prompt("news_summary.md"),
                                f"{facts}\n\nArticle text:\n{page_text or '(not available — use the facts above)'}",
                                max_tokens=6000, effort="low")
    return {"summary": (out.get("summary") or "").strip(),
            "key_facts": [str(k) for k in (out.get("key_facts") or [])][:8]}


def summarise_news(session, errors: list, limit: int = MAX_PER_RUN) -> int:
    rows = session.execute(text("""select news_id, title, title_en, category, region, published_date, source_name,
               source_url, summary from news_items where summary_long is null
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
                page = fetch_page_text(r.source_url, tavily)[:16000] if r.source_url else ""
            except Exception:
                page = ""
            story = {"Title": r.title_en or r.title, "Category": r.category, "Region": r.region,
                     "Published": r.published_date.date().isoformat() if r.published_date else None,
                     "Source": r.source_name, "Earlier short summary": r.summary}
            return r.news_id, summarise(story, page), None
        except Exception as e:
            return r.news_id, None, e

    done, failures = 0, 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        for news_id, res, err in pool.map(run, rows):
            if err:
                errors.append(f"news summary {news_id}: {err}"[:300])
                failures += 1
                if failures >= 5 and done == 0:
                    break  # API down / no credit: retry next run
                continue
            if not res["summary"]:
                continue
            session.execute(text("""update news_items set summary_long = :s, key_facts = cast(:k as jsonb)
                                    where news_id = :id"""),
                            {"s": res["summary"], "k": json.dumps(res["key_facts"]), "id": news_id})
            session.commit()
            done += 1
    return done
