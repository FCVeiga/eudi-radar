"""
Share images for news stories: the og:image / twitter:image a publisher puts
in the page's metadata. Fetched once per story (image_checked_at), no LLM.
"""
import html
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import urljoin

import requests
from sqlalchemy import text

UA = {"User-Agent": "TenderTown/1.0 (+https://tendertown.io; link preview)"}
_META = re.compile(r"<meta\b[^>]*>", re.I)


def share_image(url: str):
    """The page's og:image (or twitter:image), as an absolute https URL, or None."""
    r = requests.get(url, headers=UA, timeout=15)
    r.raise_for_status()
    head = r.text[:200_000]
    found = {}
    for tag in _META.findall(head):
        key = re.search(r'(?:property|name)=["\']([^"\']+)["\']', tag, re.I)
        val = re.search(r'content=["\']([^"\']+)["\']', tag, re.I)
        if key and val:
            found.setdefault(key.group(1).lower(), html.unescape(val.group(1)).strip())
    img = found.get("og:image:secure_url") or found.get("og:image") or found.get("twitter:image") or found.get("twitter:image:src")
    if not img:
        return None
    img = urljoin(r.url, img)
    return img if img.startswith("https://") else None  # the site is https-only


def fetch_news_images(session, limit: int = 200) -> int:
    rows = session.execute(text("""select news_id, source_url from news_items
        where image_checked_at is null and source_url is not null order by published_date desc nulls last limit :n"""),
        {"n": limit}).fetchall()

    def run(row):
        try:
            return row.news_id, share_image(row.source_url)
        except Exception:
            return row.news_id, None

    found = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        for news_id, img in pool.map(run, rows):
            session.execute(text("update news_items set image_url = :i, image_checked_at = :t where news_id = :k"),
                            {"i": img, "t": datetime.utcnow(), "k": news_id})
            found += bool(img)
    session.commit()
    return found
