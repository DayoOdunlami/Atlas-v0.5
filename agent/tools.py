import json
from datetime import datetime
from typing import Optional, Annotated

from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from langgraph.prebuilt import InjectedState

import corpus_queries


# ---------------------------------------------------------------------------
# Confidence tier helpers (H2)
# ---------------------------------------------------------------------------

_TIER_ORDER = ["Speculative", "Indicative", "Supported", "Robust"]


def _cap_tier(requested: str, ceiling: str) -> str:
    """Cap requested confidence tier at the evidence-derived ceiling."""
    try:
        return _TIER_ORDER[min(_TIER_ORDER.index(requested), _TIER_ORDER.index(ceiling))]
    except ValueError:
        return ceiling


# ---------------------------------------------------------------------------
# Citation verifier (H1)
# ---------------------------------------------------------------------------

def _verify_citation(citation: dict) -> Optional[dict]:
    """
    Verify a citation ID exists in the corpus DB.
    Returns a normalized citation or None if the record isn't found.
    Prevents fabricated IDs from reaching the artifact block.
    """
    source_type = citation.get("source_type", "")

    if source_type == "project":
        lookup_type = "project"
        record_id = citation.get("id")
    elif source_type == "live_call":
        lookup_type = "live_call"
        record_id = citation.get("id")
    elif source_type in ("knowledge_doc", "knowledge_chunk"):
        lookup_type = "knowledge_chunk"
        record_id = citation.get("chunk_id") or citation.get("id")
    elif source_type == "hive_chunk":
        lookup_type = "hive_chunk"
        record_id = citation.get("chunk_id") or citation.get("id")
    elif source_type == "hive_article":
        lookup_type = "hive_article"
        record_id = citation.get("article_id") or citation.get("id")
    else:
        return None

    if not record_id:
        return None

    try:
        record = corpus_queries.get_record_by_id(lookup_type, record_id)
    except Exception:
        return None

    if record is None:
        return None

    sim_val = citation.get("similarity") or citation.get("score") or 0.0
    verified: dict = {
        "id": record.get("id", record_id),
        "source_type": source_type,
        "similarity": sim_val,  # for evidence_coverage_summary
        "score": sim_val,       # TypeScript CorpusCitation.score
    }

    if source_type == "project":
        verified["title"] = record.get("title") or citation.get("title") or ""
        verified["organisation"] = record.get("lead_org_name") or citation.get("organisation") or ""
    elif source_type == "live_call":
        verified["title"] = record.get("title") or citation.get("title") or ""
        verified["funder"] = record.get("funder") or citation.get("funder") or ""
        verified["deadline"] = str(record["deadline"]) if record.get("deadline") else None
    elif source_type in ("knowledge_doc", "knowledge_chunk"):
        verified["chunk_id"] = record.get("id", "")
        verified["document_id"] = record.get("document_id", "")
        verified["title"] = citation.get("title") or ""
        verified["publisher"] = citation.get("publisher") or ""
    elif source_type == "hive_chunk":
        verified["chunk_id"] = record.get("id", "")
        verified["article_id"] = record.get("article_id") or ""
        verified["title"] = citation.get("title") or ""
    elif source_type == "hive_article":
        verified["title"] = (
            record.get("project_title") or record.get("measure_title") or citation.get("title") or ""
        )

    return verified


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


_RECIPE_VALUES = {"brief_five_case", "evidence_panel", "stats_dashboard", "scenario_stress_test"}

_DEFAULT_RECIPE: dict[str, str] = {
    "brief": "brief_five_case",
    "evidence": "evidence_panel",
    "chart": "stats_dashboard",
    "scenario": "scenario_stress_test",
}


