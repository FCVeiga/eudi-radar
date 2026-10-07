"""
Generic scopes (search_config.mode == "generic") — the "General" default scope.

Not tied to an industry: it publishes the most significant tenders and news
on any subject. Relevance is computed here from structured signals, with no
LLM, so it works at any volume and costs nothing per item:

Tenders (TED contract notices published in the last few days):
  - value       — bigger contracts matter more (log scale, in EUR)
  - buyer       — EU institutions and central government above regional and
                  local buyers; central purchasing bodies (frameworks many
                  suppliers bid on) get a bonus
  - audience    — markets with many potential bidders (IT, consulting,
                  construction, health, …) and multi-lot procedures
  - time left   — open long enough to act on

News (Tavily news search on broad queries):
  - source      — reputable outlets above unknown sites
  - coverage    — the same story reported by several outlets
  - freshness   — newer is better

The top items of each run are promoted through run_daily.promote() like any
triaged candidate and recorded in scope_items with their score.
"""
import hashlib
import math
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

from sqlalchemy import text as sql

from database.models import Candidate

TED_API = "https://api.ted.europa.eu/v3/notices/search"
TED_FIELDS = [
    "notice-title", "buyer-name", "buyer-country", "notice-type", "publication-date",
    "deadline-receipt-tender-date-lot", "procedure-identifier", "estimated-value-proc",
    "estimated-value-cur-proc", "buyer-legal-type", "classification-cpv",
]

DEFAULTS = {
    "min_value_eur": 5_000_000,   # smaller contracts are left to industry scopes
    "lookback_days": 4,
    "max_tenders": 25,            # promoted per run
    "min_tender_score": 55,
    "max_news": 15,
    "min_news_score": 40,
    "news_queries": {
        "market": ["largest public contracts awarded Europe", "major government tender launched",
                   "public procurement framework agreement billion"],
        "regulation": ["European Commission adopts regulation", "EU public procurement rules reform",
                       "new EU directive agreed Parliament Council"],
        "industry": ["European company wins government contract", "public sector technology acquisition Europe",
                     "EU funding programme call launched"],
    },
}

# Rough EUR rates for TED currencies (only used to rank by size).
EUR_PER = {"EUR": 1, "SEK": 0.087, "DKK": 0.134, "NOK": 0.085, "PLN": 0.233, "CZK": 0.04, "HUF": 0.0025,
           "RON": 0.2, "BGN": 0.511, "CHF": 1.05, "GBP": 1.17, "ISK": 0.0066, "USD": 0.92}

# eForms buyer-legal-type → reputation points.
BUYER_POINTS = [
    (("eu-ins-bod-ag", "eu-int-org", "int-org"), 20, "EU / international body"),
    (("cga", "pub-undert-cga", "body-pl-cga", "def-cont"), 16, "central government"),
    (("body-pl",), 12, "public-law body"),
    (("ra", "pub-undert-ra", "body-pl-ra"), 10, "regional authority"),
    (("la", "pub-undert-la", "body-pl-la"), 7, "local authority"),
]
CENTRAL_PURCHASING = re.compile(
    r"consip|bundesbeschaffung|\bbbg\b|ugap|statens inkøb|kammarkollegiet|hansel|espap|sgc|"
    r"dg digit|european commission|publications office|nhs supply chain|crown commercial|"
    r"kaufhaus des bundes|beschaffungsamt|centrale d.?achat|plataforma de contratación del sector público",
    re.I)

# CPV division → (audience points, label): markets with many potential bidders score higher.
CPV = {
    "72": (12, "IT services"), "48": (12, "software"), "32": (11, "telecoms"), "30": (10, "computing equipment"),
    "64": (10, "telecom services"), "79": (10, "business services"), "73": (10, "R&D"), "71": (9, "engineering"),
    "45": (9, "construction"), "33": (9, "medical equipment"), "85": (9, "health services"),
    "34": (8, "transport equipment"), "60": (8, "transport services"), "63": (7, "logistics"),
    "09": (8, "energy"), "65": (8, "utilities"), "90": (8, "environmental services"), "66": (8, "financial services"),
    "80": (7, "education"), "50": (6, "maintenance"), "35": (8, "defence & security"), "44": (6, "building materials"),
}

