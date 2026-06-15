"""
agents.orchestrator.tools
=========================

@tool wrappers exposed to the orchestrator LLM loop.

Each tool calls an existing capability (corpus search, external search,
passport loader) via the single MCP invocation pattern (agents/mcp_client.py).

Tools available to the orchestrator
-------------------------------------
search_corpus       Semantic search of atlas.projects via pgvector
search_hive         Search hive.articles (HYVE corpus)
load_passport       Load CPC entity passport from Supabase
search_external     Web / Exa search (fires only when effort=deep)
get_context_packet  Assemble context_packet from Supabase state

Adding new tools
----------------
Follow the @tool decorator pattern here; the orchestrator graph binds all
tools from this module via tools = [search_corpus, search_hive, ...].
"""
from __future__ import annotations

import os
from typing import Annotated

from langchain_core.tools import tool


@tool
def search_corpus(
    query: Annotated[str, "Semantic search query for CPC innovation corpus"],
    k: Annotated[int, "Number of results (1-20, default 8)"] = 8,
) -> list[dict]:
    """
    Search atlas.projects for matching CPC innovation projects.

    Returns ranked results with id (UUID), title, organisation, and similarity score.
    Only returns verified UUIDs that exist in the database.
    """
    try:
        from mcps.cpc_corpus import queries as cq
        results = cq.search_projects(query, limit=k)
        return results if results else []
    except Exception as exc:
        return [{"error": str(exc), "query": query}]


@tool
def search_hive(
    query: Annotated[str, "Semantic search query for HIVE climate adaptation corpus"],
    k: Annotated[int, "Number of results (1-10, default 5)"] = 5,
) -> list[dict]:
    """
    Search hive.articles for climate adaptation and transport resilience evidence.

    Returns article-level results with article_id, title, and similarity score.
    """
    try:
        from mcps.cpc_corpus import queries as cq
        results = cq.search_hive(query, limit=k)
        return results if results else []
    except Exception as exc:
        return [{"error": str(exc), "query": query}]


@tool
def load_passport(
    entity_name: Annotated[str, "Name of the entity (organisation, project, or theme)"],
) -> dict:
    """
    Load a CPC entity passport from Supabase.

    Returns structured passport with entity_name, sector, description, and
    existing evidence strength across capability dimensions.
    """
    try:
        from agents.passport_loader import load_entity_passport
        return load_entity_passport(entity_name)
    except Exception as exc:
        return {"error": str(exc), "entity_name": entity_name, "passport": None}


@tool
def search_external(
    query: Annotated[str, "External web search query"],
    purpose: Annotated[str, "Why this external search is needed (for audit trail)"] = "research",
) -> list[dict]:
    """
    External web search using Exa or Tavily.

    Only call this tool when effort=deep has been confirmed by the user gate.
    Results are for context only — never promote web results to corpus_citations.
    """
    from agents.external_search import search_tavily, search_exa

    if os.getenv("TAVILY_API_KEY", "").strip():
        return search_tavily(query, limit=5)
    if os.getenv("EXA_API_KEY", "").strip():
        return search_exa(query, limit=4)
    return [{"note": "No external search API configured (TAVILY_API_KEY / EXA_API_KEY)"}]


ALL_TOOLS = [search_corpus, search_hive, load_passport, search_external]
STANDARD_TOOLS = [search_corpus, search_hive, load_passport]
DEEP_TOOLS = [search_corpus, search_hive, load_passport, search_external]