@tool
def set_artifact_block(
    type: str,
    confidence_tier: str,
    recipe: Optional[str] = None,
    sections_json: str = "{}",
    corpus_citations_json: str = "[]",
    chart_specs_json: str = "[]",
    npv_value: Optional[float] = None,
    discount_rate: Optional[float] = None,
    state: Annotated[dict, InjectedState] = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> Command:
    """
    Set the main artifact block rendered in the Atlas artifact panel.
    - type: "brief" | "evidence" | "chart" | "scenario"
    - recipe: explicit render recipe — set this to control the layout surface.
        "brief_five_case"      — Five Case Model brief (use with type="brief")
        "evidence_panel"       — Evidence citation grid (use with type="evidence")
        "stats_dashboard"      — Stats/chart surface (use with type="chart")
        "scenario_stress_test" — Scenario stress test (use with type="scenario")
      If omitted, recipe is inferred from type.
    - confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust"
    - sections_json: JSON string mapping heading to body text, e.g. '{"Strategic Case": "..."}'
    - corpus_citations_json: JSON array of citation objects from corpus search results.
      Each object must have a real 'id' from the database — never fabricate IDs.
      Format: '[{"id":"<uuid>","title":"...","organisation":"...","score":0.8,"source_type":"project"}]'
    - chart_specs_json: JSON array of chart specs that BELONG TO THIS ARTEFACT.
      Charts here travel with the artefact and render inside the stats_dashboard or brief.
      Format: '[{"type":"bar","title":"X by Year","x":"year","y":"value","data":[...]}]'
      Do NOT put temporary/exploratory workspace charts here — use add_charts() for those.

    All citations are mechanically verified against the DB before storage.
    Unverifiable IDs are silently dropped. Evidence coverage is computed and stored
    automatically — it feeds the confidence ceiling in set_decision_spine.
    """
    sections = json.loads(sections_json) if sections_json else {}
    raw_citations = json.loads(corpus_citations_json) if corpus_citations_json else []
    chart_specs = json.loads(chart_specs_json) if chart_specs_json else []

    # H1: Verify every citation ID against the DB. Drop any that don't resolve.
    verified_citations = [v for c in raw_citations if (v := _verify_citation(c)) is not None]

    # H2: Compute coverage from verified citations; stored in state for ceiling enforcement.
    evidence_coverage = corpus_queries.evidence_coverage_summary(verified_citations)

    # Explicit recipe field — fall back to type-derived default if not supplied or invalid.
    resolved_recipe = recipe if recipe in _RECIPE_VALUES else _DEFAULT_RECIPE.get(type, "brief_five_case")

    dropped = len(raw_citations) - len(verified_citations)
    msg = (
        f"Artifact block updated (recipe={resolved_recipe}). "
        f"{len(verified_citations)}/{len(raw_citations)} citations verified"
        + (f" ({dropped} dropped — IDs not found in corpus)" if dropped else "")
        + f". Coverage: {evidence_coverage.get('suggested_confidence_tier', 'unknown')}"
    )

    return Command(update={
        "artifact_block": {
            "type": type,
            "recipe": resolved_recipe,
            "confidence_tier": confidence_tier,
            "sections": sections,
            "corpus_citations": verified_citations,
            "chart_specs": chart_specs if chart_specs else None,
            "npv_value": npv_value,
            "discount_rate": discount_rate,
        },
        "evidence_coverage": evidence_coverage,
        "messages": [ToolMessage(content=msg, tool_call_id=tool_call_id)],
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
    state: Annotated[dict, InjectedState] = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> Command:
    """
    Set the Decision Spine — the core Atlas decision object. Call this on every substantive response.
    confidence_tier must be one of: Speculative | Indicative | Supported | Robust.

    The tier you pass is automatically capped at the evidence ceiling computed from verified
    citations in set_artifact_block — you cannot inflate it above what the corpus supports.
    Base your requested tier on corpus search coverage; the ceiling enforces it mechanically.
    """
    # H2: Enforce confidence ceiling from evidence coverage stored by set_artifact_block.
    evidence_coverage = (state or {}).get("evidence_coverage")
    if evidence_coverage:
        ceiling = evidence_coverage.get("suggested_confidence_tier", confidence_tier)
        confidence_tier = _cap_tier(confidence_tier, ceiling)

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


@tool
def get_corpus_stats() -> dict:
    """
    Get live corpus statistics — real table counts from the database.

    Call this before setting any corpus-related pinned metrics (e.g. 'X projects in corpus').
    Never hard-code corpus counts — always use the values returned here.
    """
    try:
        stats = corpus_queries.get_corpus_stats()
        return {"stats": stats}
    except Exception as e:
        return {"stats": {}, "error": str(e)}


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
    get_corpus_stats,
]