REPUTABLE = {
    40: ("reuters.com", "ft.com", "bloomberg.com", "politico.eu", "euractiv.com", "apnews.com", "bbc.com", "bbc.co.uk",
         "economist.com", "wsj.com", "ec.europa.eu", "europa.eu", "consilium.europa.eu", "europarl.europa.eu"),
    28: ("theguardian.com", "nytimes.com", "lemonde.fr", "spiegel.de", "elpais.com", "corriere.it", "handelsblatt.com",
         "cnbc.com", "techcrunch.com", "theverge.com", "wired.com", "zdnet.com", "computerweekly.com", "devex.com",
         "sifted.eu", "lesechos.fr", "faz.net", "expansion.com", "ilsole24ore.com", "nos.nl", "dw.com",
         "france24.com", "euronews.com", "theregister.com", "publictechnology.net", "govinsider.asia"),
}


def config(scope) -> dict:
    cfg = dict(DEFAULTS)
    cfg.update({k: v for k, v in (scope.search or {}).items() if v not in (None, "", [], {})})
    return cfg


def _cid(url: str, title: str) -> str:
    return hashlib.sha256(f"{url}|{title}".encode()).hexdigest()[:16]


def _pick(value, lang="eng"):
    if not isinstance(value, dict) or not value:
        return value or ""
    v = value.get(lang) or next(iter(value.values()))
    return v[0] if isinstance(v, list) and v else (v or "")


def _deadline(values):
    for v in values or []:
        try:
            return datetime.strptime(str(v)[:10], "%Y-%m-%d")
        except ValueError:
            continue
    return None


# ----------------------------------------------------------------- tenders

def score_tender(n: dict, now: datetime, min_eur: float = 0):
    """(score 0-100, facts) for one TED notice, or None if it doesn't qualify."""
    try:
        raw = float(n.get("estimated-value-proc") or 0)
    except (TypeError, ValueError):
        return None
    currency = (n.get("estimated-value-cur-proc") or "EUR").upper()
    eur = raw * EUR_PER.get(currency, 0)
    deadline = _deadline(n.get("deadline-receipt-tender-date-lot"))
    if not eur or not deadline or eur < min_eur:
        return None
    days_left = (deadline - now).days
    if days_left < 5:
        return None

    value_pts = max(0.0, min(45.0, 25 + 10 * math.log10(eur / 1e6)))  # 1M→25, 10M→35, 100M→45

    legal = (n.get("buyer-legal-type") or [""])[0]
    buyer_pts, buyer_label = 5, "public buyer"
    for types, pts, label in BUYER_POINTS:
        if legal in types:
            buyer_pts, buyer_label = pts, label
            break
    buyer = _pick(n.get("buyer-name"))
    if CENTRAL_PURCHASING.search(buyer or ""):
        buyer_pts += 6
        buyer_label = "central purchasing body"

    cpvs = n.get("classification-cpv") or []
    divisions = [c[:2] for c in cpvs if c]
    main = max((CPV.get(d, (5, "other"))) for d in divisions) if divisions else (5, "other")
    lots = max(1, len(n.get("deadline-receipt-tender-date-lot") or []))
    audience_pts = main[0] + (min(6.0, 2 * math.log2(lots)) if lots > 1 else 0)

    time_pts = 10 if days_left >= 14 else 6

    score = round(min(100, value_pts + buyer_pts + audience_pts + time_pts))
    facts = {"eur": eur, "currency": currency, "raw": raw, "deadline": deadline, "buyer": buyer,
             "buyer_label": buyer_label, "market": main[1], "lots": lots}
    return score, facts


def _money(eur):
    return f"€{eur / 1e9:.1f}B" if eur >= 1e9 else f"€{eur / 1e6:.1f}M"


def fetch_ted(cfg: dict, ted_session, errors: list) -> list:
    since = (datetime.utcnow() - timedelta(days=int(cfg["lookback_days"]))).strftime("%Y%m%d")
    query = f"PD>={since} AND notice-type=cn-standard AND estimated-value-proc>={int(cfg['min_value_eur'])}"
    notices = []
    for page in range(1, 5):
        try:
            r = ted_session.post(TED_API, json={"query": query, "fields": TED_FIELDS, "limit": 250, "page": page}, timeout=60)
            r.raise_for_status()
        except Exception as e:
            errors.append(f"generic TED page {page}: {e}")
            break
        batch = r.json().get("notices", [])
        notices += batch
        if len(batch) < 250:
            break
    return notices


# -------------------------------------------------------------------- news

def _domain(url):
    return urlparse(url or "").netloc.lower().removeprefix("www.")


def _source_pts(domain):
    for pts, domains in REPUTABLE.items():
        if any(domain == d or domain.endswith("." + d) for d in domains):
            return pts
    return 12


def _words(title):
    return {w for w in re.findall(r"[a-zà-ÿ0-9]{4,}", (title or "").lower())}


def _published(value):
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        try:
            return datetime.strptime(str(value)[:10], "%Y-%m-%d")
        except ValueError:
            return None


