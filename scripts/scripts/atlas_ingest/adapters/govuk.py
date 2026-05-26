"""GOV.UK Search API adapter — dual-route source.

Queries the GOV.UK Search API for transport-relevant content from DfT,
Innovate UK, and DSIT. Routes each result to either atlas.live_calls or
atlas.knowledge_documents based on doc type.

Routing strategy (two-tier):
  Tier 1 — deterministic (no LLM):
    policy_paper, guidance, research, written_statement, consultation
      → knowledge_document
    corporate_report, transparency, document_collection, speech
      → skip (low signal)
  Tier 2 — Haiku routing classifier for ambiguous types:
    press_release, news_story
      → classify_route() asks "new opportunity vs outcome/announcement"

CI failsafe: if all requests in a run return 403, the adapter raises
RuntimeError with a clear message so the GitHub Actions step fails visibly
rather than silently producing zero rows.

Rate limit: GOV.UK documents 10 req/sec; we use 1 req/sec to be polite.

Env:
  DATABASE_URL
  ANTHROPIC_API_KEY  (for routing classifier on press_release/news_story)
"""

from __future__ import annotations

import time
from typing import Iterator, Optional

import requests

from ..core.models import NormalizedRow

SEARCH_BASE = "https://www.gov.uk/api/search.json"
FIELDS = "title,link,description,content_store_document_type,public_timestamp"
HEADERS = {"User-Agent": "InnovationAtlas/4.0 (atlas@cpc.org.uk)"}
RESULTS_PER_PAGE = 50
POLITENESS_DELAY = 1.0  # seconds between requests

# Doc types routed deterministically (no LLM needed)
_KNOWLEDGE_DOC_TYPES = frozenset({
    "policy_paper",
    "guidance",
    "detailed_guide",
    "research",
    "written_statement",
    "consultation",
    "closed_consultation",
})
_SKIP_TYPES = frozenset({
    "corporate_report",
    "transparency",
    "document_collection",
    "speech",
    "travel_advice",
    "transaction",
    "guide",
})
# Types that need the routing classifier
_AMBIGUOUS_TYPES = frozenset({"press_release", "news_story"})

# Curated query sets: each entry is a dict of params to pass to the GOV.UK API.
# We use paginated queries to avoid hardcoded page counts.
QUERY_SETS = [
    {
        "label": "DfT funding press releases",
        "params": {
            "filter_organisations": "department-for-transport",
            "filter_format": "press_release",
            "q": "funding innovation",
        },
    },
    {
        "label": "DfT news stories (transport innovation)",
        "params": {
            "filter_organisations": "department-for-transport",
            "filter_format": "news_story",
            "q": "innovation competition funding",
        },
    },
    {
        "label": "DfT policy papers",
        "params": {
            "filter_organisations": "department-for-transport",
            "filter_format": "policy_paper",
        },
    },
    {
        "label": "DfT guidance (autonomous/CAV)",
        "params": {
            "filter_organisations": "department-for-transport",
            "filter_format": "guidance",
            "q": "autonomous vehicles connected",
        },
    },
    {
        "label": "DfT maritime decarbonisation",
        "params": {
            "filter_organisations": "department-for-transport",
            "q": "maritime decarbonisation",
        },
    },
    {
        "label": "Innovate UK transport funding",
        "params": {
            "filter_organisations": "innovate-uk",
            "q": "innovation funding transport",
        },
    },
    {
        "label": "DSIT innovation competitions",
        "params": {
            "filter_organisations": "department-for-science-innovation-and-technology",
            "q": "innovation competition funding",
        },
    },
]

# Max results per query (avoid fetching entire archive on first run)
MAX_RESULTS_PER_QUERY = 200


def _fetch_query(params: dict, start: int = 0) -> dict:
    """Fetch a single page of results from the GOV.UK Search API."""
    all_params = {
        **params,
        "count": str(RESULTS_PER_PAGE),
        "start": str(start),
        "fields": FIELDS,
    }
    resp = requests.get(SEARCH_BASE, params=all_params, headers=HEADERS, timeout=15)
    return resp  # caller checks status


