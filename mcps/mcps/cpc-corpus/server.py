#!/usr/bin/env python3
"""
Atlas 5 — CPC-corpus MCP Server

Semantic wrapper over atlas + hive Supabase schemas.
Exposes corpus search tools to Atlas 5 agents via MCP.

Port: 7001 (streamable_http transport)
Run:  python -m mcps.cpc-corpus.server
  OR: uvicorn mcps.cpc_corpus.server:app  (if using ASGI mount)

Tools exposed:
  search_projects(query, limit)        → atlas.projects full-text search
  get_project(project_id)              → single atlas.projects record
  related_projects(project_id, limit)  → title-based related projects
  evidence_for_claim(claim, limit)     → atlas.knowledge_chunks search
  search_hive(query, limit)            → hive.articles full-text search

SECURITY:
  SUPABASE_SERVICE_KEY is read from env — never logged, never returned to client.
  All queries use explicit schema qualifiers (atlas / hive).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure project root is on path when running from /mcps/cpc-corpus/
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from dotenv import load_dotenv
load_dotenv()

from mcp.server.fastmcp import FastMCP

from mcps.cpc_corpus import queries  # noqa: E402 — after sys.path setup

# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    name="cpc-corpus",
    instructions=(
        "CPC-corpus provides semantic search over the Connected Places Catapult "
        "innovation corpus (atlas schema) and the HIVE climate adaptation database "
        "(hive schema). All returned IDs are verified real records. "
        "Never fabricate IDs — always call search_projects or search_hive first, "
        "then use returned IDs in corpus_citations or hive_citations."
    ),
)


@mcp.tool()
def search_projects(query: str, limit: int = 10) -> list[dict]:
    """
    Search atlas.projects for projects matching the query.

    Args:
        query: Natural language search query (e.g. 'rail decarbonisation')
        limit: Maximum number of results (default 10, max 50)

    Returns:
        List of project records with id, title, organisation, abstract
    """
    limit = min(int(limit), 50)
    return queries.search_projects(query, limit=limit)


@mcp.tool()
def get_project(project_id: str) -> dict | None:
    """
    Retrieve a single atlas.projects record by UUID.

    Args:
        project_id: Valid UUID from atlas.projects.id

    Returns:
        Project record with id, title, organisation, abstract, dates
        or None if not found
    """
    return queries.get_project(project_id)


@mcp.tool()
def related_projects(project_id: str, limit: int = 5) -> list[dict]:
    """
    Find projects related to the given project by title similarity.

    Args:
        project_id: Valid UUID from atlas.projects.id
        limit: Maximum number of related projects (default 5)

    Returns:
        List of related project records
    """
    return queries.related_projects(project_id, limit=int(limit))


@mcp.tool()
def evidence_for_claim(claim: str, limit: int = 5) -> list[dict]:
    """
    Search atlas.knowledge_chunks for evidence chunks supporting a claim.

    Args:
        claim: The claim to find evidence for
        limit: Maximum number of evidence chunks (default 5)

    Returns:
        List of knowledge chunk records with id, document_id, body
    """
    return queries.evidence_for_claim(claim, limit=int(limit))


@mcp.tool()
def search_hive(query: str, limit: int = 10) -> list[dict]:
    """
    Search hive.articles for climate adaptation measures matching the query.

    Args:
        query: Natural language search query (e.g. 'electric vehicle charging')
        limit: Maximum number of results (default 10, max 50)

    Returns:
        List of article records with article_id, title, transport_mode
    """
    limit = min(int(limit), 50)
    return queries.search_hive(query, limit=limit)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("CPC_CORPUS_PORT", "7001"))
    print(f"[cpc-corpus MCP] Starting on port {port}", flush=True)
    mcp.run(transport="streamable-http", port=port)
