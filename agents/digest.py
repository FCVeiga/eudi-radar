"""
Agent 8 — Daily Digest. Coverage-first report format (spec sections 50-58).
"""
from dataclasses import dataclass, field
from datetime import date


@dataclass
class CoverageStats:
    countries_checked: int
    countries_total: int
    sources_checked: int
    sources_total: int
    queries_executed: int
    candidates_found: int
    deep_analyses_executed: int
    new_opportunities: int
    material_updates: int
    errors: list = field(default_factory=list)

    def coverage_pct(self) -> float:
        if self.sources_total == 0:
            return 0.0
        return round(100 * self.sources_checked / self.sources_total, 1)


def render_daily_digest(run_date: date, coverage: CoverageStats,
                         new_opportunities: list, rollout_changes: list,
                         early_signals: list, existing_updates: list) -> str:
    lines = []
    lines.append("# EUDI WALLET GLOBAL OPPORTUNITY RADAR")
    lines.append(f"\nDate: {run_date.isoformat()}\n")

    lines.append("## Coverage")
    lines.append(f"- Countries checked: {coverage.countries_checked}/{coverage.countries_total}")
    lines.append(f"- Sources checked: {coverage.sources_checked}/{coverage.sources_total}")
    lines.append(f"- Queries executed: {coverage.queries_executed}")
    lines.append(f"- Candidates found: {coverage.candidates_found}")
    lines.append(f"- Deep analyses executed: {coverage.deep_analyses_executed}")
    lines.append(f"- New opportunities: {coverage.new_opportunities}")
    lines.append(f"- Material updates: {coverage.material_updates}")
    if coverage.errors:
        lines.append(f"- Errors / inaccessible sources: {len(coverage.errors)}")
        for e in coverage.errors:
            lines.append(f"  - {e}")
    else:
        lines.append("- Errors / inaccessible sources: none")
    lines.append(f"\n**TODAY'S SEARCH COVERAGE: {coverage.coverage_pct()}%**\n")

    lines.append("## Executive Summary")
    if not new_opportunities and not early_signals and not existing_updates:
        lines.append("\nNO MATERIAL NEW EUDI OPPORTUNITIES DETECTED TODAY.\n")
        lines.append(
            f"No material opportunities identified across the "
            f"{coverage.sources_checked} sources successfully checked "
            f"({coverage.coverage_pct()}% of registry).\n"
        )
    else:
        lines.append(f"\n{len(new_opportunities)} new relevant opportunities detected.\n")
        for o in new_opportunities:
            lines.append(f"- [{o['priority']}] {o['country']} — {o['project']}")
        for s in early_signals:
            lines.append(f"- [Early Signal] {s['country']} — {s['signal']}")
        for u in existing_updates:
            lines.append(f"- [Update] {u['opportunity']} — {u['change']}")
        lines.append("")

    if new_opportunities:
        lines.append("## New Opportunities\n")
        for o in new_opportunities:
            lines.append(f"### {o['priority']} — {o['country']} — {o['project']}\n")
            lines.append("| Field | Value |")
            lines.append("|---|---|")
            lines.append(f"| Authority | {o.get('authority', 'UNCLEAR')} |")
            lines.append(f"| Type | {o.get('type', 'UNCLEAR')} |")
            lines.append(f"| Value | {o.get('value', 'NOT_DISCLOSED')} |")
            lines.append(f"| Deadline | {o.get('deadline', 'NOT_DISCLOSED')} |")
            lines.append(f"| Opportunity Score | {o.get('opportunity_score', 'N/A')} |")
            lines.append(f"| Bid Readiness | {o.get('bid_readiness', 'N/A')} |")
            lines.append("")
            for section in ["project", "why_it_matters", "eligibility", "references",
                             "resources", "certifications", "technical_requirements",
                             "consortium", "gaps", "recommended_action", "sources"]:
                if section in o.get("details", {}):
                    title = section.replace("_", " ").title()
                    lines.append(f"**{title}**\n\n{o['details'][section]}\n")

    if early_signals:
        lines.append("## Future Procurement Signals\n")
        for s in early_signals:
            lines.append(f"**{s['country']}**")
            lines.append(f"- Status: {s.get('status_transition', 'N/A')}")
            lines.append(f"- Signal: {s['signal']}")
            lines.append(f"- Estimated procurement horizon: {s.get('horizon', 'UNCLEAR')}")
            lines.append(f"- Confidence: {s.get('confidence', 'UNCLEAR')}")
            lines.append(f"- Recommended action: {s.get('action', 'Monitor.')}\n")

    if rollout_changes:
        lines.append("## Rollout Changes\n")
        lines.append("| Country | Previous | Current | Change |")
        lines.append("|---|---|---|---|")
        for r in rollout_changes:
            lines.append(f"| {r['country']} | {r['previous']} | {r['current']} | {r['change']} |")
        lines.append("")

    if existing_updates:
        lines.append("## Existing Opportunity Updates\n")
        for u in existing_updates:
            lines.append(f"**{u['opportunity']}**")
            lines.append(f"- New: {u['change']}")
            lines.append(f"- Impact: {u.get('impact', 'UNCLEAR')}")
            lines.append(f"- Action: {u.get('action', 'Review.')}\n")

    return "\n".join(lines)
