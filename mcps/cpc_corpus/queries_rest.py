"""
CPC corpus queries via Supabase REST (HTTPS port 443).

Project search: semantic RPC only (search_projects_by_embedding).
Keyword ILIKE helpers remain for legacy live_calls / hive lookups — not atlas.projects search.
"""
from __future__ import annotations

import os
from typing import Any, Optional

from mcps.cpc_corpus.transport import sanitize_ilike_term


def _client():
    from supabase import create_client

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def _rpc_available(name: str) -> bool:
    try:
        sb = _client()
        sb.schema("atlas").rpc(name, {"query_embedding": [0.0] * 1536, "k": 1}).execute()
        return True
    except Exception:
        return False


def search_projects_keyword(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Legacy ILIKE helper — not used for atlas.projects search (semantic only)."""
    sb = _client()
    term = sanitize_ilike_term(query)
    pattern = f"%{term}%"
    result = (
        sb.schema("atlas")
        .from_("projects")
        .select("id, title, lead_org_name, abstract, transport_relevance_score")
        .or_(f"title.ilike.{pattern},abstract.ilike.{pattern}")
        .order("transport_relevance_score", desc=True)
        .limit(limit)
        .execute()
    )
    rows = result.data or []
    return [
        {
            "id": str(r["id"]),
            "title": r.get("title") or "",
            "organisation": r.get("lead_org_name") or "",
            "abstract": (r.get("abstract") or "")[:300],
            "transport_relevance_score": r.get("transport_relevance_score"),
            "similarity": None,
            "source_type": "project",
        }
        for r in rows
    ]


def search_projects_vector(embedding_vec: list[float], limit: int = 10) -> list[dict[str, Any]]:
    sb = _client()
    result = (
        sb.schema("atlas")
        .rpc(
            "search_projects_by_embedding",
            {"query_embedding": embedding_vec, "k": limit},
        )
        .execute()
    )
    rows = result.data or []
    return [
        {
            "id": str(r["id"]),
            "title": r.get("title") or "",
            "organisation": r.get("lead_org_name") or r.get("organisation") or "",
            "abstract": (r.get("abstract") or "")[:300],
            "transport_relevance_score": r.get("transport_relevance_score"),
            "similarity": round(float(r.get("similarity") or 0), 4),
            "source_type": "project",
        }
        for r in rows
    ]


def get_project(project_id: str) -> Optional[dict[str, Any]]:
    sb = _client()
    result = (
        sb.schema("atlas")
        .from_("projects")
        .select("id, title, lead_org_name, abstract, transport_relevance_score")
        .eq("id", project_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "title": row.get("title") or "",
        "organisation": row.get("lead_org_name") or "",
        "abstract": (row.get("abstract") or "")[:500],
        "transport_relevance_score": row.get("transport_relevance_score"),
        "source_type": "project",
    }


def search_live_calls_keyword(
    query: str,
    limit: int = 10,
    open_only: bool = True,
) -> list[dict[str, Any]]:
    sb = _client()
    term = sanitize_ilike_term(query)
    pattern = f"%{term}%"
    q = (
        sb.schema("atlas")
        .from_("live_calls")
        .select("id, title, funder, description, status, deadline, source_url")
        .or_(f"title.ilike.{pattern},description.ilike.{pattern}")
    )
    if open_only:
        q = q.eq("status", "open")
    result = q.order("deadline", desc=False).limit(limit).execute()
    return [
        {
            "id": str(r["id"]),
            "title": r.get("title") or "",
            "funder": r.get("funder") or "",
            "description": (r.get("description") or "")[:300],
            "status": r.get("status") or "",
            "deadline": str(r["deadline"]) if r.get("deadline") else None,
            "source_url": r.get("source_url") or "",
            "similarity": None,
            "source_type": "live_call",
        }
        for r in (result.data or [])
    ]


def search_hive_keyword(query: str, limit: int = 10) -> list[dict[str, Any]]:
    sb = _client()
    term = sanitize_ilike_term(query)
    pattern = f"%{term}%"
    result = (
        sb.schema("hive")
        .from_("articles")
        .select("id, project_title, measure_title")
        .or_(f"project_title.ilike.{pattern},measure_title.ilike.{pattern}")
        .limit(limit)
        .execute()
    )
    return [
        {
            "article_id": str(r["id"]),
            "title": r.get("project_title") or r.get("measure_title") or "",
            "source_type": "hive_article",
        }
        for r in (result.data or [])
    ]


def parse_embedding_string(embedding: str) -> list[float]:
    inner = embedding.strip("[]")
    return [float(x) for x in inner.split(",") if x.strip()]


def fetch_rail_bridge_agg_rows() -> list[dict[str, Any]]:
    """Aggregate cross_modal_bridges over REST — rail-containing pairs only."""
    from collections import defaultdict

    sb = _client()
    raw: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        batch = (
            sb.schema("atlas")
            .from_("cross_modal_bridges")
            .select("dominant_pair, bridge_score")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        if not batch:
            break
        raw.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    agg: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in raw:
        pair = row.get("dominant_pair") or []
        if not isinstance(pair, list) or len(pair) < 2:
            continue
        if not any(str(m).strip().lower() == "rail" for m in pair):
            continue
        key = (str(pair[0]).strip(), str(pair[1]).strip())
        score = float(row.get("bridge_score") or 0)
        agg[key].append(score)

    out: list[dict[str, Any]] = []
    for (mode_a, mode_b), scores in sorted(
        agg.items(), key=lambda kv: len(kv[1]), reverse=True
    )[:24]:
        out.append(
            {
                "mode_a": mode_a,
                "mode_b": mode_b,
                "bridge_count": len(scores),
                "avg_score": sum(scores) / max(len(scores), 1),
            }
        )
    return out


def fetch_org_funder_agg_rows() -> list[dict[str, Any]]:
    """Org↔funder counts for rail decarb slice over REST."""
    from collections import Counter

    sb = _client()
    q = (
        sb.schema("atlas")
        .from_("projects")
        .select("lead_org_name, lead_funder")
        .contains("cpc_modes", ["rail"])
        .contains("cpc_themes", ["decarbonisation"])
    )
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        batch = q.range(offset, offset + page_size - 1).execute().data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    counter: Counter[tuple[str, str]] = Counter()
    for row in rows:
        org = (row.get("lead_org_name") or "").strip() or "Unknown org"
        funder = (row.get("lead_funder") or "").strip() or "Unknown funder"
        counter[(org, funder)] += 1

    return [
        {"org": org, "funder": funder, "project_count": count}
        for (org, funder), count in counter.most_common(40)
    ]
