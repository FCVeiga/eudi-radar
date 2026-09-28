"""
World Bank procurement notices adapter.

CONFIRMED (2026-09 research pass): fully open, keyless public API.
Endpoint: https://search.worldbank.org/api/v2/procnotices
Data license: CC BY 4.0 (World Bank Group). Best single source for
Africa/LatAm coverage — one consistent feed across 100+ borrowing countries.
"""
from typing import Optional
import requests

_WB_API_BASE = "https://search.worldbank.org/api/v2/procnotices"


class WorldBankAdapter:
    def __init__(self, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()

    def search(self, keyword: Optional[str] = None, country: Optional[str] = None,
               rows: int = 50) -> list[dict]:
        params = {"format": "json", "rows": rows}
        if keyword:
            params["qterm"] = keyword
        if country:
            params["countryname_exact"] = country
        resp = self.session.get(_WB_API_BASE, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        notices = data.get("procnotices", {})
        if isinstance(notices, dict):
            notices = list(notices.values())
        return [
            {
                "notice_id": n.get("id") or n.get("notice_id"),
                "title": n.get("bid_description") or n.get("project_name", ""),
                "country": n.get("country") or n.get("countryname"),
                "project_id": n.get("project_id"),
                "project_name": n.get("project_name"),
                "notice_type": n.get("notice_type"),
                "notice_date": n.get("notice_date") or n.get("noticedate"),
                "deadline": n.get("submission_deadline_date") or n.get("deadline_date"),
                "url": f"https://search.worldbank.org/api/v2/procnotices?format=json&id={n.get('id', '')}",
            }
            for n in notices
        ]
