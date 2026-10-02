"""
Tender analysis — what a bidder must meet, for the opportunity pages.

  1. Award criteria (no LLM): type and weight straight from the notice's
     eForms XML, e.g. price 30 % / quality 50 % / quality 20 %.
  2. Requirements (Tender Analysis agent): the notice's selection criteria
     and tenderer requirements turned into English requirement rows —
     category, mandatory, threshold, evidence — each matched against the
     company brief (webapp/agents/company_brief.md), plus English
     descriptions of the award criteria.
"""
import json
import os
import re
import sys
import uuid

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.llm_client import call_llm_json_premium, load_prompt  # noqa: E402

_ROOT = os.path.join(os.path.dirname(__file__), "..")
CATEGORIES = {"LEGAL", "FINANCIAL", "TURNOVER", "INSURANCE", "CERTIFICATION", "COMPANY_EXPERIENCE", "REFERENCE",
              "TEAM", "CV", "EDUCATION", "PERSONAL_CERTIFICATION", "SECURITY_CLEARANCE", "LANGUAGE", "FTE",
              "LOCAL_PRESENCE", "TECHNICAL", "SECURITY", "PRIVACY", "EIDAS", "EUDI", "INTEROPERABILITY", "HOSTING",
              "SLA", "IMPLEMENTATION", "CONSORTIUM", "SUBCONTRACTING", "EVIDENCE"}
MATCHES = {"MATCH", "PARTIAL_MATCH", "PARTNER_NEEDED", "NO_MATCH", "UNKNOWN"}


def _clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def notice_criteria(xml: str) -> dict:
    """Selection criteria, tenderer requirements and award criteria from eForms XML."""
    selection = [_clean(d) for b in re.findall(r"<efac:SelectionCriteria>(.*?)</efac:SelectionCriteria>", xml, re.S)
                 for d in re.findall(r"<cbc:Description[^>]*>(.*?)</cbc:Description>", b, re.S)]
    tenderer = [_clean(d) for b in re.findall(r"<cac:SpecificTendererRequirement>(.*?)</cac:SpecificTendererRequirement>", xml, re.S)
                for d in re.findall(r"<cbc:Description[^>]*>(.*?)</cbc:Description>", b, re.S)]
    award = []
    for b in re.findall(r"<cac:SubordinateAwardingCriterion>(.*?)</cac:SubordinateAwardingCriterion>", xml, re.S):
        kind = re.search(r"<cbc:AwardingCriterionTypeCode[^>]*>([^<]+)<", b)
        weight = re.search(r"<efbc:ParameterNumeric>([\d.]+)<", b)
        name = re.search(r"<cbc:Name[^>]*>(.*?)</cbc:Name>", b, re.S)
        desc = re.search(r"<cbc:Description[^>]*>(.*?)</cbc:Description>", b, re.S)
        award.append({"type": kind.group(1) if kind else None, "weight": float(weight.group(1)) if weight else None,
                      "name": _clean(name.group(1)) if name else None, "description": _clean(desc.group(1)) if desc else None})
    dedupe = lambda xs: [x for x in dict.fromkeys(xs) if len(x) > 15]
    return {"selection": dedupe(selection), "tenderer": dedupe(tenderer), "award": award}


def store_award_criteria(session, opportunity_id: str, award: list) -> int:
    """Deterministic part: replace the opportunity's award criteria with the notice's."""
    if not award:
        return 0
    session.execute(text("delete from award_criteria where opportunity_id = :o"), {"o": opportunity_id})
    for a in award:
        label = {"price": "Price", "cost": "Cost", "quality": "Quality"}.get(a["type"] or "", (a["type"] or "Criterion").title())
        session.execute(text("insert into award_criteria (opportunity_id, criterion, weight, subcriteria) values (:o, :c, :w, cast(:s as jsonb))"),
                        {"o": opportunity_id, "c": label, "w": a["weight"],
                         "s": json.dumps({"type": a["type"], "name": a["name"], "description": a["description"]})})
    session.commit()
    return len(award)


