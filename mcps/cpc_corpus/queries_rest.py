"""
CPC corpus queries via Supabase REST (HTTPS port 443).

Used when direct Postgres (6543/5432) is blocked. Keyword ILIKE always available;
semantic search uses atlas.search_projects_by_embedding RPC when deployed.
"""
from __future__ import annotations

import os
import re
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


def _keyword_terms(query: str) -> list[str]:
    """Progressive ILIKE terms — long questions rarely match title/abstract verbatim."""
    q = sanitize_ilike_term(query)
    terms: list[str] = []
    if q:
        terms.append(q)
    ql = (query or "").lower()
    for token in (
        "decarbonisation",
        "decarbonization",
        "rail decarbonisation",
        "maritime decarbonisation",
        "aviation decarbonisation",
        "hydrogen",
        "transport innovation",
        "rail",
        "maritime",
        "aviation",
    ):
        if token in ql and token not in terms:
            terms.append(token)
    if "decarbon" in ql and "decarbonisation" not in terms:
        terms.append("decarbon")
    # Last resort: single high-signal word from the query
    if len(terms) <= 1:
        for word in re.findall(r"[a-z]{5,}", ql):
            if word not in ("which", "should", "prioritise", "prioritize", "transport", "there"):
                terms.append(word)
                break
    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        key = t.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(t.strip())
    return out[:6]


def search_projects_keyword(query: str, limit: int = 10) -> list[dict[str, Any]]:
    sb = _client()
    for term in _keyword_terms(query):
        pattern = f"%{sanitize_ilike_term(term)}%"
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
        if rows:
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
    return []


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
