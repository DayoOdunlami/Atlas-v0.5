import json
from datetime import datetime
from typing import Optional, Annotated

from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from langgraph.prebuilt import InjectedState

import corpus_queries


# ---------------------------------------------------------------------------
# State-mutation tools (return Command to update graph state directly)
# ---------------------------------------------------------------------------

@tool
def add_pinned_metrics(
    metrics_json: str,
    state: Annotated[dict, InjectedState],
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Add KPI tiles to the dashboard. metrics_json: JSON array of {id, title, value, hint} objects."""
    new_metrics = json.loads(metrics_json)
    existing = state.get("pinnedMetrics", [])
    return Command(update={
        "pinnedMetrics": existing + new_metrics,
        "messages": [ToolMessage(content="Pinned metrics added", tool_call_id=tool_call_id)],
    })


@tool
def update_pinned_metrics(
    metrics_json: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Replace all pinned metrics. Include every metric you want to keep. metrics_json: JSON array of {id, title, value, hint} objects."""
    metrics = json.loads(metrics_json)
    return Command(update={
        "pinnedMetrics": metrics,
        "messages": [ToolMessage(content="Pinned metrics updated", tool_call_id=tool_call_id)],
    })


@tool
def add_charts(
    charts_json: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Add or replace all charts on the dashboard. charts_json: JSON array. Each chart needs type (line|bar|pie), title, x, y, and data (list of {x_field: value, y_field: value} records)."""
    charts = json.loads(charts_json)
    return Command(update={
        "charts": charts,
        "messages": [ToolMessage(content="Charts added", tool_call_id=tool_call_id)],
    })


@tool
def set_surface_state(
    mode: str = "artifact",
    active_agent: str = "ATLAS",
    lens: str = "CPC",
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> Command:
    """Update the active surface. mode: chat|artifact|canvas. active_agent: ATLAS|JARVIS|CICERONE|HYVE. lens: CPC|Atlas|Ecosystem|Funder|Mode."""
    return Command(update={
        "surface_state": {
            "mode": mode,
            "activeAgent": active_agent,
            "lens": lens,
            "timestamp": datetime.now().isoformat(),
        },
        "messages": [ToolMessage(content="Surface state updated", tool_call_id=tool_call_id)],
    })


@tool
def set_artifact_block(
    type: str,
    confidence_tier: str,
    sections_json: str = "{}",
    corpus_citations_json: str = "[]",
    npv_value: Optional[float] = None,
    discount_rate: Optional[float] = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> Command:
    """
    Set the main artifact block rendered in the Atlas artifact panel.
    - type: "brief" | "evidence" | "chart"
    - confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust"
    - sections_json: JSON string mapping heading to body text, e.g. '{"Strategic Case": "..."}'
    - corpus_citations_json: JSON array of citation objects from corpus search results.
      Each object must have a real 'id' from the database — never fabricate IDs.
      Format: '[{"id":"<uuid>","title":"...","organisation":"...","score":0.8,"source_type":"project"}]'
    """
    sections = json.loads(sections_json) if sections_json else {}
    citations = json.loads(corpus_citations_json) if corpus_citations_json else []
    return Command(update={
        "artifact_block": {
            "type": type,
            "confidence_tier": confidence_tier,
            "sections": sections,
            "corpus_citations": citations,
            "npv_value": npv_value,
            "discount_rate": discount_rate,
        },
        "messages": [ToolMessage(content="Artifact block updated", tool_call_id=tool_call_id)],
    })


@tool
def set_decision_spine(
    decision: str,
    recommendation: str,
    confidence_tier: str,
    key_assumption: str,
    next_action: str,
    framework: Optional[str] = None,
    strongest_objection: Optional[str] = None,
    would_change_if: Optional[str] = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> Command:
    """
    Set the Decision Spine — the core Atlas decision object. Call this on every substantive response.
    confidence_tier must be one of: Speculative | Indicative | Supported | Robust
    Base confidence_tier on evidence coverage returned by corpus search tools, not intuition.
    """
    return Command(update={
        "decision_spine": {
            "decision": decision,
            "recommendation": recommendation,
            "confidence_tier": confidence_tier,
            "key_assumption": key_assumption,
            "next_action": next_action,
            "framework": framework,
            "strongest_objection": strongest_objection,
            "would_change_if": would_change_if,
        },
        "messages": [ToolMessage(content="Decision spine set", tool_call_id=tool_call_id)],
    })


# ---------------------------------------------------------------------------
# Corpus retrieval tools (return data — no Command, no InjectedToolCallId needed)
# ---------------------------------------------------------------------------

@tool
def search_corpus_projects(query: str, limit: int = 5) -> dict:
    """
    Search the CPC innovation corpus for historically funded or R&D projects.

    Returns real atlas.projects records with verified UUIDs.
    Use returned IDs in corpus_citations when calling set_artifact_block — never fabricate IDs.

    Also returns an evidence coverage summary with a suggested confidence_tier.
    Use suggested_confidence_tier to inform set_decision_spine confidence_tier.

    Args:
        query: Search query describing the topic (e.g. 'autonomous freight corridor')
        limit: Max results (default 5, max 20)
    """
    try:
        results = corpus_queries.search_projects(query, limit=min(int(limit), 20))
        coverage = corpus_queries.evidence_coverage_summary(results)
        return {"results": results, "coverage": coverage}
    except Exception as e:
        return {"results": [], "coverage": corpus_queries.evidence_coverage_summary([]), "error": str(e)}


@tool
def search_corpus_live_calls(query: str, limit: int = 5, open_only: bool = True) -> dict:
    """
    Search atlas.live_calls for live or recent funding opportunities.

    Returns real records with verified UUIDs, funder, deadline, status, and source URL.
    Use returned IDs in corpus_citations when calling set_artifact_block.

    Args:
        query: Search query (e.g. 'autonomous vehicle freight funding')
        limit: Max results (default 5)
        open_only: If true (default), only return calls with status='open'
    """
    try:
        results = corpus_queries.search_live_calls(query, limit=min(int(limit), 20), open_only=open_only)
        coverage = corpus_queries.evidence_coverage_summary(results)
        return {"results": results, "coverage": coverage}
    except Exception as e:
        return {"results": [], "coverage": corpus_queries.evidence_coverage_summary([]), "error": str(e)}


@tool
def search_corpus_evidence(claim: str, limit: int = 5, modes: Optional[str] = None, themes: Optional[str] = None) -> dict:
    """
    Search atlas.knowledge_chunks for policy, strategy, report, or KB evidence supporting a claim.

    Returns real chunk and document records with verified IDs. Includes title, publisher, tier,
    and source_type from the parent document.

    Use returned chunk_id / document_id in corpus_citations when calling set_artifact_block.

    Args:
        claim: The specific claim to find evidence for
        limit: Max results (default 5)
        modes: Optional comma-separated transport modes filter (e.g. 'rail,road')
        themes: Optional comma-separated themes filter (e.g. 'decarbonisation,freight')
    """
    modes_list = [m.strip() for m in modes.split(",")] if modes else None
    themes_list = [t.strip() for t in themes.split(",")] if themes else None
    try:
        results = corpus_queries.evidence_for_claim(
            claim, limit=min(int(limit), 20), modes=modes_list, themes=themes_list
        )
        coverage = corpus_queries.evidence_coverage_summary(results)
        return {"results": results, "coverage": coverage}
    except Exception as e:
        return {"results": [], "coverage": corpus_queries.evidence_coverage_summary([]), "error": str(e)}


@tool
def search_hive_evidence(query: str, limit: int = 5) -> dict:
    """
    Search hive.document_chunks for HIVE case study and climate adaptation evidence.

    Returns real chunk records joined to hive.articles with verified IDs.
    Use returned chunk_id / article_id in corpus_citations when calling set_artifact_block.

    Args:
        query: Search query (e.g. 'electric vehicle charging climate adaptation')
        limit: Max results (default 5)
    """
    try:
        results = corpus_queries.search_hive_evidence(query, limit=min(int(limit), 20))
        coverage = corpus_queries.evidence_coverage_summary(results)
        return {"results": results, "coverage": coverage}
    except Exception as e:
        return {"results": [], "coverage": corpus_queries.evidence_coverage_summary([]), "error": str(e)}


@tool
def get_corpus_record(source_type: str, record_id: str) -> dict:
    """
    Fetch a full record by ID from the corpus. Only allowlisted source types are accepted.

    source_type must be one of:
      project, live_call, knowledge_doc, knowledge_chunk, hive_chunk, hive_article

    Args:
        source_type: Type of record to fetch
        record_id: UUID string of the record
    """
    try:
        result = corpus_queries.get_record_by_id(source_type, record_id)
        return {"result": result, "found": result is not None}
    except ValueError as e:
        return {"result": None, "found": False, "error": str(e)}
    except Exception as e:
        return {"result": None, "found": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Tool list for agent registration
# ---------------------------------------------------------------------------

atlas_tools = [
    # State-mutation tools
    add_pinned_metrics,
    update_pinned_metrics,
    add_charts,
    set_surface_state,
    set_artifact_block,
    set_decision_spine,
    # Corpus retrieval tools
    search_corpus_projects,
    search_corpus_live_calls,
    search_corpus_evidence,
    search_hive_evidence,
    get_corpus_record,
]
