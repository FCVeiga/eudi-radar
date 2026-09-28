"""Load config/*.yaml into the database. Idempotent: re-running upserts."""
import os
import yaml
from datetime import datetime

from models import (
    init_db, get_session, Country, Source, Programme, SourceType, SourceStatus
)

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")


def _load(name):
    with open(os.path.join(CONFIG_DIR, name)) as f:
        return yaml.safe_load(f)


def seed_countries(session):
    data = _load("countries.yaml")
    updated, created = 0, 0
    for c in data["countries"]:
        existing = session.get(Country, c["code"])
        if existing:
            existing.eudi_wallet_authority = c.get("eudi_wallet_authority")
            existing.wallet_name = c.get("wallet_name")
            existing.wallet_status_raw = c.get("wallet_status_raw")
            existing.assurance_level = c.get("assurance_level")
            existing.launch_date = c.get("launch_date")
            existing.official_url = c.get("official_url")
            existing.country_url = c.get("country_url")
            existing.status_source = c.get("status_source")
            existing.status_code = c.get("status_code", existing.status_code)
            existing.national_procurement_portal = c.get("national_procurement_portal")
            updated += 1
            continue
        session.add(Country(
            code=c["code"],
            name=c["name"],
            status_code=c.get("status_code", 0),
            eudi_wallet_authority=c.get("eudi_wallet_authority"),
            wallet_name=c.get("wallet_name"),
            wallet_status_raw=c.get("wallet_status_raw"),
            assurance_level=c.get("assurance_level"),
            launch_date=c.get("launch_date"),
            official_url=c.get("official_url"),
            country_url=c.get("country_url"),
            status_source=c.get("status_source"),
            national_procurement_portal=c.get("national_procurement_portal"),
        ))
        created += 1
    session.commit()
    print(f"Seeded {created} new countries, updated {updated} existing.")


def seed_sources(session):
    data = _load("sources.yaml")
    count = 0
    sid = 1
    for tier, items in data["eu_sources"].items():
        for s in items:
            source_id = f"EU-{sid:03d}"
            if session.get(Source, source_id):
                sid += 1
                continue
            session.add(Source(
                source_id=source_id,
                name=s["name"],
                source_type=SourceType(s["source_type"]),
                url=s.get("url"),
                api_available=s.get("api_available", False),
                priority=s.get("priority", 3),
                status=SourceStatus.ACTIVE,
            ))
            sid += 1
            count += 1
    for s in data["international_sources"]:
        source_id = f"INTL-{sid:03d}"
        if not session.get(Source, source_id):
            session.add(Source(
                source_id=source_id,
                name=s["name"],
                source_type=SourceType(s["source_type"]),
                url=s.get("url"),
                priority=s.get("priority", 3),
                status=SourceStatus.ACTIVE,
            ))
            count += 1
        sid += 1
    session.commit()
    print(f"Seeded {count} sources.")


def seed_programmes(session):
    data = _load("sources.yaml")
    count = 0
    for p in data["lsp_tracker_seed"]:
        pid = p["programme"].replace(" ", "_").upper()
        if session.get(Programme, pid):
            continue
        session.add(Programme(programme_id=pid, name=p["programme"]))
        count += 1
    session.commit()
    print(f"Seeded {count} programme placeholders.")


def seed_tracked_accounts(session):
    """Syncs config/tracked_accounts.yaml into the tracked_accounts table
    (added for the real News page — this table didn't exist before)."""
    from models import TrackedAccount
    data = _load("tracked_accounts.yaml")
    count = 0
    for a in data.get("accounts", []):
        handle_or_url = a.get("handle") or a.get("profile_url", "")
        exists = session.query(TrackedAccount).filter_by(
            platform=a["platform"], handle_or_url=handle_or_url
        ).first()
        if exists:
            continue
        session.add(TrackedAccount(
            platform=a["platform"],
            handle_or_url=handle_or_url,
            display_name=a.get("display_name", ""),
            category=a.get("category", ""),
            active=a.get("active", False),
        ))
        count += 1
    session.commit()
    print(f"Seeded {count} tracked accounts.")


if __name__ == "__main__":
    engine = init_db()
    session = get_session(engine)
    seed_countries(session)
    seed_sources(session)
    seed_programmes(session)
    seed_tracked_accounts(session)
    session.close()
    print("Seed complete.")
