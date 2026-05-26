"""
Atlas 5 — External Evidence Search

Two search functions, both CONTROLLED by the Evidence Gap router.
Neither function is a free-browsing tool — they are called only when
atlas/graph.py's external_evidence_search node detects a gap with
available_tool == "govuk_search" or "exa_search".

GOVUK_SEARCH:
  Calls the GOV.UK REST API (no key required, public endpoint).
  Infers the real publisher (DfT, CCAV, NationalHighways, UKRI…)
  from the result's organisation slug list.
  GovUK is ONLY used as the provider when no specific publisher can
  be identified — it is an access route, not a source identity.

EXA_SEARCH:
  Calls Exa neural search (requires EXA_API_KEY in env).
  Infers provider from URL where possible.
  Exa is the tool; the provider is the actual publisher if known.
  Used exclusively for market_discovery and landscape_gap lanes.

Both functions:
  - Return ExternalResult dicts (not CorpusCitation shape)
  - Tag results with retrieval_tool and recommended_provider
  - Set citation_status to "candidate" (all external = needs review)
  - Never raise confidence above Supported (enforced by build_five_case)

SECURITY: EXA_API_KEY never logged. GOV.UK API has no key.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GOV.UK organisation slug → Atlas provider name
# ---------------------------------------------------------------------------

_GOVUK_SLUG_MAP: dict[str, str] = {
    "department-for-transport": "DfT",
    "centre-for-connected-and-autonomous-vehicles": "CCAV",
    "national-highways": "NationalHighways",
    "innovate-uk": "InnovateUK",
    "uk-research-and-innovation": "UKRI",
    "department-for-science-innovation-and-technology": "UKRI",
    "department-for-energy-security-and-net-zero": "DfT",
    "homes-england": "GovUK",
    "cabinet-office": "GovUK",
}

# Link path fragments that hint at publisher even without org slugs
_GOVUK_PATH_HINTS: list[tuple[str, str]] = [
    ("ccav", "CCAV"),
    ("connected-autonomous", "CCAV"),
    ("centre-connected", "CCAV"),
    ("national-highways", "NationalHighways"),
    ("innovate-uk", "InnovateUK"),
    ("ukri", "UKRI"),
    ("uk-research-and-innovation", "UKRI"),
    ("department-for-transport", "DfT"),
    ("transport-", "DfT"),
    ("/transport/", "DfT"),
]


def _infer_govuk_provider(orgs: list[dict], link: str) -> str:
    """
    Map a GOV.UK result's organisations list and link path to a provider name.
    Returns "GovUK" only when no more specific publisher can be identified.
    """
    for org in orgs:
        slug = org.get("slug", "") or org.get("abbreviation", "")
        if slug in _GOVUK_SLUG_MAP:
            return _GOVUK_SLUG_MAP[slug]

    # Try path hints
    link_lower = link.lower()
    for fragment, provider in _GOVUK_PATH_HINTS:
        if fragment in link_lower:
            return provider

    return "GovUK"  # fallback only — content from GOV.UK without clear publisher


# ---------------------------------------------------------------------------
# EXA URL → Atlas provider name
# ---------------------------------------------------------------------------

_EXA_DOMAIN_MAP: list[tuple[str, str]] = [
    ("department-for-transport", "DfT"),
    ("dft.gov.uk", "DfT"),
    ("ccav", "CCAV"),
    ("connected-autonomous", "CCAV"),
    ("national-highways", "NationalHighways"),
    ("highways.gov.uk", "NationalHighways"),
    ("innovateuk.org", "InnovateUK"),
    ("iuk.gov.uk", "InnovateUK"),
    ("innovate-uk", "InnovateUK"),
    ("ukri.org", "UKRI"),
    ("uk-research-and-innovation", "UKRI"),
    ("horizon-europe", "HorizonEurope"),
    ("ec.europa.eu", "HorizonEurope"),
    ("gov.uk", "GovUK"),  # catch-all for GOV.UK before Exa fallback
]


def _infer_exa_provider(url: str) -> str:
    """
    Map an Exa result URL to a provider name.
    Returns "Exa" only when no known publisher domain matches.
    """
    url_lower = url.lower()
    for fragment, provider in _EXA_DOMAIN_MAP:
        if fragment in url_lower:
            return provider
    return "Exa"  # non-government / unknown source


# ---------------------------------------------------------------------------
# GOV.UK search
# ---------------------------------------------------------------------------

GOVUK_SEARCH_URL = "https://www.gov.uk/api/search.json"
GOVUK_TIMEOUT = 10.0
GOVUK_DEFAULT_LIMIT = 5


def search_govuk(
    query: str,
    limit: int = GOVUK_DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Search GOV.UK using the public REST API (no key required).

    Only called when an evidence_gap with available_tool == "govuk_search"
    and recommended_source_lane == "official_policy" exists.

    Returns a list of ExternalResult dicts. GovUK is the provider fallback
    only — specific publishers (DfT, CCAV, NationalHighways) are inferred
    from organisation slugs when available.

    Args:
        query: Search query (typically the gap topic or original user query)
        limit: Max results (default 5, max 10)
    """
    limit = min(int(limit), 10)
    try:
        resp = httpx.get(
            GOVUK_SEARCH_URL,
            params={"q": query, "count": limit},
            timeout=GOVUK_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("govuk_search failed: %s", exc)
        return []

    results: list[dict[str, Any]] = []
    for r in data.get("results", [])[:limit]:
        link = r.get("link", "")
        orgs = r.get("organisations", [])
        provider = _infer_govuk_provider(orgs, link)
        title = r.get("title", "").strip()
        if not title:
            continue
        results.append({
            "source_type": "govuk_result",
            "url": f"https://www.gov.uk{link}",
            "title": title,
            "snippet": (r.get("description", "") or "")[:400],
            # Provider is the real publisher, NOT the search tool
            "recommended_provider": provider,
            "retrieval_tool": "govuk_search",
            # External results always need human review
            "citation_status": "candidate",
            "score": None,
            "published_date": r.get("public_timestamp"),
        })

    logger.info(
        "govuk_search '%s' → %d results (providers: %s)",
        query[:60],
        len(results),
        ", ".join({r["recommended_provider"] for r in results}),
    )
    return results


# ---------------------------------------------------------------------------
# Exa search
# ---------------------------------------------------------------------------

EXA_DEFAULT_LIMIT = 5


def search_exa(
    query: str,
    limit: int = EXA_DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Search with Exa neural search (requires EXA_API_KEY).

    Only called when an evidence_gap with available_tool == "exa_search"
    and recommended_source_lane in ("market_discovery", "landscape_gap")
    exists. NOT a free-browsing tool.

    Exa is the tool; the provider is the real publisher where inferable
    from the URL. "Exa" is only used as provider when no known domain matches.

    Confidence ceiling: Exa-only evidence cannot lift above Supported.
    This is enforced in build_five_case, not here.

    Args:
        query: Search query (typically the gap topic)
        limit: Max results (default 5, max 8)
    """
    exa_key = os.getenv("EXA_API_KEY", "").strip()
    if not exa_key:
        logger.warning("exa_search skipped: EXA_API_KEY not set")
        return []

    limit = min(int(limit), 8)
    try:
        from exa_py import Exa  # type: ignore[import]

        exa = Exa(api_key=exa_key)
        response = exa.search(query, num_results=limit)
    except ImportError:
        logger.warning("exa_search skipped: exa_py not installed")
        return []
    except Exception as exc:
        logger.warning("exa_search failed: %s", exc)
        return []

    results: list[dict[str, Any]] = []
    for r in response.results:
        url = getattr(r, "url", "") or ""
        title = (getattr(r, "title", "") or "").strip()
        if not title or not url:
            continue
        provider = _infer_exa_provider(url)
        results.append({
            "source_type": "exa_result",
            "url": url,
            "title": title,
            "snippet": "",  # text requires extra API call — omit by default
            # Provider is real publisher if known, else Exa
            "recommended_provider": provider,
            "retrieval_tool": "exa_search",
            "citation_status": "candidate",
            "score": getattr(r, "score", None),
            "published_date": getattr(r, "published_date", None),
        })

    logger.info(
        "exa_search '%s' → %d results (providers: %s)",
        query[:60],
        len(results),
        ", ".join({r["recommended_provider"] for r in results}),
    )
    return results
