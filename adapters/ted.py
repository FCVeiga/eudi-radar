"""
TED (Tenders Electronic Daily) adapter.

CONFIRMED (2026-09 research pass): TED's public API v3 is genuinely open —
no API key, login, or auth required to read published notices. Official
docs: https://docs.ted.europa.eu/api/. Auth is only required for
submission-related workflows, not our use case (spec section 5, Tier 1).
"""
import hashlib
from datetime import datetime
from typing import Optional

import requests

from .web_search import SearchProvider, SearchResult

_TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search"


class TedSearchProvider(SearchProvider):
    def __init__(self, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()

    def search(self, query, country=None, language="en", date_from=None):
        params = {"q": query, "scope": "3", "lang": language}
        if country:
            params["country"] = country
        if date_from:
            params["publication-date-from"] = date_from.strftime("%Y%m%d")
        resp = self.session.get(_TED_API_BASE, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results = []
        for notice in data.get("results", []):
            results.append(SearchResult(
                title=notice.get("title", ""), url=notice.get("uri", ""),
                snippet=notice.get("summary", ""),
                published_date=notice.get("publication-date"),
            ))
        return results

    def fetch(self, url: str) -> str:
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text

    def download(self, url: str, dest_path: str) -> str:
        resp = self.session.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return dest_path

    @staticmethod
    def hash_document(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
