"""
Requirements extraction + validation (spec sections 23-29, 67-68).

Hard rules enforced at the persistence layer:
  - every requirement needs category + evidence fields before it can be
    marked CONFIRMED (hallucination protection, section 68)
  - team/reference/financial requirements are individual rows
  - award criteria never mixed with eligibility requirements (section 28)
"""
import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models import (  # noqa: E402
    Requirement, TeamRequirement, ReferenceRequirement, AwardCriterion,
    ConfidenceLevel, REQUIREMENT_CATEGORIES
)
from services.llm_client import call_llm_json, load_prompt, STRONG_MODEL  # noqa: E402

VALIDATION_TRIGGER_TERMS = [
    "shall", "must", "minimum", "at least", "required", "mandatory",
    "economic capacity", "technical capacity", "professional capacity",
    "experience", "certificate", "cv", "expert", "reference", "turnover",
    "insurance", "exclusion", "eligibility",
]

_REQUIREMENTS_SYSTEM_PROMPT = None


def _get_requirements_prompt() -> str:
    global _REQUIREMENTS_SYSTEM_PROMPT
    if _REQUIREMENTS_SYSTEM_PROMPT is None:
        _REQUIREMENTS_SYSTEM_PROMPT = load_prompt("requirements.md")
    return _REQUIREMENTS_SYSTEM_PROMPT


def extract_requirements_llm(document_text: str, document_name: str = "") -> dict:
    """Real LLM call (Pass 1 extraction, spec section 67), strong model
    since this is document analysis, not cheap classification."""
    user_content = (
        f"Document: {document_name or '(untitled)'}\n\n"
        f"--- DOCUMENT TEXT ---\n{document_text}\n--- END DOCUMENT TEXT ---\n\n"
        "Extract all requirements per the categories and rules in your "
        "system prompt. Return JSON only."
    )
    return call_llm_json(
        system_prompt=_get_requirements_prompt(), user_content=user_content,
        model=STRONG_MODEL, max_tokens=8192,
    )


def run_requirements_validation(document_text: str, pass1_result: dict,
                                 document_name: str = "") -> dict:
    """Pass 2 — mandatory validation call (spec section 67)."""
    user_content = (
        f"Document: {document_name or '(untitled)'}\n\n"
        f"--- DOCUMENT TEXT ---\n{document_text}\n--- END DOCUMENT TEXT ---\n\n"
        f"--- PASS 1 EXTRACTION (for reference — find what's MISSING) ---\n"
        f"{pass1_result}\n--- END PASS 1 ---\n\n"
        "Run the Pass 2 validation described in your system prompt: find "
        "any mandatory requirement Pass 1 missed. Return JSON only, "
        "same shape as Pass 1, containing ONLY newly-found items."
    )
    return call_llm_json(
        system_prompt=_get_requirements_prompt(), user_content=user_content,
        model=STRONG_MODEL, max_tokens=4096,
    )


class EvidenceMissingError(ValueError):
    pass


def add_requirement(session, opportunity_id: str, category: str, text: str,
                     mandatory: bool, document: str = None, section_ref: str = None,
                     page: int = None, source_url: str = None,
                     confidence: str = "UNCLEAR", **extra) -> Requirement:
    if category not in REQUIREMENT_CATEGORIES:
        raise ValueError(f"Unknown requirement category: {category}")

    if confidence == "CONFIRMED" and not (document and (section_ref or page)):
        raise EvidenceMissingError(
            "Cannot mark CONFIRMED without a document + section/page reference. "
            "Use INFERRED or UNCLEAR instead."
        )

    req = Requirement(
        requirement_id=f"REQ-{uuid.uuid4().hex[:10]}",
        opportunity_id=opportunity_id, category=category,
        subcategory=extra.get("subcategory", ""), requirement_text=text,
        mandatory=mandatory, threshold=extra.get("threshold", ""),
        applies_to=extra.get("applies_to", ""),
        evidence_required=extra.get("evidence_required", ""),
        phase=extra.get("phase", ""), document=document, section=section_ref,
        page=page, source_url=source_url, confidence=ConfidenceLevel(confidence),
    )
    session.add(req)
    session.commit()
    return req


def add_team_requirement(session, opportunity_id: str, role: str, **fields) -> TeamRequirement:
    tr = TeamRequirement(opportunity_id=opportunity_id, role=role, **fields)
    session.add(tr)
    session.commit()
    return tr


def add_reference_requirement(session, opportunity_id: str, **fields) -> ReferenceRequirement:
    rr = ReferenceRequirement(opportunity_id=opportunity_id, **fields)
    session.add(rr)
    session.commit()
    return rr


def add_award_criterion(session, opportunity_id: str, criterion: str,
                         weight: float, subcriteria: list = None) -> AwardCriterion:
    ac = AwardCriterion(opportunity_id=opportunity_id, criterion=criterion,
                         weight=weight, subcriteria=subcriteria or [])
    session.add(ac)
    session.commit()
    return ac
