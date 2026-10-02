"""
Settings page → pipeline. Read once at the start of a run (load()):

  - which agents are switched on (agent_settings.enabled)
  - each agent's fine-tuned prompt, if the Config Agent wrote one
    (agent_settings.prompt_override), used in place of the file in prompts/
  - the search scope's parsed config (app_settings 'search'): TED phrases,
    web and news queries, the site-search query and triage's relevance rules
  - the company name the prompts address ({company_name})

load() also copies every agent's default prompt into agent_settings, so the
Settings page can show it ("Open config") without access to the repo.
Without a database row, everything falls back to the built-in defaults.
"""
import os
import re

from sqlalchemy import text

_ROOT = os.path.join(os.path.dirname(__file__), "..")
# Agent key -> its prompt file (repo-relative). Keys match webapp/lib/agents.ts.
AGENT_PROMPTS = {
    "triage": "prompts/triage.md",
    "verification": "prompts/verification.md",
    "tender_analysis": "prompts/tender_requirements.md",
    "feed_writer": "prompts/feed_post.md",
    "translator": "prompts/translation.md",
    "tender_evaluation": "webapp/agents/tender_evaluation.md",
    "news_report": "webapp/agents/news_report.md",
}
ALL_AGENTS = ["search", "triage", "verification", "tender_documents", "tender_analysis",
              "tender_evaluation", "news_report", "feed_writer", "translator"]
DEFAULT_COMPANY = "WalliD"

_state = {"loaded": False, "enabled": {}, "overrides": {}, "search": None, "company": DEFAULT_COMPANY}


def load(session) -> None:
    """Read the settings and sync the default prompts. Safe to call when the tables don't exist yet."""
    try:
        for key in ALL_AGENTS:
            path = AGENT_PROMPTS.get(key)
            default = open(os.path.join(_ROOT, path)).read() if path else None
            session.execute(text("""insert into agent_settings (agent_key, default_prompt) values (:k, :p)
                    on conflict (agent_key) do update set default_prompt = excluded.default_prompt"""), {"k": key, "p": default})
        session.commit()
        rows = session.execute(text("select agent_key, enabled, prompt_override from agent_settings")).fetchall()
        _state["enabled"] = {r.agent_key: bool(r.enabled) for r in rows}
        _state["overrides"] = {r.agent_key: r.prompt_override for r in rows if r.prompt_override}
        settings = dict(session.execute(text("select key, value from app_settings")).fetchall())
        _state["search"] = (settings.get("search") or {}).get("config") or None
        _state["company"] = ((settings.get("company") or {}).get("name") or "").strip() or DEFAULT_COMPANY
    except Exception as e:  # missing tables (migration 015 not applied): run on defaults
        session.rollback()
        print(f"Settings: using defaults ({str(e)[:120]})")
    _state["loaded"] = True


def enabled(agent_key: str) -> bool:
    return _state["enabled"].get(agent_key, True)


def company_name() -> str:
    return _state["company"]


def search_config() -> dict:
    """The parsed search scope, or {} to use the built-in EUDI defaults."""
    return _state["search"] or {}


def prompt_for(prompt_filename: str, default: str) -> str:
    """The agent's fine-tuned prompt if there is one, with the search scope's
    relevance rules and the company name filled in."""
    key = next((k for k, p in AGENT_PROMPTS.items() if p.endswith("/" + prompt_filename)), None)
    prompt = _state["overrides"].get(key) or default
    cfg = search_config()
    for marker, field in (("scope", "relevance_rubric"), ("importance", "importance_rubric")):
        if cfg.get(field):
            prompt = re.sub(rf"<!-- {marker} -->.*?<!-- /{marker} -->",
                            lambda _m: f"<!-- {marker} -->\n{cfg[field].strip()}\n<!-- /{marker} -->", prompt, flags=re.S)
    if cfg.get("topic"):
        prompt = prompt.replace("{topic}", cfg["topic"])
    return prompt.replace("{topic}", "EUDI Wallet").replace("{company_name}", company_name())
