"""
CPC Corpus query functions for the Atlas clone dashboard.

All searches use OpenAI text-embedding-3-small (1536-dim) for pgvector semantic
search, with ILIKE keyword fallback when OPENAI_API_KEY is absent.

READ ONLY — SELECT queries only. No writes.
All queries use explicit schema qualifiers (atlas. / hive.).
"""
from __future__ import annotations

import os
import re
import warnings
from typing import Any, Optional

import psycopg2
import psycopg2.extras


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _conn():
    raw = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or ""
    conn_str = re.sub(r"[?&]sslmode=[^&]*", "", raw)
    is_local = "localhost" in raw or "127.0.0.1" in raw
    kwargs: dict = {}
    if not is_local:
        kwargs["sslmode"] = "require"
    return psycopg2.connect(conn_str, **kwargs)


def _query(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Embedding (OpenAI text-embedding-3-small — same model as corpus vectors)
# ---------------------------------------------------------------------------

def embed_query(text: str) -> Optional[str]:
    """
    Embed text with OpenAI text-embedding-3-small.
    Returns pgvector-compatible '[x,y,...]' string, or None if key absent.
    ILIKE fallback is used when this returns None.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        warnings.warn(
            "[corpus] OPENAI_API_KEY not set — using ILIKE keyword search. "
            "Set OPENAI_API_KEY for pgvector semantic search.",
            stacklevel=2,
        )
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        resp = client.embeddings.create(
            input=[text[:8000]],
            model="text-embedding-3-small",
        )
        vec = resp.data[0].embedding
        return "[" + ",".join(str(v) for v in vec) + "]"
    except Exception as e:
        warnings.warn(f"[corpus] Embedding failed ({e}) — falling back to ILIKE", stacklevel=2)
        return None


# ---------------------------------------------------------------------------
# atlas.projects
# ---------------------------------------------------------------------------

def search_projects(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Semantic search over atlas.projects. Falls back to ILIKE."""
    limit = min(int(limit), 50)
    embedding = embed_query(query)

    if embedding:
        rows = _query(
            """
            SELECT id, title, lead_org_name, abstract, transport_relevance_score,
                   (1 - (embedding <=> %s::vector))::float AS similarity
            FROM   atlas.projects
            WHERE  embedding IS NOT NULL
            ORDER  BY embedding <=> %s::vector
            LIMIT  %s
            """,
            (embedding, embedding, limit),
        )
        return [
            {
                "id": str(r["id"]),
                "title": r.get("title") or "",
                "organisation": r.get("lead_org_name") or "",
                "abstract": (r.get("abstract") or "")[:300],
                "transport_relevance_score": r.get("transport_relevance_score"),
                "similarity": round(float(r.get("similarity") or 0), 4),
                "source_type": "project",
            }
            for r in rows
        ]
    else:
        term = f"%{query}%"
        rows = _query(
            """
            SELECT id, title, lead_org_name, abstract, transport_relevance_score
            FROM   atlas.projects
            WHERE  title ILIKE %s OR abstract ILIKE %s
            ORDER  BY transport_relevance_score DESC NULLS LAST
            LIMIT  %s
            """,
            (term, term, limit),
        )
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


def get_project(project_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single atlas.projects record by UUID."""
    rows = _query(
        """
        SELECT id, title, lead_org_name, abstract, transport_relevance_score
        FROM   atlas.projects
        WHERE  id = %s::uuid
        LIMIT  1
        """,
        (project_id,),
    )
    if not rows:
        return None
    r = rows[0]
    return {
        "id": str(r["id"]),
        "title": r.get("title") or "",
        "organisation": r.get("lead_org_name") or "",
        "abstract": (r.get("abstract") or "")[:500],
        "transport_relevance_score": r.get("transport_relevance_score"),
        "source_type": "project",
    }


# ---------------------------------------------------------------------------
# atlas.live_calls
# ---------------------------------------------------------------------------

def search_live_calls(
    query: str,
    limit: int = 10,
    open_only: bool = True,
) -> list[dict[str, Any]]:
    """Semantic search over atlas.live_calls. Falls back to ILIKE."""
    limit = min(int(limit), 50)
    embedding = embed_query(query)

    if embedding:
        if open_only:
            sql = """
                SELECT id, title, funder, description, status, deadline, source_url,
                       (1 - (embedding <=> %s::vector))::float AS similarity
                FROM   atlas.live_calls
                WHERE  embedding IS NOT NULL AND status = 'open'
                ORDER  BY embedding <=> %s::vector
                LIMIT  %s
            """
        else:
            sql = """
                SELECT id, title, funder, description, status, deadline, source_url,
                       (1 - (embedding <=> %s::vector))::float AS similarity
                FROM   atlas.live_calls
                WHERE  embedding IS NOT NULL
                ORDER  BY embedding <=> %s::vector
                LIMIT  %s
            """
        rows = _query(sql, (embedding, embedding, limit))
    else:
        term = f"%{query}%"
        if open_only:
            sql = """
                SELECT id, title, funder, description, status, deadline, source_url
                FROM   atlas.live_calls
                WHERE  (title ILIKE %s OR description ILIKE %s) AND status = 'open'
                ORDER  BY deadline ASC NULLS LAST
                LIMIT  %s
            """
        else:
            sql = """
                SELECT id, title, funder, description, status, deadline, source_url
                FROM   atlas.live_calls
                WHERE  title ILIKE %s OR description ILIKE %s
                ORDER  BY deadline ASC NULLS LAST
                LIMIT  %s
            """
        rows = _query(sql, (term, term, limit))

    return [
        {
            "id": str(r["id"]),
            "title": r.get("title") or "",
            "funder": r.get("funder") or "",
            "description": (r.get("description") or "")[:300],
            "status": r.get("status") or "",
            "deadline": str(r["deadline"]) if r.get("deadline") else None,
            "source_url": r.get("source_url") or "",
            "similarity": round(float(r["similarity"]), 4) if r.get("similarity") is not None else None,
            "source_type": "live_call",
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# atlas.knowledge_chunks + atlas.knowledge_documents
# ---------------------------------------------------------------------------

def evidence_for_claim(
    claim: str,
    limit: int = 5,
    modes: Optional[list[str]] = None,
    themes: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    """
    Semantic search over atlas.knowledge_chunks joined to atlas.knowledge_documents.
    Only approved documents. Falls back to ILIKE when no embedding available.
    modes/themes: optional array-overlap filters on the parent document.
    """
    limit = min(int(limit), 20)
    embedding = embed_query(claim)

    if embedding:
        filters = ["c.embedding IS NOT NULL", "d.status = 'approved'"]
        params: list[Any] = [embedding]

        if modes:
            filters.append("%s::text[] && d.modes")
            params.append(modes)
        if themes:
            filters.append("%s::text[] && d.themes")
            params.append(themes)

        where = " AND ".join(filters)
        params.extend([embedding, limit])

        rows = _query(
            f"""
            SELECT c.id AS chunk_id, c.document_id, c.body,
                   d.title, d.publisher, d.tier, d.source_type AS doc_source_type,
                   d.published_on::text AS published_on, d.modes, d.themes,
                   (1 - (c.embedding <=> %s::vector))::float AS similarity
            FROM   atlas.knowledge_chunks c
            JOIN   atlas.knowledge_documents d ON d.id = c.document_id
            WHERE  {where}
            ORDER  BY c.embedding <=> %s::vector
            LIMIT  %s
            """,
            tuple(params),
        )
        return [
            {
                "chunk_id": str(r["chunk_id"]),
                "document_id": str(r["document_id"]) if r.get("document_id") else None,
                "body": (r.get("body") or "")[:400],
                "title": r.get("title") or "",
                "publisher": r.get("publisher") or "",
                "tier": r.get("tier") or "",
                "doc_source_type": r.get("doc_source_type") or "",
                "published_on": r.get("published_on"),
                "modes": r.get("modes") or [],
                "themes": r.get("themes") or [],
                "similarity": round(float(r.get("similarity") or 0), 4),
                "source_type": "knowledge_doc",
            }
            for r in rows
        ]
    else:
        key_terms = [t for t in claim.split() if len(t) > 4][:3] or claim.split()[:2]
        conditions = " OR ".join("c.body ILIKE %s" for _ in key_terms)
        kw_params = tuple(f"%{t}%" for t in key_terms)
        try:
            rows = _query(
                f"""
                SELECT c.id AS chunk_id, c.document_id, c.body,
                       d.title, d.publisher, d.tier, d.source_type AS doc_source_type,
                       d.published_on::text AS published_on, d.modes, d.themes
                FROM   atlas.knowledge_chunks c
                JOIN   atlas.knowledge_documents d ON d.id = c.document_id
                WHERE  d.status = 'approved' AND ({conditions})
                LIMIT  %s
                """,
                kw_params + (limit,),
            )
            return [
                {
                    "chunk_id": str(r["chunk_id"]),
                    "document_id": str(r["document_id"]) if r.get("document_id") else None,
                    "body": (r.get("body") or "")[:400],
                    "title": r.get("title") or "",
                    "publisher": r.get("publisher") or "",
                    "tier": r.get("tier") or "",
                    "doc_source_type": r.get("doc_source_type") or "",
                    "published_on": r.get("published_on"),
                    "modes": r.get("modes") or [],
                    "themes": r.get("themes") or [],
                    "similarity": None,
                    "source_type": "knowledge_doc",
                }
                for r in rows
            ]
        except Exception:
            return []


# ---------------------------------------------------------------------------
# hive.document_chunks + hive.articles
# ---------------------------------------------------------------------------

def search_hive_evidence(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Semantic search over hive.document_chunks joined to hive.articles.
    Returns case study / adaptation evidence chunks.
    """
    limit = min(int(limit), 50)
    embedding = embed_query(query)

    if embedding:
        rows = _query(
            """
            SELECT c.id AS chunk_id, c.article_id, c.chunk_index, c.chunk_text,
                   c.section_key, c.metadata,
                   a.project_title, a.measure_title,
                   (1 - (c.embedding <=> %s::vector))::float AS similarity
            FROM   hive.document_chunks c
            LEFT   JOIN hive.articles a ON a.id = c.article_id
            WHERE  c.embedding IS NOT NULL
            ORDER  BY c.embedding <=> %s::vector
            LIMIT  %s
            """,
            (embedding, embedding, limit),
        )
    else:
        term = f"%{query}%"
        rows = _query(
            """
            SELECT c.id AS chunk_id, c.article_id, c.chunk_index, c.chunk_text,
                   c.section_key, c.metadata,
                   a.project_title, a.measure_title
            FROM   hive.document_chunks c
            LEFT   JOIN hive.articles a ON a.id = c.article_id
            WHERE  c.chunk_text ILIKE %s
               OR  a.project_title ILIKE %s
               OR  a.measure_title ILIKE %s
            LIMIT  %s
            """,
            (term, term, term, limit),
        )

    return [
        {
            "chunk_id": str(r["chunk_id"]),
            "article_id": str(r["article_id"]) if r.get("article_id") else None,
            "body": (r.get("chunk_text") or "")[:400],
            "section_key": r.get("section_key") or "",
            "title": r.get("project_title") or r.get("measure_title") or "",
            "similarity": round(float(r["similarity"]), 4) if r.get("similarity") is not None else None,
            "source_type": "hive_chunk",
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Allowlisted record lookup
# ---------------------------------------------------------------------------

_ALLOWED: dict[str, tuple[str, list[str]]] = {
    "project": (
        "atlas.projects",
        ["id", "title", "lead_org_name", "abstract", "transport_relevance_score"],
    ),
    "live_call": (
        "atlas.live_calls",
        ["id", "title", "funder", "description", "status", "deadline", "source_url"],
    ),
    "knowledge_doc": (
        "atlas.knowledge_documents",
        ["id", "title", "publisher", "source_type", "tier", "published_on", "summary", "modes", "themes"],
    ),
    "knowledge_chunk": (
        "atlas.knowledge_chunks",
        ["id", "document_id", "body", "chunk_index"],
    ),
    "hive_chunk": (
        "hive.document_chunks",
        ["id", "article_id", "chunk_index", "chunk_text", "section_key", "metadata"],
    ),
    "hive_article": (
        "hive.articles",
        ["id", "project_title", "measure_title"],
    ),
}


def get_record_by_id(source_type: str, record_id: str) -> Optional[dict[str, Any]]:
    """
    Fetch a full record by ID. Only allowlisted source_types are accepted.
    Raises ValueError for unknown source_type — no arbitrary SQL.
    """
    if source_type not in _ALLOWED:
        raise ValueError(
            f"Unknown source_type {source_type!r}. "
            f"Allowed: {sorted(_ALLOWED)}"
        )
    table, cols = _ALLOWED[source_type]
    select = ", ".join(cols)
    rows = _query(f"SELECT {select} FROM {table} WHERE id = %s::uuid LIMIT 1", (record_id,))
    if not rows:
        return None
    r = rows[0]
    return {k: (str(v) if hasattr(v, "hex") else v) for k, v in r.items()}


# ---------------------------------------------------------------------------
# Evidence coverage summary (local computation — no DB call)
# ---------------------------------------------------------------------------

def evidence_coverage_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute evidence coverage and suggest a confidence tier from retrieved results.
    Runs locally — no DB call. Called automatically after each search.
    """
    projects = [r for r in results if r.get("source_type") == "project"]
    live_calls = [r for r in results if r.get("source_type") == "live_call"]
    knowledge_docs = [r for r in results if r.get("source_type") == "knowledge_doc"]
    hive_chunks = [r for r in results if r.get("source_type") == "hive_chunk"]

    similarities = [
        float(r["similarity"])
        for r in results
        if r.get("similarity") is not None
    ]
    top_sim = max(similarities) if similarities else 0.0
    avg_sim = sum(similarities) / len(similarities) if similarities else 0.0

    source_types_found = sum([
        bool(projects), bool(live_calls), bool(knowledge_docs), bool(hive_chunks)
    ])
    total = len(results)

    gaps = []
    if not projects:
        gaps.append("historical_projects")
    if not live_calls:
        gaps.append("live_opportunities")
    if not knowledge_docs:
        gaps.append("policy_evidence")
    if not hive_chunks:
        gaps.append("case_study_evidence")

    # Confidence tier rules
    if total == 0 or (total <= 1 and top_sim < 0.6):
        tier = "Speculative"
    elif total >= 5 and source_types_found >= 3 and top_sim >= 0.8:
        tier = "Robust"
    elif total >= 3 and source_types_found >= 2:
        tier = "Supported"
    else:
        tier = "Indicative"

    if total == 0 or (total < 3 and source_types_found < 2):
        note = "thin"
    elif total >= 6 and source_types_found >= 3:
        note = "strong"
    else:
        note = "adequate"

    return {
        "projects_found": len(projects),
        "live_calls_found": len(live_calls),
        "knowledge_docs_found": len(knowledge_docs),
        "hive_chunks_found": len(hive_chunks),
        "source_diversity": source_types_found,
        "top_similarity": round(top_sim, 4),
        "average_similarity": round(avg_sim, 4),
        "evidence_gaps": gaps,
        "suggested_confidence_tier": tier,
        "coverage_note": note,
    }
