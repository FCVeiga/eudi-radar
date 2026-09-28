"""
Agent 5 — Bid Match Engine / Consortium Gap Analysis (spec sections 37-40).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import Requirement, RequirementMatch, MatchStatus  # noqa: E402

MISSING_COMPETENCY_TYPES = [
    "LOCAL_PARTNER", "SYSTEM_INTEGRATOR", "QTSP", "CYBERSECURITY",
    "CERTIFICATION", "CLOUD", "PROJECT_MANAGEMENT", "LEGAL", "MOBILE",
    "HSM", "PUBLIC_SECTOR_REFERENCE", "LARGE_SCALE_REFERENCE",
]


def match_requirement(session, requirement: Requirement, company_profile: dict,
                       status: str, evidence: str = "", notes: str = "") -> RequirementMatch:
    match = RequirementMatch(requirement_id=requirement.requirement_id,
                              match_status=MatchStatus(status),
                              matched_evidence=evidence, notes=notes)
    session.add(match)
    session.commit()
    return match


def consortium_gap_summary(matches: list) -> dict:
    partner_needed = [m for m in matches if m.match_status == MatchStatus.PARTNER_NEEDED]
    no_match = [m for m in matches if m.match_status == MatchStatus.NO_MATCH]
    can_bid_alone = "NO" if (partner_needed or no_match) else "YES"
    commercially_advisable = "YES" if partner_needed else "NO"
    return {
        "can_bid_alone": can_bid_alone,
        "consortium_legally_permitted": "UNCLEAR",
        "consortium_commercially_advisable": commercially_advisable,
        "missing_competencies": [m.notes for m in partner_needed],
        "unmatched_requirement_ids": [m.requirement_id for m in no_match],
    }
