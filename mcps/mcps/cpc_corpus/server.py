#!/usr/bin/env python3
"""
Atlas 5 — CPC-corpus MCP Server

Governed read-only corpus access layer over atlas + hive Supabase schemas.
Exposes corpus search tools to Atlas 5 agents via MCP.

Port: 7001 (streamable_http transport)
Run:  python mcps/cpc_corpus/server.py

Tools exposed:
  search_projects(query, limit)                  → atlas.projects semantic search
  search_live_calls(query, limit, open_only)     → atlas.live_calls semantic search
  evidence_for_claim(claim, limit, modes, themes)→ atlas.knowledge_chunks + documents
  search_hive_evidence(query, limit)             → hive.document_chunks + articles
  get_record_by_id(source_type, id)              → allowlisted record lookup
  get_project(project_id)                        → single atlas.projects record (legacy)
  search_hive(query, limit)                      → hive.articles header search (legacy)

SECURITY:
  SUPABASE_SERVICE_KEY / POSTGRES_URL read from env — never logged, never returned.
  All queries use explicit schema qualifiers (atlas / hive).
  No arbitrary SQL exposed to agents.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from dotenv import load_dotenv
load_dotenv()

from mcp.server.fastmcp import FastMCP
from mcps.cpc_corpus import queries

mcp = FastMCP(
    name="cpc-corpus",
    instructions=(
        "CPC-corpus provides semantic search over the Connected Places Catapult "
        "innovation corpus (atlas schema) and the HIVE climate adaptation database "
        "(hive schema). All returned IDs are verified real records. "
        "NEVER fabricate IDs — always call a search tool first, then use returned "
        "IDs in corpus_citations or hive_citations. "
        "Embedding model: OpenAI text-embedding-3-small (1536-dim)."
    ),
)


@mcp.tool()
def search_projects(query: str, limit: int = 10) -> list[dict]:
    """
    Search atlas.projects for historically funded or R&D projects matching the query.
    Uses pgvector semantic search (OpenAI text-embedding-3-small), falls back to ILIKE.

    Args:
        query: Natural language query (e.g. 'autonomous freight corridor')
        limit: Max results (default 10, max 50)

    Returns:
        Records with id, title, organisation, abstract, similarity, source_type
    """
    return queries.search_projects(query, limit=min(int(limit), 50))


@mcp.tool()
def search_live_calls(query: str, limit: int = 10, open_only: bool = True) -> list[dict]:
    """
    Search atlas.live_calls for live or recent funding/opportunity calls.
    Uses pgvector semantic search, falls back to ILIKE.

    Args:
        query: Natural language query (e.g. 'autonomous vehicle freight funding')
        limit: Max results (default 10, max 50)
        open_only: If true (default), only return calls with status='open'

    Returns:
        Records with id, title, funder, description, status, deadline, source_url, similarity
    """
    return queries.search_live_calls(query, limit=min(int(limit), 50), open_only=open_only)


@mcp.tool()
def evidence_for_claim(
    claim: str,
    limit: int = 5,
    modes: Optional[str] = None,
    themes: Optional[str] = None,
) -> list[dict]:
    """
    Search atlas.knowledge_chunks for policy, strategy, report or KB evidence.
    Joins to atlas.knowledge_documents for provenance metadata.
    Only approved documents are returned.

    Args:
        claim: The claim to find evidence for
        limit: Max results (default 5)
        modes: Comma-separated transport mode filter (e.g. 'rail,road') — optional
        themes: Comma-separated theme filter (e.g. 'decarbonisation') — optional

    Returns:
        Records with chunk_id, document_id, body, title, publisher, tier, similarity
    """
    modes_list = [m.strip() for m in modes.split(",")] if modes else None
    themes_list = [t.strip() for t in themes.split(",")] if themes else None
    return queries.evidence_for_claim(
        claim, limit=int(limit), modes=modes_list, themes=themes_list
    )


@mcp.tool()
def search_hive_evidence(query: str, limit: int = 10) -> list[dict]:
    """
    Search hive.document_chunks for HIVE case study and adaptation evidence.
    Joins to hive.articles for title/project metadata.

    Args:
        query: Natural language query
        limit: Max results (default 10, max 50)

    Returns:
        Records with chunk_id, article_id, body, source_title, title, similarity
    """
    return queries.search_hive_evidence(query, limit=min(int(limit), 50))


@mcp.tool()
def get_record_by_id(source_type: str, record_id: str) -> dict | None:
    """
    Fetch a full record by ID. Only allowlisted source_types are accepted.
    No arbitrary SQL — this is a governed lookup only.

    source_type must be one of:
      project, live_call, knowledge_doc, knowledge_chunk, hive_chunk, hive_article

    Args:
        source_type: Type of record to fetch
        record_id: UUID of the record

    Returns:
        Full record dict, or None if not found
    """
    return queries.get_record_by_id(source_type, record_id)


@mcp.tool()
def get_project(project_id: str) -> dict | None:
    """Retrieve a single atlas.projects record by UUID."""
    return queries.get_project(project_id)


@mcp.tool()
def search_hive(query: str, limit: int = 10) -> list[dict]:
    """
    Article-level HIVE search (legacy). Returns hive.articles header records.
    Prefer search_hive_evidence for chunk-level retrieval with embeddings.
    """
    return queries.search_hive(query, limit=min(int(limit), 50))


if __name__ == "__main__":
    port = int(os.environ.get("CPC_CORPUS_PORT", "7001"))
    print(f"[cpc-corpus MCP] Starting on port {port}", flush=True)
    mcp.run(transport="streamable-http", port=port)
