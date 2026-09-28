"""
LinkedIn adapter.

IMPORTANT: LinkedIn does not offer a public API for monitoring third-party
individuals' or companies' posts. Realistic path is a paid third-party
scraping provider (Apify, PhantomBuster, Bright Data) — operates against
LinkedIn's ToS, carries real account-ban risk. This targets Apify's
LinkedIn Profile/Company Posts actor as an example integration.
"""
import os
from typing import Optional

import requests

_APIFY_BASE = "https://api.apify.com/v2"


class LinkedInAdapter:
    def __init__(self, apify_token: Optional[str] = None,
                 actor_id: str = "REPLACE_WITH_APIFY_LINKEDIN_ACTOR_ID"):
        self.token = apify_token or os.environ.get("APIFY_API_TOKEN")
        if not self.token:
            raise ValueError(
                "APIFY_API_TOKEN not set. Sign up at https://apify.com, "
                "pick a LinkedIn posts-scraping actor from the Apify Store."
            )
        self.actor_id = actor_id
        self.session = requests.Session()

    def get_recent_posts(self, profile_url: str, max_results: int = 20) -> list[dict]:
        run_url = f"{_APIFY_BASE}/acts/{self.actor_id}/run-sync-get-dataset-items"
        params = {"token": self.token}
        payload = {"profileUrls": [profile_url], "maxPosts": max_results}
        resp = self.session.post(run_url, params=params, json=payload, timeout=120)
        resp.raise_for_status()
        items = resp.json()
        return [
            {"text": item.get("text", ""), "created_at": item.get("postedAt"),
             "url": item.get("postUrl", profile_url), "profile_url": profile_url}
            for item in items
        ]
