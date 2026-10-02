"""
English titles for everything on the platform.

New items get `title_en` from triage. This fills the gaps — items triaged
before that existed, and RSS/site-search activity — by translating titles in
small batches, a few calls per pipeline run, until nothing is left.
"""
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.llm_client import call_llm_json, CHEAP_MODEL  # noqa: E402

BATCH = 20
MAX_BATCHES_PER_RUN = 15

_SYSTEM = """You translate titles for an English-language intelligence feed on digital
identity wallets and public procurement. For each numbered title: detect its
language and give a clear English title. If it is already English, return it
unchanged. Drop procurement boilerplate such as CPV category prefixes
("IT services: consulting, software development…") and reference numbers, but
keep names, places and what is being procured or announced.

Reply with JSON only: {"items": [{"n": 1, "language": "de", "title_en": "..."}, ...]}"""

# (table, key column, where clause) — every place a title is shown
TARGETS = [
    ("opportunities", "opportunity_id", "title_en is null"),
    ("news_items", "news_id", "title_en is null"),
    # site-search finds only matter once triage marked them relevant
    ("source_activity", "id", "title_en is null and (relevant is true or source_id in "
                              "(select source_id from sources where method <> 'site_search'))"),
]


def translate(titles: list) -> list:
    listing = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(titles))
    out = call_llm_json(_SYSTEM, listing, model=CHEAP_MODEL, max_tokens=4000)
    by_n = {int(x["n"]): x for x in out.get("items", []) if "n" in x}
    return [by_n.get(i + 1, {}) for i in range(len(titles))]


def backfill_english_titles(session, errors: list) -> int:
    done, batches = 0, 0
    for table, key, where in TARGETS:
        has_lang = table != "source_activity"
        while batches < MAX_BATCHES_PER_RUN:
            rows = session.execute(text(f"select {key}, title from {table} where {where} and title is not null "
                                        f"order by {key} limit {BATCH}")).fetchall()
            if not rows:
                break
            batches += 1
            try:
                results = translate([r.title for r in rows])
            except Exception as e:
                errors.append(f"translate {table}: {e}"[:300])
                return done  # likely an API problem: try again next run
            for r, res in zip(rows, results):
                title_en = (res.get("title_en") or "").strip() or r.title  # never leave it null forever
                sets = "title_en = :t" + (", language = coalesce(language, :l)" if has_lang else "")
                session.execute(text(f"update {table} set {sets} where {key} = :k"),
                                {"t": title_en[:500], "l": (res.get("language") or None), "k": getattr(r, key)})
                done += 1
            session.commit()
    return done
