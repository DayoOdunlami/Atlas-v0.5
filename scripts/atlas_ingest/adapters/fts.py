"""Find a Tender (FTS) adapter.

Fetches OCDS releases from UK Find a Tender and normalises them to
NormalizedRow. This is the reference implementation — the FTS gatekeeper
pattern is what other adapters aim to match.

Changes vs legacy ingest_fts_tenders.py:
  - Uses shared core.classify, core.embed, core.upsert, core.ledger
  - layer1_pass logic extracted inline (BROAD_RELEVANT_AUTHORITIES / BROAD_KEYWORDS)
  - All other logic is identical to the proven original

Env:
  DATABASE_URL
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
"""

from __future__ import annotations

import time
from datetime import date, datetime
from typing import Iterator, Optional

import requests

from ..core.models import NormalizedRow

FTS_BASE = "https://www.find-tender.service.gov.uk"
OCDS_URL = f"{FTS_BASE}/api/1.0/ocdsReleasePackages"
HEADERS = {
    "User-Agent": "InnovationAtlas/4.0 (atlas@cpc.org.uk)",
    "Accept": "application/json",
}
MAX_PAGES = 30

BROAD_RELEVANT_AUTHORITIES = [
    "network rail",
    "national highways",
    "transport for london",
    "department for transport",
    "civil aviation authority",
    "maritime and coastguard",
    "homes england",
    "innovate uk",
    "ukri",
    "catapult",
    "combined authority",
    "tfl",
    "highways england",
    "great british railways",
    "office of rail",
    "dft",
    "department of transport",
]

BROAD_KEYWORDS = [
    "rail", "train", "tram", "metro", "aviation", "aircraft", "drone", "uas",
    "unmanned", "maritime", "vessel", "ship", "port", "harbour", "autonomous",
    "electric vehicle", "charging infrastructure", "hydrogen", "decarbonisation",
    "zero emission", "digital twin", "smart infrastructure", "electrification",
    "transport", "highway", "road safety", "bridge inspection", "tunnel",
    "signalling", "traffic management", "fleet management", "mobility",
    "logistics", "freight", "geospatial", "lidar", "sensor fusion", "v2x",
    "connected vehicle", "data platform", "renewable energy",
]


def layer1_pass(funder: str, title: str, description: str) -> bool:
    f = (funder or "").lower()
    if any(a in f for a in BROAD_RELEVANT_AUTHORITIES):
        return True
    head = ((title or "") + " " + (description or "")[:500]).lower()
    return any(kw in head for kw in BROAD_KEYWORDS)


def _parse_date_str(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    raw = str(s).strip()
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _fetch_page(updated_to: Optional[str] = None, max_retries: int = 3) -> dict:
    params: dict = {}
    if updated_to:
        params["updatedTo"] = updated_to
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            resp = requests.get(OCDS_URL, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except (requests.exceptions.Timeout, requests.exceptions.RequestException) as exc:
            last_exc = exc
            wait = 5 * (2 ** attempt)
            print(f"  [fts] Request error ({exc}), wait {wait}s...", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch FTS page updatedTo={updated_to!r}") from last_exc


def _process_release(rel: dict) -> Optional[NormalizedRow]:
    release_id = rel.get("id", "") or ""
    buyer_name = (rel.get("buyer") or {}).get("name", "") or ""
    tender = rel.get("tender") or {}
    title = (tender.get("title") or "").strip()
    description = (tender.get("description") or "").strip()[:500]

    if not layer1_pass(buyer_name, title, description):
        return None

    period = tender.get("tenderPeriod") or {}
    deadline = _parse_date_str(period.get("endDate"))
    tender_status = tender.get("status", "")
    today = date.today()
    if tender_status == "active" and (deadline is None or deadline >= today):
        status = "open"
    else:
        status = "closed"

    value = tender.get("value") or {}
    amount = value.get("amount")
    currency = value.get("currency", "GBP")
    funding = None
    if amount is not None:
        symbol = "£" if currency == "GBP" else str(currency)
        try:
            funding = f"{symbol}{float(amount):,.0f}"
        except (TypeError, ValueError):
            funding = str(amount)[:500]

    source_url = f"{FTS_BASE}/Notice/{release_id}"
    return NormalizedRow(
        title=(title or release_id)[:2000],
        description=description if description else None,
        funder=buyer_name[:1000] if buyer_name else None,
        deadline=deadline,
        funding_amount=funding,
        source_url=source_url[:4000],
        source="find_a_tender",
        status=status,
        doc_type="live_call",
    )


def fetch(existing_urls: set[str]) -> Iterator[NormalizedRow]:
    """Yield NormalizedRow for FTS releases that pass the L1 pre-filter.

    existing_urls: set of source_urls already stored for source='find_a_tender'
    Skipped URLs are yielded with _skipped=True in raw_metadata.
    """
    updated_to: Optional[str] = None
    page_num = 0

    while page_num < MAX_PAGES:
        page_num += 1
        label = f"updatedTo={updated_to}" if updated_to else "latest"
        print(f"  [fts] Page {page_num}/{MAX_PAGES} ({label})...", flush=True)
        try:
            data = _fetch_page(updated_to=updated_to)
        except Exception as exc:
            print(f"  [fts] Abort pagination: {exc}", flush=True)
            break

        releases = data.get("releases") or []
        if not releases:
            break

        for rel in releases:
            row = _process_release(rel)
            if row is None:
                continue
            if row.source_url in existing_urls:
                row.raw_metadata["_skipped"] = True
                yield row
                continue
            yield row

        dates = [r.get("date", "") for r in releases if r.get("date")]
        if not dates:
            break
        updated_to = min(dates)
        if len(releases) < 100:
            break
        time.sleep(1.0)


def is_skipped(row: NormalizedRow) -> bool:
    return bool(row.raw_metadata.get("_skipped"))
