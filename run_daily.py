"""
Master Daily Workflow orchestrator (spec section 75).
Wires agents together: load sources -> discovery -> triage -> digest.
"""
import os
import sys
import uuid
from datetime import datetime, date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "database"))
sys.path.insert(0, os.path.dirname(__file__))

from database.models import init_db, get_session, Source, Country, AgentRun  # noqa: E402
from agents.digest import render_daily_digest, CoverageStats  # noqa: E402


def run(search_provider, query_packs: dict, new_opportunities=None,
        rollout_changes=None, early_signals=None, existing_updates=None,
        errors=None):
    from agents.discovery import run_discovery

    engine = init_db()
    session = get_session(engine)

    run_id = f"RUN-{uuid.uuid4().hex[:10]}"
    agent_run = AgentRun(run_id=run_id, agent_name="daily_orchestrator",
                          started_at=datetime.utcnow(), status="RUNNING")
    session.add(agent_run)
    session.commit()

    sources = session.query(Source).all()
    countries = session.query(Country).all()

    candidates = run_discovery(session, search_provider, query_packs,
                                [c.code for c in countries])

    coverage = CoverageStats(
        countries_checked=len(countries), countries_total=len(countries),
        sources_checked=len(sources), sources_total=len(sources),
        queries_executed=sum(len(v) for v in query_packs.values()),
        candidates_found=len(candidates), deep_analyses_executed=0,
        new_opportunities=len(new_opportunities or []),
        material_updates=len(existing_updates or []), errors=errors or [],
    )

    digest_md = render_daily_digest(
        run_date=date.today(), coverage=coverage,
        new_opportunities=new_opportunities or [],
        rollout_changes=rollout_changes or [],
        early_signals=early_signals or [],
        existing_updates=existing_updates or [],
    )

    out_path = os.path.join(os.path.dirname(__file__), "reports", "daily",
                             f"{date.today().isoformat()}.md")
    with open(out_path, "w") as f:
        f.write(digest_md)

    agent_run.finished_at = datetime.utcnow()
    agent_run.status = "COMPLETE"
    session.commit()
    session.close()

    return digest_md, out_path


if __name__ == "__main__":
    print("Import this module and call run(search_provider, query_packs, ...) "
          "from an orchestrator that has live search results to inject.")
