"""Weekly Source Discovery Agent (spec section 7)."""
import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import Source, SourceType, SourceStatus  # noqa: E402

DISCOVERY_QUERY_TEMPLATES = [
    '"{country}" EUDI wallet authority',
    '"{country}" digital identity authority',
    '"{country}" national wallet project',
    '"{country}" EUDI implementation',
    '"{country}" wallet procurement',
    '"{country}" digital government agency',
]


def build_country_queries(country_name: str) -> list[str]:
    return [t.format(country=country_name) for t in DISCOVERY_QUERY_TEMPLATES]


def register_source(session, name: str, source_type: str, url: str,
                     country: str = None, priority: int = 3) -> Source:
    source_id = f"SRC-{uuid.uuid4().hex[:8]}"
    source = Source(source_id=source_id, name=name, source_type=SourceType(source_type),
                     url=url, country=country, priority=priority, status=SourceStatus.ACTIVE)
    session.add(source)
    session.commit()
    return source