def clean_title(title: str) -> str:
    """Drop the site name news titles carry: "Story | Reuters", "Story - Energy", "Story | 05-10-2026 | News | EP"."""
    t = re.split(r"\s+\|\s+", (title or "").strip())[0]
    parts = re.split(r"\s+[-–—]\s+", t)
    if len(parts) > 1 and len(parts[-1]) <= 40:
        t = " - ".join(parts[:-1])
    return t.strip() or (title or "").strip()


NOT_NEWS = ("ted.europa.eu",)  # tender portals, not news
NOT_ARTICLE = re.compile(r"^(subscribe|sign in|log in|access denied|page not found|home\b)|supplement to the official journal", re.I)


def is_article(r) -> bool:
    """A real story: not a portal page, paywall stub or a title too short to be a headline."""
    title = clean_title(r.title or "")
    return bool(r.url and title) and _domain(r.url) not in NOT_NEWS and not NOT_ARTICLE.search(title) \
        and len(title.split()) >= 5


def score_news(results: list, now: datetime) -> list:
    """[(score, category, result, published, outlets)] — one per story: source
    reputation + how many distinct outlets carry it + freshness. Stories are
    grouped by title overlap; the best-scored article represents the group."""
    items = [(cat, r, _words(clean_title(r.title)), _domain(r.url)) for cat, r in results if is_article(r)]
    # Group articles about the same story.
    groups = []
    for it in items:
        for g in groups:
            if any(it[2] and o[2] and len(it[2] & o[2]) / len(it[2] | o[2]) >= (0.2 if it[3] == o[3] else 0.3) for o in g):
                g.append(it)
                break
        else:
            groups.append([it])
    scored = []
    for g in groups:
        outlets = {d for _, _, _, d in g}
        coverage = min(30, 10 * (len(outlets) - 1))
        best = None
        for cat, r, _, domain in g:
            published = _published(r.published_date)
            age = (now - published).days if published else 7
            fresh = 20 if age <= 1 else 15 if age <= 3 else 10 if age <= 7 else 4
            sc = round(min(100, _source_pts(domain) + coverage + fresh))
            if not best or sc > best[0]:
                best = (sc, cat, r, published, len(outlets))
        scored.append(best)
    return sorted(scored, key=lambda x: -x[0])


# --------------------------------------------------------------------- run