def _result_to_row(result: dict) -> Optional[NormalizedRow]:
    """Convert a GOV.UK search result to a NormalizedRow with doc_type set."""
    title = (result.get("title") or "").strip()
    link = result.get("link", "")
    if not title or not link:
        return None

    source_url = f"https://www.gov.uk{link}" if link.startswith("/") else link
    doc_type_raw = result.get("content_store_document_type", "")
    description = (result.get("description") or "").strip() or None
    public_ts = result.get("public_timestamp", "")
    published_date = None
    if public_ts:
        try:
            from datetime import datetime as _dt
            published_date = _dt.fromisoformat(public_ts.replace("Z", "+00:00")).date()
        except ValueError:
            pass

    # Determine routing tier
    if doc_type_raw in _SKIP_TYPES:
        return None

    if doc_type_raw in _KNOWLEDGE_DOC_TYPES:
        route = "knowledge_document"
        # GOV.UK is a trusted primary source for policy and guidance content.
        # These rows should land as approved immediately so they appear in the
        # search_with_classifications RPC (which filters status='approved').
        tier = "primary"
        auto_approve = True
    elif doc_type_raw in _AMBIGUOUS_TYPES:
        route = "ambiguous"  # resolved by classify_route in engine
        tier = "secondary"
        auto_approve = False
    else:
        route = "knowledge_document"
        tier = "secondary"
        auto_approve = False

    return NormalizedRow(
        title=title[:2000],
        description=description,
        funder="GOV.UK / " + doc_type_raw,
        deadline=None,
        funding_amount=None,
        source_url=source_url[:4000],
        source="govuk",
        status="open",
        doc_type=route,  # 'live_call', 'knowledge_document', or 'ambiguous'
        tier=tier,
        auto_approve=auto_approve,
        raw_metadata={
            "content_store_document_type": doc_type_raw,
            "public_timestamp": public_ts,
            "published_date": str(published_date) if published_date else None,
        },
    )


def fetch(
    existing_live_call_urls: set[str],
    existing_knowledge_doc_urls: set[str],
) -> Iterator[NormalizedRow]:
    """Yield NormalizedRow for GOV.UK results not already in the corpus.

    existing_live_call_urls: source_urls stored for source='govuk' in live_calls
    existing_knowledge_doc_urls: source_urls in knowledge_documents

    Raises RuntimeError if all requests return 403 (CI failsafe).
    """
    seen_urls: set[str] = set()
    request_count = 0
    forbidden_count = 0

    for query_set in QUERY_SETS:
        label = query_set["label"]
        params = query_set["params"]
        start = 0
        fetched_for_query = 0

        print(f"  [govuk] Query: {label}", flush=True)

        while fetched_for_query < MAX_RESULTS_PER_QUERY:
            if request_count > 0:
                time.sleep(POLITENESS_DELAY)

            resp = _fetch_query(params, start=start)
            request_count += 1

            if resp.status_code == 403:
                forbidden_count += 1
                print(
                    f"  [govuk] WARNING: 403 Forbidden for query '{label}' (start={start})",
                    flush=True,
                )
                break  # Try next query set

            resp.raise_for_status()
            data = resp.json()
            results = data.get("results") or []
            total = data.get("total", 0)

            if not results:
                break

            for result in results:
                row = _result_to_row(result)
                if row is None:
                    continue
                if row.source_url in seen_urls:
                    continue
                seen_urls.add(row.source_url)

                # Skip if already in appropriate destination
                existing = (
                    existing_live_call_urls
                    if row.doc_type in ("live_call", "ambiguous")
                    else existing_knowledge_doc_urls
                )
                if row.source_url in existing:
                    row.raw_metadata["_skipped"] = True

                yield row

            fetched_for_query += len(results)
            start += len(results)
            if start >= total or len(results) < RESULTS_PER_PAGE:
                break

        print(
            f"  [govuk] {label}: fetched {fetched_for_query} results (total available: "
            + (str(data.get("total", "?")) if "data" in dir() else "?")
            + ")",
            flush=True,
        )

    # CI failsafe: if every single request returned 403, the source is blocked
    if request_count > 0 and forbidden_count == request_count:
        raise RuntimeError(
            "GOV.UK adapter: ALL requests returned 403 Forbidden. "
            "The GOV.UK Search API appears to be blocking requests from this IP address "
            "(common with datacenter/CI runner IPs). "
            "Test manually and verify GITHUB_ACTIONS runner access before relying on this source."
        )


def is_skipped(row: NormalizedRow) -> bool:
    return bool(row.raw_metadata.get("_skipped"))


def is_ambiguous(row: NormalizedRow) -> bool:
    """True if this row's routing must be resolved by the Haiku classifier."""
    return row.doc_type == "ambiguous"
