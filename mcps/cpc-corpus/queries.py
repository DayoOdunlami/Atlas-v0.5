"""
CPC-corpus MCP — Supabase query implementations.

All queries use explicit schema qualifiers:
  supabase.schema('atlas').from_('projects')
  supabase.schema('hive').from_('articles')

Never supabase.from_() without a schema.
Never use OpenAI — text search only for D3 (vector search layered at D5).
"""
from __future__ import annotations

import os
from typing import Any

from supabase import create_client, Client


def _client() -> Client:
    """Return an admin Supabase client using SUPABASE_SERVICE_KEY."""
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# atlas.projects
# ---------------------------------------------------------------------------

def search_projects(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Full-text search over atlas.projects title + abstract.

    Returns records with id, title, lead_org_name, abstract (first 300 chars).
    All returned IDs are verified real UUIDs in atlas.projects.
    """
    sb = _client()
    # Try OR-based ilike across title and abstract
    result = (
        sb.schema("atlas")
        .from_("projects")
        .select("id, title, lead_org_name, abstract, transport_relevance_score")
        .or_(f"title.ilike.%{query}%,abstract.ilike.%{query}%")
        .order("transport_relevance_score", desc=True, nulls_first=False)
        .limit(limit)
        .execute()
    )
    rows = result.data or []
    # Trim abstract to 300 chars to keep responses compact
    return [
        {
            "id": r["id"],
            "title": r.get("title") or "",
            "organisation": r.get("lead_org_name") or "",
            "abstract": (r.get("abstract") or "")[:300],
            "transport_relevance_score": r.get("transport_relevance_score"),
        }
        for r in rows
    ]


def get_project(project_id: str) -> dict[str, Any] | None:
    """
    Fetch a single atlas.projects record by UUID.
    Returns None if not found.
    """
    sb = _client()
    result = (
        sb.schema("atlas")
        .from_("projects")
        .select("id, title, lead_org_name, abstract, start_date, end_date, transport_relevance_score")
        .eq("id", project_id)
        .maybeSingle()
        .execute()
    )
    row = result.data
    if not row:
        return None
    return {
        "id": row["id"],
        "title": row.get("title") or "",
        "organisation": row.get("lead_org_name") or "",
        "abstract": (row.get("abstract") or "")[:500],
        "start_date": row.get("start_date"),
        "end_date": row.get("end_date"),
        "transport_relevance_score": row.get("transport_relevance_score"),
    }


def related_projects(project_id: str, limit: int = 5) -> list[dict[str, Any]]:
    """
    Find projects with similar titles using text-based heuristics.
    Vector similarity search will be added at D5.
    """
    # Fetch the anchor project first
    anchor = get_project(project_id)
    if not anchor or not anchor.get("title"):
        return []

    # Use the first significant word from the title as a search term
    title_words = [w for w in anchor["title"].split() if len(w) > 4]
    if not title_words:
        return []

    term = title_words[0]
    sb = _client()
    result = (
        sb.schema("atlas")
        .from_("projects")
        .select("id, title, lead_org_name")
        .ilike("title", f"%{term}%")
        .neq("id", project_id)
        .limit(limit)
        .execute()
    )
    return [
        {
            "id": r["id"],
            "title": r.get("title") or "",
            "organisation": r.get("lead_org_name") or "",
        }
        for r in (result.data or [])
    ]


# ---------------------------------------------------------------------------
# atlas.knowledge_chunks
# ---------------------------------------------------------------------------

def evidence_for_claim(claim: str, limit: int = 5) -> list[dict[str, Any]]:
    """
    Search atlas.knowledge_chunks for evidence supporting a claim.
    Uses full-text search on the body column.
    """
    sb = _client()
    # Split claim into key terms for ilike matching
    key_terms = [t for t in claim.split() if len(t) > 4][:3]
    if not key_terms:
        key_terms = claim.split()[:2]

    # Build OR filter across terms
    filter_expr = ",".join(f"body.ilike.%{t}%" for t in key_terms)
    result = (
        sb.schema("atlas")
        .from_("knowledge_chunks")
        .select("id, document_id, body")
        .or_(filter_expr)
        .limit(limit)
        .execute()
    )
    return [
        {
            "id": r["id"],
            "document_id": r.get("document_id"),
            "body": (r.get("body") or "")[:400],
        }
        for r in (result.data or [])
    ]


# ---------------------------------------------------------------------------
# hive.articles
# ---------------------------------------------------------------------------

def search_hive(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Full-text search over hive.articles.
    Returns records with article_id (hive.articles.id), title, transport_mode.

    Note: hive.articles has no bare 'title' column.
    title := project_title (fallback: measure_title)
    """
    sb = _client()
    result = (
        sb.schema("hive")
        .from_("articles")
        .select("id, project_title, measure_title, transport_mode")
        .or_(f"project_title.ilike.%{query}%,measure_title.ilike.%{query}%")
        .limit(limit)
        .execute()
    )
    return [
        {
            "article_id": r["id"],
            "title": r.get("project_title") or r.get("measure_title") or "",
            "transport_mode": r.get("transport_mode"),
        }
        for r in (result.data or [])
    ]
