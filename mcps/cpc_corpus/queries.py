"""
CPC-corpus MCP — PostgreSQL query implementations with HTTPS REST fallback.

Primary: direct PostgreSQL (POSTGRES_URL) for pgvector semantic search.
Fallback: Supabase REST on port 443 when Postgres TCP is blocked (corp VPN).

All queries use explicit schema qualifiers on atlas / hive.
Embedding: OpenAI text-embedding-3-small (1536-dim).

READ ONLY — SELECT queries only. Never INSERT/UPDATE/DELETE.
"""
from __future__ import annotations

import os
import re
import sys
import warnings
from pathlib import Path
from typing import Any, Optional

import psycopg2
import psycopg2.extras

from mcps.cpc_corpus import transport
from mcps.cpc_corpus import queries_rest

# Load .env from agents/ or repo root so corpus search works in all runners
# (langgraph dev, pytest, direct python -c, etc.)
try:
    from dotenv import load_dotenv
    _here = Path(__file__).resolve()
    for _candidate in [
        _here.parent.parent.parent / "agents" / ".env",  # mcps/cpc_corpus → repo/agents/.env
        _here.parent.parent.parent / ".env.local",        # repo root .env.local
        _here.parent.parent.parent / ".env",              # repo root .env
    ]:
        if _candidate.exists():
            load_dotenv(_candidate, override=False)
            break
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _conn():
    """Return a psycopg2 connection using POSTGRES_URL or DATABASE_URL."""
    raw = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or ""
    if not raw.strip():
        raise transport.PostgresUnavailable("POSTGRES_URL / DATABASE_URL not set")
    conn_str = re.sub(r"[?&]sslmode=[^&]*", "", raw)
    is_local = "localhost" in raw or "127.0.0.1" in raw
    kwargs: dict = {}
    if not is_local:
        kwargs["sslmode"] = "require"
        kwargs["connect_timeout"] = int(os.environ.get("CORPUS_PG_CONNECT_TIMEOUT", "8"))
    return psycopg2.connect(conn_str, **kwargs)


