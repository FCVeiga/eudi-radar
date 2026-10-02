"""
English for everything the platform shows.

New items get English from triage (title_en, English summaries, buyer names
with an English rendering). This fills the gaps — items from before that,
and RSS / site-search activity — in small batches each pipeline run until
nothing is left, and writes English notes for tender updates. The website
also refuses to render text it can't confirm is English (webapp/lib/english.ts).
"""
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.llm_client import call_llm_json, CHEAP_MODEL  # noqa: E402

BATCH = 20
MAX_BATCHES_PER_RUN = 25

_SYSTEM = """You translate text for an English-language intelligence feed on digital
identity wallets and public procurement. For each numbered item, detect its
language and give English. If it is already English, return it unchanged.

- kind "title": a clear English title. Drop procurement boilerplate such as
  CPV category prefixes ("IT services: consulting, software development…")
  and reference numbers; keep names, places and what is procured/announced.
- kind "name": an organisation name. Keep the official name and add the
  English rendering in parentheses, e.g. "Bundesamt für Sicherheit in der
  Informationstechnik (Federal Office for Information Security)". Unchanged
  if already English.

Reply with JSON only: {"items": [{"n": 1, "language": "de", "text": "..."}, ...]}"""

# (table, key, source column, target column, kind, extra condition) — every
# non-English text the site can show. Site-search finds only matter once
# triage marked them relevant.
TARGETS = [
    ("opportunities", "opportunity_id", "title", "title_en", "title", ""),
    ("opportunities", "opportunity_id", "authority", "authority_en", "name", ""),
    ("news_items", "news_id", "title", "title_en", "title", ""),
    ("documents", "document_id", "name", "name_en", "title", ""),
    ("source_activity", "id", "title", "title_en", "title",
     "and (relevant is true or source_id in (select source_id from sources where method <> 'site_search'))"),
]


def translate(texts: list, kind: str) -> list:
    listing = "\n".join(f'{i + 1}. [{kind}] {t}' for i, t in enumerate(texts))
    out = call_llm_json(_SYSTEM, listing, model=CHEAP_MODEL, max_tokens=4000)
    by_n = {int(x["n"]): x for x in out.get("items", []) if "n" in x}
    return [by_n.get(i + 1, {}) for i in range(len(texts))]


def backfill_english_titles(session, errors: list) -> int:
    """Fill every English column the site reads from (see TARGETS), a few
    batches per run, until nothing is left. On an API failure it stops and
    retries next run; the site never shows the untranslated text meanwhile."""
    done, batches = 0, 0
    for table, key, src, dst, kind, extra in TARGETS:
        has_lang = table != "source_activity" and src == "title"
        while batches < MAX_BATCHES_PER_RUN:
            rows = session.execute(text(f"select {key} as k, {src} as src from {table} "
                                        f"where {dst} is null and {src} is not null {extra} order by {key} limit {BATCH}")).fetchall()
            if not rows:
                break
            batches += 1
            try:
                results = translate([r.src for r in rows], kind)
            except Exception as e:
                errors.append(f"translate {table}.{src}: {e}"[:300])
                return done
            for r, res in zip(rows, results):
                english = (res.get("text") or "").strip() or r.src
                sets = f"{dst} = :t" + (", language = coalesce(language, :l)" if has_lang else "")
                session.execute(text(f"update {table} set {sets} where {key} = :k"),
                                {"t": english[:500], "l": (res.get("language") or None), "k": r.k})
                done += 1
            session.commit()
    return done


_NOTE_SYSTEM = """You write update notes on public tenders for bid managers, posted as a
short comment under the tender. You get, for each numbered update, the change
the radar detected and what the official change notice says (often not in
English). Write one English note per update, max 200 characters: lead with
the change, then the reason if given; mention clarifications, amended
documents, price sheets or contract clauses when the notice says so. Plain
and factual, no filler. Dates as "5 Oct 2026".

Reply with JSON only: {"items": [{"n": 1, "note": "..."}, ...]}"""


def write_update_notes(session, errors: list) -> int:
    """English notes for change events whose notice text hasn't been turned into one yet."""
    rows = session.execute(text("""select id, description, note_source from change_events
        where note is null and note_source is not null order by id limit 40""")).fetchall()
    if not rows:
        return 0
    listing = "\n".join(f"{i + 1}. Detected: {r.description}\n   Notice says: {r.note_source[:1200]}" for i, r in enumerate(rows))
    try:
        out = call_llm_json(_NOTE_SYSTEM, listing, model=CHEAP_MODEL, max_tokens=4000)
    except Exception as e:
        errors.append(f"update notes: {e}"[:300])
        return 0
    by_n = {int(x["n"]): x.get("note") for x in out.get("items", []) if "n" in x}
    done = 0
    for i, r in enumerate(rows):
        if by_n.get(i + 1):
            session.execute(text("update change_events set note = :n where id = :id"), {"n": by_n[i + 1][:300], "id": r.id})
            done += 1
    session.commit()
    return done

