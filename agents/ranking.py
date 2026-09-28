"""
Agent 7 — Prioritisation. Two independent scores, never combined (spec
section 46): Opportunity Relevance Score + Bid Readiness Score.
"""
from dataclasses import dataclass


@dataclass
class RelevanceInputs:
    eudi_relevance: int
    technology_relevance: int
    contract_attractiveness: int
    accessibility: int
    timing: int
    geographic_importance: int

    def total(self) -> int:
        return (self.eudi_relevance + self.technology_relevance
                + self.contract_attractiveness + self.accessibility
                + self.timing + self.geographic_importance)


@dataclass
class BidReadinessInputs:
    company_references: int
    team: int
    certifications: int
    financial_criteria: int
    technology: int
    local_requirements: int
    consortium_availability: int

    def total(self) -> int:
        return (self.company_references + self.team + self.certifications
                + self.financial_criteria + self.technology
                + self.local_requirements + self.consortium_availability)


def derive_action_priority(opportunity_score: int, bid_readiness: int,
                            deadline_days=None, consortium_formation_open: bool = False,
                            market_consultation_influenceable: bool = False) -> str:
    high_fit = opportunity_score >= 75
    deadline_approaching = deadline_days is not None and deadline_days <= 21
    if (high_fit and deadline_approaching) or consortium_formation_open \
            or market_consultation_influenceable:
        return "P0_IMMEDIATE_ACTION"
    if opportunity_score >= 75:
        return "P1_HIGH_PRIORITY"
    if opportunity_score >= 60:
        return "P2_REVIEW"
    if opportunity_score >= 40:
        return "P3_WATCH"
    return "P4_ARCHIVE"


def score_summary_line(opportunity_score: int, bid_readiness: int) -> str:
    if opportunity_score >= 85 and bid_readiness < 60:
        return "EXCELLENT OPPORTUNITY — PARTNERING ACTION REQUIRED."
    if opportunity_score >= 75 and bid_readiness >= 75:
        return "STRONG OPPORTUNITY — READY TO BID."
    if opportunity_score < 50:
        return "LOW STRATEGIC PRIORITY."
    return "MODERATE OPPORTUNITY — REVIEW REQUIREMENTS."