def run(session, scope, promote, country_names: dict, errors: list, tavily_cls=None) -> dict:
    """Discover, score and promote for one generic scope. `promote` is
    run_daily.promote. Returns counts and the new rows."""
    import requests
    cfg = config(scope)
    now = datetime.utcnow()
    out = {"tenders": [], "news": [], "updated": [], "checked": 0}

    def record(kind, row, score, ctype, reason):
        is_news = kind in ("news", "unchanged_news")
        session.execute(sql("""insert into scope_items (scope_id, item_type, item_id, relevance, candidate_type, reason)
                values (cast(:s as uuid), :t, :i, :r, :ct, :why)
                on conflict (scope_id, item_type, item_id) do update set relevance = excluded.relevance, reason = excluded.reason"""),
                        {"s": scope.id, "t": "news" if is_news else "tender", "i": row.news_id if is_news else row.opportunity_id,
                         "r": score, "ct": ctype, "why": reason[:500]})

    def candidate(cid, url, title, snippet, country, published, pack, query):
        c = session.get(Candidate, cid)
        if not c:
            c = Candidate(candidate_id=cid, discovered_at=now, source_url=url, title=title, description=snippet,
                          country=country, publication_date=published, discovery_query=query,
                          potential_categories=[pack], processed=True)
            session.add(c)
        session.execute(sql("""insert into candidate_scopes (candidate_id, scope_id, processed_at, relevance, candidate_type)
                values (:c, cast(:s as uuid), now(), :r, :t) on conflict (candidate_id, scope_id) do update
                set processed_at = now(), relevance = excluded.relevance, candidate_type = excluded.candidate_type"""),
                        {"c": cid, "s": scope.id, "r": 0, "t": None})
        return c

    # Tenders
    notices = fetch_ted(cfg, requests.Session(), errors)
    out["checked"] = len(notices)
    ranked, procedures = [], set()
    for n in notices:
        s = score_tender(n, now, float(cfg["min_value_eur"]))
        if s and s[0] >= int(cfg["min_tender_score"]):
            ranked.append((s[0], s[1], n))
    ranked.sort(key=lambda x: -x[0])
    unique = []
    for r in ranked:  # one per procurement (TED can carry several notices of one procedure)
        key = r[2].get("procedure-identifier") or (_pick(r[2].get("notice-title")), r[1]["buyer"])
        if key not in procedures:
            procedures.add(key)
            unique.append(r)
    ranked = unique
    for score, f, n in ranked[: int(cfg["max_tenders"])]:
        pub_no = n.get("publication-number", "")
        title = _pick(n.get("notice-title")) or "(untitled)"
        url = f"https://ted.europa.eu/en/notice/-/detail/{pub_no}"
        country = (n.get("buyer-country") or [None])[0]
        country2 = {"DEU": "DE", "FRA": "FR", "ITA": "IT", "ESP": "ES", "POL": "PL", "NLD": "NL", "BEL": "BE", "SWE": "SE",
                    "AUT": "AT", "DNK": "DK", "FIN": "FI", "IRL": "IE", "PRT": "PT", "GRC": "GR", "CZE": "CZ", "HUN": "HU",
                    "ROU": "RO", "BGR": "BG", "HRV": "HR", "SVK": "SK", "SVN": "SI", "LTU": "LT", "LVA": "LV", "EST": "EE",
                    "LUX": "LU", "MLT": "MT", "CYP": "CY", "NOR": "NO", "CHE": "CH", "ISL": "IS", "GBR": "GB"}.get(country or "", (country or "")[:2] or None)
        deadline = f["deadline"].strftime("%Y-%m-%d")
        snippet = (f"Buyer: {f['buyer']}. Notice type: {n.get('notice-type', '')}. Tender deadline: {deadline}. "
                   f"TED notice {pub_no}. TED procedure: {n.get('procedure-identifier') or 'n/a'}. "
                   f"Estimated value: {f['raw']:.0f} {f['currency']}.")
        reason = (f"{_money(f['eur'])} · {f['market']} · {f['buyer_label']}"
                  + (f" · {f['lots']} lots" if f["lots"] > 1 else "") + f" · {(f['deadline'] - now).days} days to bid")
        c = candidate(_cid(url, title), url, title, snippet, country2, _deadline([n.get("publication-date")]), "ted", "general: large tenders")
        # TED's English title is "Country – CPV label – <title in the notice's language>": keep the
        # English part as the display title until the Translator Agent renders the rest.
        parts = [p.strip() for p in title.split(" – ")]
        title_en = f"{parts[1]} — {parts[0]}" if len(parts) >= 3 else title
        t = {"type": "TENDER", "relevance": score, "country": country2, "title_en": title_en, "language": None,
             "authority": f["buyer"], "summary": reason, "reason": reason}
        promoted = promote(session, c, t, country_names)
        if promoted:
            kind, row = promoted[0], promoted[1]
            if row.estimated_value is None:
                row.estimated_value, row.currency = f["raw"], f["currency"]
            record(kind, row, score, "TENDER", reason)
            if kind == "opportunity":
                out["tenders"].append(row)
            elif kind == "updated":
                out["updated"].append({"opportunity": row.title, "change": "; ".join(promoted[2]), "action": f"Review: {row.official_url}"})
        session.execute(sql("update candidate_scopes set relevance = :r, candidate_type = 'TENDER' where candidate_id = :c and scope_id = cast(:s as uuid)"),
                        {"r": score, "c": c.candidate_id, "s": scope.id})
        session.commit()

    # News
    if tavily_cls is not None:
        results = []
        provider = tavily_cls(topic="news", days=7)
        for cat, queries in (cfg["news_queries"] or {}).items():
            for q in queries:
                try:
                    results += [(cat, r) for r in provider.search(q)]
                except Exception as e:
                    errors.append(f"generic news '{q}': {e}")
        seen = set()
        for score, cat, r, published, outlets in score_news(results, now):
            if score < int(cfg["min_news_score"]) or len(out["news"]) >= int(cfg["max_news"]):
                break
            if r.url in seen:
                continue
            seen.add(r.url)
            c = candidate(_cid(r.url, r.title), r.url, r.title, r.snippet, None, published, "news", f"general: {cat}")
            reason = f"{_domain(r.url)} · {cat}" + (f" · reported by {outlets} outlets" if outlets > 1 else "")
            t = {"type": "NEWS_ONLY", "relevance": score, "importance": score, "news_category": cat,
                 "title_en": clean_title(r.title),
                 "summary": (r.snippet or "")[:400], "reason": reason}
            promoted = promote(session, c, t, country_names)
            if promoted:
                record(promoted[0], promoted[1], score, "NEWS_ONLY", reason)
                if promoted[0] == "news":
                    out["news"].append(promoted[1])
            session.commit()
    return out
