"""
Agent 4 — Pipeline Intelligence. Detects procurements BEFORE publication
by tracking national rollout status transitions (spec sections 30-36).
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "database"))
from models import RolloutState, Country  # noqa: E402

PRECURSOR_SIGNALS = [
    "budget allocation", "RFI", "market consultation", "PIN",
    "technical dialogue", "supplier day", "new project office",
    "government implementation contract announcement",
    "publication of architecture", "certification procurement",
    "job postings for wallet programme", "parliamentary budget",
    "EU funding award", "consultancy contract",
    "system integrator engagement", "pilot announcement",
]

STATUS_TRANSITION_HORIZON = {
    (2, 3): ("6-12 months", "MEDIUM"),
    (3, 4): ("3-9 months", "MEDIUM"),
    (4, 5): ("1-6 months", "HIGH"),
    (5, 6): ("0-3 months", "HIGH"),
}


def record_status_transition(session, country_code: str, new_status_code: int,
                              evidence_note: str):
    country = session.get(Country, country_code)
    previous_status = country.status_code if country else 0

    state = RolloutState(country_code=country_code, status_code=new_status_code,
                          last_material_update=datetime.utcnow())
    session.add(state)
    if country:
        country.status_code = new_status_code
        country.last_verified = datetime.utcnow()
    session.commit()

    signal = None
    horizon = STATUS_TRANSITION_HORIZON.get((previous_status, new_status_code))
    if horizon:
        signal = {
            "country": country_code,
            "status_transition": f"{previous_status} -> {new_status_code}",
            "signal": evidence_note, "horizon": horizon[0], "confidence": horizon[1],
            "action": "Identify wallet authority and local SI/consortium partners.",
        }
    return state, signal
