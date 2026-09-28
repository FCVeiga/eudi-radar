"""Canonical opportunity fingerprinting (spec section 42)."""
import hashlib
import re


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def fingerprint(country: str, authority: str, reference, title: str) -> str:
    if reference:
        key = f"{_normalise(country)}|{_normalise(reference)}"
    else:
        key = f"{_normalise(country)}|{_normalise(authority)}|{_normalise(title)}"
    return hashlib.sha256(key.encode()).hexdigest()[:20]


def likely_duplicate(a_reference, b_reference, a_title: str, b_title: str,
                      title_similarity_fn=None) -> bool:
    if a_reference and b_reference:
        return _normalise(a_reference) == _normalise(b_reference)
    if title_similarity_fn:
        return title_similarity_fn(a_title, b_title) > 0.85
    return _normalise(a_title) == _normalise(b_title)
