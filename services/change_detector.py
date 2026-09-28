"""Snapshot diffing for Agent 6 (spec sections 43-45)."""
from dataclasses import dataclass


@dataclass
class ChangeClassificationRule:
    field: str
    importance: str
    label: str


IMPORTANCE_RULES = [
    ChangeClassificationRule("deadline", "MATERIAL", "Deadline changed"),
    ChangeClassificationRule("minimum_turnover_requirement", "CRITICAL", "New minimum turnover requirement"),
    ChangeClassificationRule("formatting_only", "MINOR", "Formatting correction"),
    ChangeClassificationRule("reference_definition", "CRITICAL", "Clarification redefining required references"),
    ChangeClassificationRule("status", "MATERIAL", "Status changed"),
    ChangeClassificationRule("award_criterion", "CRITICAL", "Award criterion changed"),
    ChangeClassificationRule("selection_criterion", "CRITICAL", "Selection criterion changed"),
    ChangeClassificationRule("document_added", "MATERIAL", "New document published"),
    ChangeClassificationRule("procedure_cancelled", "CRITICAL", "Procedure cancelled"),
    ChangeClassificationRule("award_announced", "CRITICAL", "Award announced"),
    ChangeClassificationRule("new_lot", "MATERIAL", "New lot added"),
]
_RULES_BY_FIELD = {r.field: r for r in IMPORTANCE_RULES}


def diff_snapshots(old: dict, new: dict) -> list[dict]:
    events = []
    if old.get("deadline") != new.get("deadline"):
        events.append(_event("deadline", old.get("deadline"), new.get("deadline")))
    if old.get("status") != new.get("status"):
        events.append(_event("status", old.get("status"), new.get("status")))
    if old.get("value") != new.get("value"):
        events.append(_event("budget_changed", old.get("value"), new.get("value")))
    old_hashes = set(old.get("document_hashes", []))
    new_hashes = set(new.get("document_hashes", []))
    if new_hashes - old_hashes:
        events.append(_event("document_added", f"{len(old_hashes)} docs", f"{len(new_hashes)} docs"))
    elif old_hashes and new_hashes and old_hashes != new_hashes:
        events.append(_event("document_modified", "hash changed", "hash changed"))
    if old.get("requirements_hash") != new.get("requirements_hash"):
        events.append(_event("selection_criterion", "prior requirements", "requirements changed — re-run extraction"))
    return events


def _event(field: str, old_value, new_value) -> dict:
    rule = _RULES_BY_FIELD.get(field)
    importance = rule.importance if rule else "MINOR"
    label = rule.label if rule else field
    return {"event_type": field, "importance": importance,
            "description": f"{label}: '{old_value}' -> '{new_value}'"}