def extract_requirements(criteria: dict, documents: list) -> dict:
    with open(os.path.join(_ROOT, "webapp", "agents", "company_brief.md")) as f:
        brief = f.read()
    prompt = load_prompt("tender_requirements.md").replace("{company_brief}", brief)
    listing = "\n".join([
        "Selection criteria:", *[f"- {s[:1500]}" for s in criteria["selection"]],
        "Other tenderer requirements:", *[f"- {s[:1500]}" for s in criteria["tenderer"]],
        "Award criteria:", *[f"- {a['type']} {a['weight']}%: {a['name'] or ''} {a['description'] or ''}" for a in criteria["award"]],
        "Documents:", *[f"- {d}" for d in documents[:60]],
    ])
    return call_llm_json_premium(prompt, listing, max_tokens=8000, effort="medium")


def analyse_tenders(session, errors: list, limit: int = 10) -> dict:
    """Award criteria for every tracked TED notice; requirements (LLM) for active ones without any yet."""
    import requests
    opps = session.execute(text("""select opportunity_id, official_url, status, deadline,
            (select count(*) from requirements r where r.opportunity_id = o.opportunity_id) as reqs
            from opportunities o where official_url like '%ted.europa.eu%'""")).fetchall()
    done = {"award": 0, "requirements": 0}
    llm_budget = limit
    for o in opps:
        pub = o.official_url.rstrip("/").split("/")[-1]
        try:
            xml = requests.get(f"https://ted.europa.eu/en/notice/{pub}/xml", timeout=40).text
        except Exception as e:
            errors.append(f"tender analysis {o.opportunity_id}: {e}"[:200]); continue
        crit = notice_criteria(xml)
        done["award"] += store_award_criteria(session, o.opportunity_id, crit["award"])
        active = o.status in ("OPEN", "SIGNAL")
        if not active or o.reqs or llm_budget <= 0 or not (crit["selection"] or crit["tenderer"]):
            continue
        llm_budget -= 1
        docs = [r.name for r in session.execute(text("select name from documents where opportunity_id = :o"), {"o": o.opportunity_id})]
        try:
            out = extract_requirements(crit, docs)
        except Exception as e:
            errors.append(f"requirements {o.opportunity_id}: {e}"[:300])
            if "credit" in str(e).lower():
                break
            continue
        for r in out.get("requirements") or []:
            cat = (r.get("category") or "").upper()
            if cat not in CATEGORIES or not r.get("text"):
                continue
            rid = f"{o.opportunity_id}-{uuid.uuid4().hex[:8]}"
            session.execute(text("""insert into requirements (requirement_id, opportunity_id, category, requirement_text,
                    mandatory, threshold, evidence_required, source_url, confidence)
                    values (:id, :o, :c, :t, :m, :th, :ev, :u, 'INFERRED')"""),
                            {"id": rid, "o": o.opportunity_id, "c": cat, "t": r["text"][:2000], "m": bool(r.get("mandatory", True)),
                             "th": (r.get("threshold") or None), "ev": (r.get("evidence") or None), "u": o.official_url})
            m = (r.get("match") or "UNKNOWN").upper()
            session.execute(text("""insert into requirement_matches (requirement_id, match_status, notes)
                    values (:id, cast(:m as matchstatus), :n)"""), {"id": rid, "m": m if m in MATCHES else "UNKNOWN", "n": r.get("match_note")})
        for a in out.get("award_criteria") or []:
            if a.get("criterion"):
                session.execute(text("""update award_criteria set subcriteria = subcriteria || cast(:s as jsonb)
                        where opportunity_id = :o and weight is not distinct from :w"""),
                                {"s": json.dumps({"name_en": a["criterion"], "description_en": a.get("description")}),
                                 "o": o.opportunity_id, "w": float(a["weight"]) if a.get("weight") is not None else None})
        session.commit()
        done["requirements"] += 1
    return done
