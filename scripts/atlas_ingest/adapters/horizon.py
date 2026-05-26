"""Horizon Europe adapter.

Fetches transport-relevant calls from the EU Horizon search API and
normalises them to NormalizedRow. All rows go through Haiku relevance
classification (previously only cryptic-title rows were classified).

Key change vs legacy ingest_live_calls.py:
  - ALL rows classified, not just those matching HORIZON_TITLE_NEEDS_AI
  - Uses shared core.classify, core.embed, core.upsert
  - Upsert uses ON CONFLICT DO UPDATE (not DO NOTHING) to refresh status/deadline
  - Writes run counters to atlas.ingest_runs via core.ledger

Env:
  DATABASE_URL
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  REACT_APP_SOLR_KEY or EU_HORIZON_SEARCH_API_KEY
"""

from __future__ import annotations

import html
import os
import re
import time
from datetime import date, datetime
from typing import Iterator, Optional

import requests

from ..core.models import NormalizedRow

SEARCH_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
SEARCH_TEXT = (
    "transport autonomous mobility built environment decarbonisation "
    "infrastructure clean energy"
)
PAGE_SIZE = 50
DEFAULT_PAGE_START = 6
DEFAULT_PAGE_END = 20

_TAG_RE = re.compile(r"<[^>]+>")
_FUNDER = "European Commission / Horizon Europe"

TITLE_FIX_SQL = """
UPDATE atlas.live_calls
SET title = LEFT(REGEXP_REPLACE(description, '[[:space:]]+', ' ', 'g'), 80)
WHERE source = 'horizon_europe'
  AND (LENGTH(title) < 20 OR title ~ '^[A-Z0-9-]+$')
  AND description IS NOT NULL
  AND LENGTH(description) > 20
"""


def _strip_html(s: str) -> str:
    t = _TAG_RE.sub(" ", s)
    return html.unescape(" ".join(t.split())).strip()


def _first_meta_list(meta: dict, key: str) -> list:
    v = meta.get(key)
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _parse_deadlines(meta: dict) -> list[datetime]:
    out = []
    for s in _first_meta_list(meta, "deadlineDate"):
        if not s:
            continue
        try:
            out.append(datetime.fromisoformat(str(s).replace("Z", "+00:00")))
        except ValueError:
            continue
    return out


def _deadline_status(deadlines: list[datetime]) -> tuple[Optional[date], str]:
    today = date.today()
    if not deadlines:
        return None, "open"
    latest = max(deadlines)
    d = latest.date()
    return d, "closed" if d < today else "open"


def _extract_funding_amount(meta: dict) -> Optional[str]:
    import json as _json

    bo = _first_meta_list(meta, "budgetOverview")
    if not bo:
        return None
    total = 0.0
    for entry in bo:
        try:
            parsed = _json.loads(str(entry)) if isinstance(entry, str) else entry
        except Exception:
            continue
        bmap = parsed.get("budgetTopicActionMap") if isinstance(parsed, dict) else None
        if not bmap or not isinstance(bmap, dict):
            continue
        for actions in bmap.values():
            if not isinstance(actions, list):
                continue
            for action in actions:
                if not isinstance(action, dict):
                    continue
                for v in action.get("budgetYearMap", {}).values():
                    try:
                        total += float(v)
                    except (TypeError, ValueError):
                        pass
    if total <= 0:
        return None
    if total >= 1_000_000:
        return f"\u20ac{round(total / 1_000_000)}m"
    if total >= 1_000:
        return f"\u20ac{round(total / 1_000)}k"
    return f"\u20ac{round(total)}"


def _fetch_page(api_key: str, page_number: int) -> dict:
    r = requests.post(
        SEARCH_URL,
        params={
            "apiKey": api_key,
            "text": SEARCH_TEXT,
            "pageSize": str(PAGE_SIZE),
            "pageNumber": str(page_number),
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def _item_to_row(item: dict) -> Optional[NormalizedRow]:
    url = item.get("url")
    if not url:
        return None
    meta = item.get("metadata") or {}
    titles = _first_meta_list(meta, "callTitle")
    ident = _first_meta_list(meta, "identifier")
    title = item.get("title") or (titles[0] if titles else None)
    if not title and ident:
        title = ident[0]
    if not title:
        title = (item.get("summary") or "Live call")[:200]

    summary = item.get("summary") or _strip_html(item.get("content") or "")
    deadlines = _parse_deadlines(meta)
    deadline_d, status = _deadline_status(deadlines)

    return NormalizedRow(
        title=str(title)[:2000],
        description=summary[:8000] if summary else None,
        funder=_FUNDER,
        deadline=deadline_d,
        funding_amount=_extract_funding_amount(meta),
        source_url=str(url)[:4000],
        source="horizon_europe",
        status=status,
        doc_type="live_call",
        raw_metadata={
            "identifier": ident,
            "embed_text": f"{title}. {summary}. {' '.join(ident)}".strip(),
        },
    )


def fetch(existing_urls: set[str]) -> Iterator[NormalizedRow]:
    """Yield NormalizedRow for each Horizon result not already in the corpus.

    existing_urls: set of source_urls already stored for source='horizon_europe'
    """
    api_key = os.environ.get("REACT_APP_SOLR_KEY") or os.environ.get(
        "EU_HORIZON_SEARCH_API_KEY"
    )
    if not api_key:
        raise RuntimeError(
            "Set REACT_APP_SOLR_KEY or EU_HORIZON_SEARCH_API_KEY for Horizon adapter."
        )

    page_start = int(os.environ.get("HORIZON_PAGE_START", str(DEFAULT_PAGE_START)))
    page_end = int(os.environ.get("HORIZON_PAGE_END", str(DEFAULT_PAGE_END)))
    lo = max(1, page_start)
    hi = max(lo, page_end)

    print(f"[horizon] Fetching pages {lo}–{hi} (pageSize={PAGE_SIZE})...", flush=True)

    for page_num in range(lo, hi + 1):
        if page_num > lo:
            time.sleep(1.0)
        print(f"  [horizon] Page {page_num}/{hi}...", flush=True)
        try:
            page_data = _fetch_page(api_key, page_num)
        except Exception as exc:
            print(f"  [horizon] Warning: page {page_num} failed ({exc}), stopping.", flush=True)
            break

        for item in page_data.get("results") or []:
            row = _item_to_row(item)
            if row is None:
                continue
            if row.source_url in existing_urls:
                yield _skipped(row)
                continue
            yield row


class _SkippedRow(NormalizedRow):
    """Marker subclass so the engine can detect pre-existing URLs."""
    _skipped = True


def _skipped(row: NormalizedRow) -> NormalizedRow:
    row.raw_metadata["_skipped"] = True
    return row


def is_skipped(row: NormalizedRow) -> bool:
    return bool(row.raw_metadata.get("_skipped"))


def apply_title_fixes(conn) -> None:
    """Run the post-ingest title fix SQL for cryptic Horizon titles."""
    with conn.cursor() as cur:
        cur.execute(TITLE_FIX_SQL)
    conn.commit()
