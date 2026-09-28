"""Generic SearchProvider interface (spec section 62)."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    published_date: Optional[str] = None
    source_domain: str = field(default="")

    def __post_init__(self):
        if not self.source_domain and self.url:
            from urllib.parse import urlparse
            self.source_domain = urlparse(self.url).netloc


class SearchProvider(ABC):
    @abstractmethod
    def search(self, query: str, country: Optional[str] = None,
               language: str = "en", date_from: Optional[datetime] = None
               ) -> list[SearchResult]:
        ...

    @abstractmethod
    def fetch(self, url: str) -> str:
        ...

    @abstractmethod
    def download(self, url: str, dest_path: str) -> str:
        ...


class NullSearchProvider(SearchProvider):
    def search(self, query, country=None, language="en", date_from=None):
        return []

    def fetch(self, url):
        return ""

    def download(self, url, dest_path):
        return dest_path


class ManualSearchProvider(SearchProvider):
    """Accepts results injected by an external caller."""
    def __init__(self):
        self._injected: dict[str, list[SearchResult]] = {}
        self._pages: dict[str, str] = {}

    def load_results(self, query: str, results: list[SearchResult]):
        self._injected[query] = results

    def load_page(self, url: str, text: str):
        self._pages[url] = text

    def search(self, query, country=None, language="en", date_from=None):
        return self._injected.get(query, [])

    def fetch(self, url):
        return self._pages.get(url, "")

    def download(self, url, dest_path):
        raise NotImplementedError("ManualSearchProvider cannot download binaries.")
