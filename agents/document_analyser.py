"""
Agent 3 — Deep Analysis. Triggered when candidate.relevance >= 60.
Downloads and classifies official documents (spec sections 20-22, 66).
"""
import hashlib
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import Document, DocumentType, Opportunity  # noqa: E402

STORAGE_ROOT = os.path.join(os.path.dirname(__file__), "..", "storage", "opportunities")


def _hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def opportunity_storage_dir(opportunity_id: str) -> str:
    path = os.path.join(STORAGE_ROOT, opportunity_id)
    os.makedirs(path, exist_ok=True)
    return path


def register_document(session, opportunity: Opportunity, name: str,
                       document_type: str, url: str, local_path: str) -> Document:
    doc_id = f"{opportunity.opportunity_id}-{hashlib.md5(url.encode()).hexdigest()[:8]}"
    doc = Document(
        document_id=doc_id, opportunity_id=opportunity.opportunity_id,
        name=name, document_type=DocumentType(document_type), url=url,
        storage_path=local_path,
        hash=_hash_file(local_path) if os.path.exists(local_path) else None,
        downloaded_at=datetime.utcnow(),
    )
    session.add(doc)
    session.commit()
    return doc


def has_document_changed(session, document: Document, new_local_path: str) -> bool:
    return _hash_file(new_local_path) != document.hash
