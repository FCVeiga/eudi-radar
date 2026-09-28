"""
Twitter/X adapter — polls tracked accounts via the official X API v2.
Requires a Bearer Token; note X's Feb 2026 shift to pay-per-use pricing
for new signups (see SETUP_CHECKLIST.md / API_KEYS_NEEDED.md).
"""
import os
from datetime import datetime
from typing import Optional

import requests

_API_BASE = "https://api.twitter.com/2"


class TwitterAdapter:
    def __init__(self, bearer_token: Optional[str] = None):
        self.bearer_token = bearer_token or os.environ.get("TWITTER_BEARER_TOKEN")
        if not self.bearer_token:
            raise ValueError(
                "TWITTER_BEARER_TOKEN not set. Get one from "
                "https://developer.twitter.com/en/portal/dashboard"
            )
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.bearer_token}"})

    def get_user_id(self, handle: str) -> str:
        resp = self.session.get(f"{_API_BASE}/users/by/username/{handle}", timeout=15)
        resp.raise_for_status()
        return resp.json()["data"]["id"]

    def get_recent_posts(self, handle: str, since: Optional[datetime] = None,
                          max_results: int = 20) -> list[dict]:
        user_id = self.get_user_id(handle)
        params = {"max_results": max_results, "tweet.fields": "created_at,public_metrics"}
        if since:
            params["start_time"] = since.strftime("%Y-%m-%dT%H:%M:%SZ")
        resp = self.session.get(f"{_API_BASE}/users/{user_id}/tweets", params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return [
            {"id": t["id"], "text": t["text"], "created_at": t.get("created_at"),
             "url": f"https://twitter.com/{handle}/status/{t['id']}", "handle": handle}
            for t in data
        ]
