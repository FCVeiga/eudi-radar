"""
Agent 1 — Discovery.

Purpose: extremely broad search at low computational cost. Maximum recall.
False positives acceptable; false negatives are not. Do NOT do full tender
analysis here — that's Agent 3 (document_analyser.py).
"""
import hashlib
import sys
import os
from datetime import datetime
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import Candidate, get_session  # noqa: E402


def _candidate_id(source_url: str, title: str) -> str:
    return hashlib.sha256(f"{source_url}|{title}".encode()).hexdigest()[:16]


def run_discovery(session, search_provider, query_packs: dict, countries: list[str]):
    new_candidates = []
    for pack_name, queries in query_packs.items():
        for query in queries:
            results = search_provider.search(query, language="en")
            for r in results:
                cid = _candidate_id(r.url, r.title)
                if session.get(Candidate, cid):
                    continue
                candidate = Candidate(
                    candidate_id=cid, discovered_at=datetime.utcnow(),
                    source_url=r.url, title=r.title, description=r.snippet,
                    discovery_query=query, potential_categories=[pack_name],
                    processed=False,
                )
                session.add(candidate)
                new_candidates.append(candidate)
    session.commit()
    return new_candidates


def build_query_combinations(pack: dict, max_combinations: Optional[int] = None):
    terms = pack.get("terms", [])
    modifiers = pack.get("combine_with", [])
    if not modifiers:
        return list(terms)
    combos = [f"{t} {m}" for t in terms for m in modifiers]
    return combos[:max_combinations] if max_combinations else combos


if __name__ == "__main__":
    print("This module is a library used by the daily workflow orchestrator.")
