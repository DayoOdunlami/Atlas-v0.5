"""Research lane — OpenAlex works search (T6, config-gated)."""

from __future__ import annotations

import os
from typing import Any

import httpx

from agents.atlas_v5.keyed_figures import KeyedFigure

OPENALEX_API = "https://api.openalex.org/works"
_DEFAULT_MAILTO = "atlas5@connectedplaces.org"


def _mailto() -> str:
    return os.getenv("OPENALEX_MAILTO", _DEFAULT_MAILTO)


def fetch_openalex_snapshot(query: str, *, limit: int = 5) -> dict[str, Any] | None:
    """Fetch a lightweight OpenAlex snapshot for a query. Returns None on failure."""
    q = query.strip()
    if len(q) < 4:
        return None
    params = {
        "search": q[:200],
        "per_page": min(max(limit, 1), 25),
        "mailto": _mailto(),
    }
    headers = {"User-Agent": f"Atlas5/1.0 (mailto:{_mailto()})"}
    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(OPENALEX_API, params=params, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    results = payload.get("results") or []
    meta = payload.get("meta") or {}
    works: list[dict[str, Any]] = []
    for item in results[:limit]:
        if not isinstance(item, dict):
            continue
        works.append(
            {
                "id": str(item.get("id") or ""),
                "title": str(item.get("display_name") or item.get("title") or "Untitled"),
                "cited_by_count": int(item.get("cited_by_count") or 0),
                "publication_year": item.get("publication_year"),
                "doi": (item.get("doi") or "").replace("https://doi.org/", ""),
            }
        )
    return {
        "query": q,
        "total_count": int(meta.get("count") or len(works)),
        "sample_size": len(works),
        "works": works,
    }


def build_research_figures(snapshot: dict[str, Any] | None) -> dict[str, KeyedFigure]:
    """Map OpenAlex snapshot → research.* keyed figures."""
    if not snapshot or snapshot.get("sample_size", 0) == 0:
        return {
            "research.work_count": KeyedFigure(
                key="research.work_count",
                value=0,
                unit="count",
                material="absent",
                provenance="OpenAlex — no works returned",
                lane="research",
                validation_status="absent",
                confidence_tier="Speculative",
                source_refs=[],
            )
        }

    works = snapshot.get("works") or []
    total = int(snapshot.get("total_count") or len(works))
    top_cited = max((int(w.get("cited_by_count") or 0) for w in works), default=0)
    refs = [str(w.get("id")) for w in works if w.get("id")][:5]
    titles = "; ".join(str(w.get("title") or "")[:60] for w in works[:3])

    status = "verified" if len(works) >= 2 else "candidate"
    tier = "Supported" if top_cited >= 20 else "Indicative"

    return {
        "research.work_count": KeyedFigure(
            key="research.work_count",
            value=total,
            unit="count",
            material="borrowed",
            provenance=f"OpenAlex search · {snapshot.get('query', '')[:80]}",
            lane="research",
            validation_status=status,
            confidence_tier=tier,
            source_refs=refs,
        ),
        "research.top_cited_count": KeyedFigure(
            key="research.top_cited_count",
            value=top_cited,
            unit="count",
            material="borrowed",
            provenance="OpenAlex sample — max cited_by_count in top works",
            lane="research",
            validation_status=status,
            confidence_tier=tier,
            source_refs=refs[:1],
        ),
        "research.sample_titles": KeyedFigure(
            key="research.sample_titles",
            value=titles or "—",
            unit="text",
            material="borrowed",
            provenance="OpenAlex top works by relevance",
            lane="research",
            validation_status=status,
            confidence_tier="Indicative",
            source_refs=refs,
        ),
    }
