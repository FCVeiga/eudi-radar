"""
Tavily search adapter — real implementation of the SearchProvider
interface for the Discovery agent's general web search fallback.
Requires TAVILY_API_KEY and the `tavily-python` package.
"""
import os
from datetime import datetime
from typing import Optional

from .web_search import SearchProvider, SearchResult

try:
    from tavily import TavilyClient
except ImportError:
    TavilyClient = None


class TavilySearchProvider(SearchProvider):
    def __init__(self, api_key: Optional[str] = None):
        if TavilyClient is None:
            raise ImportError(
                "The 'tavily-python' package is not installed. Run: "
                "pip install tavily-python --break-system-packages"
            )
        self.api_key = api_key or os.environ.get("TAVILY_API_KEY")
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY environment variable is not set.")
        self.client = TavilyClient(api_key=self.api_key)

    def search(self, query: str, country: Optional[str] = None,
               language: str = "en", date_from: Optional[datetime] = None
               ) -> list[SearchResult]:
        effective_query = query
        if country:
            effective_query = f"{query} {country}"
        response = self.client.search(query=effective_query, search_depth="basic", max_results=10)
        results = []
        for item in response.get("results", []):
            results.append(SearchResult(
                title=item.get("title", ""), url=item.get("url", ""),
                snippet=item.get("content", ""),
                published_date=item.get("published_date"),
            ))
        return results

    def fetch(self, url: str) -> str:
        response = self.client.extract(urls=[url])
        results = response.get("results", [])
        if results:
            return results[0].get("raw_content", "")
        return ""

    def download(self, url: str, dest_path: str) -> str:
        import requests
        resp = requests.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return dest_path