def _pg_query(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Execute a SELECT on Postgres; raises PostgresUnavailable on network failure."""
    try:
        conn = _conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()
    except transport.PostgresUnavailable:
        raise
    except (psycopg2.OperationalError, psycopg2.InterfaceError, OSError) as exc:
        raise transport.PostgresUnavailable(str(exc)) from exc


def _query(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Back-compat alias — Postgres only (callers should use _pg_query + REST fallback)."""
    return _pg_query(sql, params)


def _rest_fallback_projects(
    query: str,
    limit: int,
    embedding: Optional[str],
) -> list[dict[str, Any]]:
    """HTTPS semantic search only — no ILIKE keyword fallback."""
    if not transport.rest_configured():
        transport.set_transport("unavailable")
        return []
    vec_source = embedding or embed_query(query)
    if not vec_source:
        transport.set_transport(
            "unavailable",
            error="OPENAI_API_KEY required for semantic corpus search over HTTPS",
        )
        return []
    try:
        vec = queries_rest.parse_embedding_string(vec_source)
        rows = queries_rest.search_projects_vector(vec, limit)
        if rows:
            transport.set_transport("rest_vector")
            return rows
    except Exception as exc:
        transport.set_transport("unavailable", error=str(exc)[:120])
        return []
    transport.set_transport("unavailable", error="semantic search returned no projects")
    return []


def _rest_fallback_live_calls(query: str, limit: int, open_only: bool) -> list[dict[str, Any]]:
    if not transport.rest_configured():
        transport.set_transport("unavailable")
        return []
    transport.set_transport("rest_keyword")
    return queries_rest.search_live_calls_keyword(query, limit, open_only=open_only)


# ---------------------------------------------------------------------------
# Embedding (OpenAI text-embedding-3-small — same model as corpus vectors)
# ---------------------------------------------------------------------------

def embed_query(text: str) -> Optional[str]:
    """
    Embed text using OpenAI text-embedding-3-small (1536-dim).
    Returns pgvector-compatible '[x,y,...]' string, or None if key absent.
    All search functions fall back to ILIKE when this returns None.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        warnings.warn(
            "[cpc-corpus] OPENAI_API_KEY not set — using ILIKE keyword search. "
            "Set OPENAI_API_KEY to enable pgvector semantic search.",
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
        warnings.warn(
            f"[cpc-corpus] Embedding failed ({e}) — falling back to ILIKE",
            stacklevel=2,
        )
        return None


# ---------------------------------------------------------------------------
# atlas.projects
# ---------------------------------------------------------------------------

def search_projects(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Semantic search over atlas.projects (pgvector / HTTPS RPC only).
    Requires OPENAI_API_KEY for embeddings. No ILIKE keyword fallback.
    Default: REST/443 first (portable across firewalls); Postgres optional secondary.
    """
    transport.set_operation("search_projects")
    limit = min(int(limit), 50)
    embedding = embed_query(query)

    if transport.rest_configured() and transport.corpus_rest_first():
        rows = _rest_fallback_projects(query, limit, embedding)
        if rows:
            return rows

    if embedding and (transport.postgres_secondary_enabled() or not transport.corpus_rest_first()):
        try:
            rows = _pg_query(
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
            transport.set_transport("postgres")
            return [
                {
                    "id": str(r["id"]),
                    "title": r.get("title") or "",
                    "organisation": r.get("lead_org_name") or "",
                    "abstract": (r.get("abstract") or "")[:300],
                    "transport_relevance_score": (
                        float(r["transport_relevance_score"])
                        if r.get("transport_relevance_score") is not None
                        else None
                    ),
                    "similarity": round(float(r.get("similarity") or 0), 4),
                    "source_type": "project",
                }
                for r in rows
            ]
        except transport.PostgresUnavailable as exc:
            transport.set_transport("unavailable", error=str(exc))

    if not embedding:
        transport.set_transport(
            "unavailable",
            error="OPENAI_API_KEY not set — semantic corpus search unavailable",
        )
    return _rest_fallback_projects(query, limit, embedding)


def get_project(project_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single atlas.projects record by UUID. Returns None if not found."""
    transport.set_operation("get_project")
    if transport.rest_configured() and transport.corpus_rest_first():
        row = queries_rest.get_project(project_id)
        if row:
            transport.set_transport("rest_keyword")
            return row
    try:
        rows = _pg_query(
            """
            SELECT id, title, lead_org_name, abstract, transport_relevance_score
            FROM   atlas.projects
            WHERE  id = %s::uuid
            LIMIT  1
            """,
            (project_id,),
        )
        transport.set_transport("postgres")
    except transport.PostgresUnavailable:
        transport.set_transport("rest_keyword")
        return queries_rest.get_project(project_id) if transport.rest_configured() else None

    if not rows:
        if transport.rest_configured():
            transport.set_transport("rest_keyword")
            return queries_rest.get_project(project_id)
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
    """
    Semantic search over atlas.live_calls.
    open_only=True (default) filters to status='open' — use for Opportunity Brief / Investment Ask.
    Falls back to ILIKE when no embedding.
    """
    limit = min(int(limit), 50)
    embedding = embed_query(query)
    transport.set_operation("search_live_calls")

    try:
        if embedding:
            if open_only:
                sql = """
                    SELECT id, title, funder, description, status, deadline, source_url,
                           (1 - (embedding <=> %s::vector))::float AS similarity
                    FROM   atlas.live_calls
                    WHERE  embedding IS NOT NULL AND status = 'open'
                      AND (relevance_tag IS NULL OR relevance_tag != 'irrelevant')
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  %s
                """
            else:
                sql = """
                    SELECT id, title, funder, description, status, deadline, source_url,
                           (1 - (embedding <=> %s::vector))::float AS similarity
                    FROM   atlas.live_calls
                    WHERE  embedding IS NOT NULL
                      AND (relevance_tag IS NULL OR relevance_tag != 'irrelevant')
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  %s
                """
            rows = _pg_query(sql, (embedding, embedding, limit))
        else:
            term = f"%{query}%"
            if open_only:
                sql = """
                    SELECT id, title, funder, description, status, deadline, source_url
                    FROM   atlas.live_calls
                    WHERE  (title ILIKE %s OR description ILIKE %s) AND status = 'open'
                      AND (relevance_tag IS NULL OR relevance_tag != 'irrelevant')
                    ORDER  BY deadline ASC NULLS LAST
                    LIMIT  %s
                """
            else:
                sql = """
                    SELECT id, title, funder, description, status, deadline, source_url
                    FROM   atlas.live_calls
                    WHERE  (title ILIKE %s OR description ILIKE %s)
                      AND (relevance_tag IS NULL OR relevance_tag != 'irrelevant')
                    ORDER  BY deadline ASC NULLS LAST
                    LIMIT  %s
                """
            rows = _pg_query(sql, (term, term, limit))

        transport.set_transport("postgres")
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
    except transport.PostgresUnavailable:
        return _rest_fallback_live_calls(query, limit, open_only)


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
    Only approved documents. Falls back to ILIKE when no embedding.
    modes/themes: optional array-overlap filters on the parent document.
    """
    limit = min(int(limit), 20)
    embedding = embed_query(claim)

    if embedding:
        filters = [
            "c.embedding IS NOT NULL",
            "d.status = 'approved'",
            "(d.validation_tier IS NULL OR d.validation_tier IN ('T1_anchor', 'T2_embedded', 'T3_thin'))",
        ]
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
                   d.title, d.publisher, d.tier, d.validation_tier,
                   d.source_url,
                   d.source_type AS doc_source_type,
                   d.published_on::text AS published_on,
                   d.modes, d.themes,
                   (1 - (c.embedding <=> %s::vector))::float AS similarity
            FROM   atlas.knowledge_chunks c
            JOIN   atlas.knowledge_documents d ON d.id = c.document_id
            WHERE  {where}
            ORDER BY
              CASE d.validation_tier
                WHEN 'T1_anchor' THEN 0
                WHEN 'T2_embedded' THEN 1
                ELSE 2
              END,
              c.embedding <=> %s::vector
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
                "validation_tier": r.get("validation_tier") or "",
                "source_url": r.get("source_url") or "",
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
                       d.title, d.publisher, d.tier, d.validation_tier,
                       d.source_url,
                       d.source_type AS doc_source_type,
                       d.published_on::text AS published_on,
                       d.modes, d.themes
                FROM   atlas.knowledge_chunks c
                JOIN   atlas.knowledge_documents d ON d.id = c.document_id
                WHERE  d.status = 'approved'
                  AND (d.validation_tier IS NULL OR d.validation_tier IN ('T1_anchor', 'T2_embedded', 'T3_thin'))
                  AND ({conditions})
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
                    "validation_tier": r.get("validation_tier") or "",
                    "source_url": r.get("source_url") or "",
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
    Falls back to ILIKE when no embedding.
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
# atlas.evidence_containers + atlas.claims — CPC internal capability corpus
# ---------------------------------------------------------------------------

def search_cpc_evidence_containers(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search atlas.evidence_containers for CPC internal project/capability records.
    Used for CPC-inward queries (Decision 3 Rule A).
    """
    limit = min(int(limit), 20)
    embedding = embed_query(query)
    if embedding:
        rows = _query(
            """
            SELECT id, description, business_unit, mode_or_focus_area, customer_or_funder,
                   delivery_status, cpc_role, corpus_tag,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM atlas.evidence_containers
            WHERE corpus_tag = 'cpc_v0_1' AND is_active IS NOT FALSE
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (embedding, embedding, limit),
        )
    else:
        term = f"%{query}%"
        rows = _query(
            """
            SELECT id, description, business_unit, mode_or_focus_area, customer_or_funder,
                   delivery_status, cpc_role, corpus_tag,
                   NULL::float AS similarity
            FROM atlas.evidence_containers
            WHERE corpus_tag = 'cpc_v0_1' AND is_active IS NOT FALSE
              AND (description ILIKE %s OR business_unit ILIKE %s OR mode_or_focus_area ILIKE %s)
            LIMIT %s
            """,
            (term, term, term, limit),
        )

    return [
        {
            "id": str(r["id"]),
            "title": (r.get("description") or r.get("business_unit") or "CPC evidence")[:120],
            "organisation": "Connected Places Catapult",
            "business_unit": r.get("business_unit"),
            "mode_or_focus_area": r.get("mode_or_focus_area"),
            "score": round(float(r["similarity"]), 4) if r.get("similarity") is not None else 0.55,
            "source_type": "cpc_internal",
            "source_label": "CPC internal — evidence_containers",
        }
        for r in rows
    ]


def search_cpc_claims(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search atlas.claims for structured CPC capability claims."""
    limit = min(int(limit), 20)
    embedding = embed_query(query)
    if embedding:
        rows = _query(
            """
            SELECT id, claim_text, claim_domain, confidence_tier, source_label,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM atlas.claims
            WHERE corpus_tag = 'cpc_v0_1'
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (embedding, embedding, limit),
        )
    else:
        term = f"%{query}%"
        rows = _query(
            """
            SELECT id, claim_text, claim_domain, confidence_tier, source_label,
                   NULL::float AS similarity
            FROM atlas.claims
            WHERE corpus_tag = 'cpc_v0_1'
              AND (claim_text ILIKE %s OR claim_domain ILIKE %s)
            LIMIT %s
            """,
            (term, term, limit),
        )

    return [
        {
            "id": str(r["id"]),
            "title": (r.get("claim_text") or "")[:120],
            "organisation": "Connected Places Catapult",
            "claim_domain": r.get("claim_domain"),
            "confidence_tier": r.get("confidence_tier"),
            "score": round(float(r["similarity"]), 4) if r.get("similarity") is not None else 0.5,
            "source_type": "cpc_claim",
            "source_label": "CPC internal — claims",
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
    Fetch a full record by ID. Only allowlisted source_types accepted.
    Raises ValueError for unknown source_type — no arbitrary SQL.
    """
    if source_type not in _ALLOWED:
        raise ValueError(
            f"Unknown source_type {source_type!r}. "
            f"Allowed: {sorted(_ALLOWED)}"
        )
    table, cols = _ALLOWED[source_type]
    select = ", ".join(cols)
    rows = _query(
        f"SELECT {select} FROM {table} WHERE id = %s::uuid LIMIT 1",
        (record_id,),
    )
    if not rows:
        return None
    r = rows[0]
    return {k: (str(v) if hasattr(v, "hex") else v) for k, v in r.items()}


# ---------------------------------------------------------------------------
# Kept for backward compatibility
# ---------------------------------------------------------------------------

def search_hive(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Article-level HIVE search (legacy). Prefer search_hive_evidence for chunk-level retrieval."""
    transport.set_operation("search_hive")
    term = f"%{query}%"
    try:
        rows = _pg_query(
            """
            SELECT id, project_title, measure_title
            FROM   hive.articles
            WHERE  project_title ILIKE %s OR measure_title ILIKE %s
            LIMIT  %s
            """,
            (term, term, min(int(limit), 50)),
        )
        transport.set_transport("postgres")
    except transport.PostgresUnavailable:
        if not transport.rest_configured():
            transport.set_transport("unavailable")
            return []
        transport.set_transport("rest_keyword")
        return queries_rest.search_hive_keyword(query, min(int(limit), 50))

    return [
        {
            "article_id": str(r["id"]),
            "title": r.get("project_title") or r.get("measure_title") or "",
            "source_type": "hive_article",
        }
        for r in rows
    ]
