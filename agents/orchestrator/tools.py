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


@tool
def extract_requirement_spec(
    opportunity_text: Annotated[str, "Funding call or opportunity description to parse"],
) -> dict:
    """
    Extract a structured Requirement Spec from opportunity text.

    Returns criteria with importance, domain, and evidence_type fields.
    """
    try:
        from agents.matcher.requirement_spec import extract_requirement_spec as _extract
        spec = _extract(opportunity_text)
        return {
            "title": spec.title,
            "funder": spec.funder,
            "sector_target": spec.sector_target,
            "criteria": [
                {
                    "label": c.label,
                    "description": c.description,
                    "importance": c.importance,
                    "domain": c.domain,
                    "evidence_type": c.evidence_type,
                }
                for c in spec.criteria
            ],
        }
    except Exception as exc:
        return {"error": str(exc)}


@tool
def run_matcher(
    passport_json: Annotated[dict, "Passport dict from load_passport"],
    spec_json: Annotated[dict, "Requirement spec dict from extract_requirement_spec"],
) -> dict:
    """
    Run Fit / Gap / Risk / Move matcher between a Passport and Requirement Spec.

    Returns scored matches and overall fit score.
    """
    try:
        from agents.matcher.passport import dict_to_passport
        from agents.matcher.requirement_spec import dict_to_requirement_spec
        from agents.matcher.matcher import run_matcher as _run

        passport = dict_to_passport(passport_json)
        spec = dict_to_requirement_spec(spec_json)
        result = _run(passport, spec)
        return result.to_dict()
    except Exception as exc:
        return {"error": str(exc)}


@tool
def run_value_translation(
    passport_json: Annotated[dict, "Passport dict"],
    spec_json: Annotated[dict, "Requirement spec dict"],
) -> dict:
    """
    Run the full Value Translation report (matcher + transfer labels).

    Returns headline, insight_card, blocks_data, and confidence_tier.
    """
    try:
        from agents.matcher.passport import dict_to_passport
        from agents.matcher.requirement_spec import dict_to_requirement_spec
        from agents.matcher.report import build_value_translation_report

        passport = dict_to_passport(passport_json)
        spec = dict_to_requirement_spec(spec_json)
        report = build_value_translation_report(passport=passport, spec=spec)
        return {
            "headline": report.get("headline"),
            "insight_card": report.get("insight_card"),
            "confidence_tier": report.get("confidence_tier"),
            "blocks_data": report.get("blocks_data"),
            "translation_summary": report.get("translation_summary"),
        }
    except Exception as exc:
        return {"error": str(exc)}


ALL_TOOLS = [
    search_corpus,
    search_hive,
    load_passport,
    extract_requirement_spec,
    run_matcher,
    run_value_translation,
    search_external,
]
STANDARD_TOOLS = [
    search_corpus,
    search_hive,
    load_passport,
    extract_requirement_spec,
    run_matcher,
    run_value_translation,
]
DEEP_TOOLS = ALL_TOOLS
