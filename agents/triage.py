"""
Agent 2 — Triage.

Scores each raw Candidate for relevance and decides whether it warrants
Agent 3 (deep document analysis). This is the cheap-model stage (spec
section 64) — classification only, no requirement extraction here.
"""
import sys
import os
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models import Candidate  # noqa: E402
from services.llm_client import call_llm_json, load_prompt, CHEAP_MODEL  # noqa: E402

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")

with open(os.path.join(CONFIG_DIR, "keywords.yaml")) as f:
    _KEYWORDS = yaml.safe_load(f)

_SUPPRESS_TERMS = [t.lower() for t in _KEYWORDS["false_positive_filter"]["suppress"]]

_DEEP_ANALYSIS_THRESHOLD = 60

_TRIAGE_SYSTEM_PROMPT = None


def _get_triage_prompt() -> str:
    global _TRIAGE_SYSTEM_PROMPT
    if _TRIAGE_SYSTEM_PROMPT is None:
        _TRIAGE_SYSTEM_PROMPT = load_prompt("triage.md")
    return _TRIAGE_SYSTEM_PROMPT


def heuristic_prefilter(candidate: Candidate) -> bool:
    text = f"{candidate.title or ''} {candidate.description or ''}".lower()
    return not any(term in text for term in _SUPPRESS_TERMS)


def run_triage_llm(candidate: Candidate) -> dict:
    """Real LLM call — sends the candidate to the cheap model against
    prompts/triage.md, returns the parsed JSON output (spec section 17)."""
    user_content = (
        f"Title: {candidate.title or 'N/A'}\n"
        f"Description: {candidate.description or 'N/A'}\n"
        f"Source URL: {candidate.source_url or 'N/A'}\n"
        f"Country: {candidate.country or 'unknown'}\n"
        f"Discovery query: {candidate.discovery_query or 'N/A'}\n"
    )
    return call_llm_json(
        system_prompt=_get_triage_prompt(), user_content=user_content,
        model=CHEAP_MODEL, max_tokens=1024,
    )


def apply_triage_result(session, candidate: Candidate, triage_output: dict):
    candidate.relevance = triage_output.get("relevance", 0)
    candidate.opportunity_probability = triage_output.get("opportunity_probability", 0.0)
    candidate.eudi_relevance = triage_output.get("eudi_relevance", "")
    candidate.commercial_relevance = triage_output.get("commercial_relevance", "")
    candidate.candidate_type = triage_output.get("type", "")
    candidate.triage_reason = triage_output.get("reason", "")
    candidate.deep_analysis_required = (
        triage_output.get("deep_analysis_required")
        or candidate.relevance >= _DEEP_ANALYSIS_THRESHOLD
    )
    candidate.processed = True
    session.commit()
    return candidate


def triage_candidate(session, candidate: Candidate) -> Candidate:
    """Convenience wrapper: prefilter -> LLM call -> persist, in one step."""
    if not heuristic_prefilter(candidate):
        return apply_triage_result(session, candidate, {
            "relevance": 0, "opportunity_probability": 0.0,
            "eudi_relevance": "NONE", "commercial_relevance": "NONE",
            "type": "FALSE_POSITIVE",
            "reason": "Matched automatic suppression term list.",
            "deep_analysis_required": False,
        })
    result = run_triage_llm(candidate)
    return apply_triage_result(session, candidate, result)
