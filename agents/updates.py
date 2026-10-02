"""
Update notes: what a TED change notice says it changed, kept with the
change event (original language) so an English note can be written from it
and shown as a comment under the opportunity.
"""


def note_source(changes) -> str:
    """Compose TED's change block (adapters.ted.notice_changes) into one text."""
    if not changes:
        return None
    parts = []
    if changes.get("reason_text") or changes.get("reason"):
        parts.append(f"Reason: {changes.get('reason_text') or changes.get('reason')}")
    if changes.get("changes"):
        parts.append(f"Changes: {changes['changes']}")
    if changes.get("documents_changed"):
        parts.append("The procurement documents were updated.")
    return " ".join(parts) or None


def fallback_description(changes) -> str:
    """Short English label for a change notice that didn't move the deadline."""
    if changes and changes.get("documents_changed"):
        return "Tender documents updated"
    reason = (changes or {}).get("reason")
    return f"Notice updated: {reason}" if reason else "Notice updated"
