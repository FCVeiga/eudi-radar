"""
Social Monitor agent — polls config/tracked_accounts.yaml, pulls recent
posts via adapters/twitter.py and adapters/linkedin.py, inserts them as
Candidate rows so they flow through the same triage stage as everything else.
"""
import hashlib
import os
import sys
from datetime import datetime

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import Candidate  # noqa: E402

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "tracked_accounts.yaml")


def load_tracked_accounts(active_only: bool = True) -> list[dict]:
    with open(CONFIG_PATH) as f:
        data = yaml.safe_load(f)
    accounts = data.get("accounts", [])
    return [a for a in accounts if not active_only or a.get("active", False)]


def _candidate_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def ingest_twitter_posts(session, twitter_adapter, account: dict) -> list:
    posts = twitter_adapter.get_recent_posts(account["handle"])
    new_candidates = []
    for p in posts:
        cid = _candidate_id(p["url"])
        if session.get(Candidate, cid):
            continue
        c = Candidate(
            candidate_id=cid, discovered_at=datetime.utcnow(), source_url=p["url"],
            title=f"{account.get('display_name', account['handle'])} (Twitter/X)",
            description=p["text"], publication_date=None,
            potential_categories=["SOCIAL", account.get("category", "")],
            processed=False,
        )
        session.add(c)
        new_candidates.append(c)
    session.commit()
    return new_candidates


def ingest_linkedin_posts(session, linkedin_adapter, account: dict) -> list:
    posts = linkedin_adapter.get_recent_posts(account["profile_url"])
    new_candidates = []
    for p in posts:
        cid = _candidate_id(p["url"])
        if session.get(Candidate, cid):
            continue
        c = Candidate(
            candidate_id=cid, discovered_at=datetime.utcnow(), source_url=p["url"],
            title=f"{account.get('display_name', account['profile_url'])} (LinkedIn)",
            description=p["text"],
            potential_categories=["SOCIAL", account.get("category", "")],
            processed=False,
        )
        session.add(c)
        new_candidates.append(c)
    session.commit()
    return new_candidates


def run_social_monitor(session, twitter_adapter=None, linkedin_adapter=None):
    accounts = load_tracked_accounts(active_only=True)
    all_new = []
    for acc in accounts:
        if acc["platform"] == "twitter" and twitter_adapter:
            all_new += ingest_twitter_posts(session, twitter_adapter, acc)
        elif acc["platform"] == "linkedin" and linkedin_adapter:
            all_new += ingest_linkedin_posts(session, linkedin_adapter, acc)
    return all_new
