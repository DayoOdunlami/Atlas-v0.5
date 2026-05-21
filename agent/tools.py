import json
from datetime import datetime
from typing import Optional, Annotated

from langchain_core.tools import tool
from langgraph.types import Command
from langgraph.prebuilt import InjectedState


@tool
def add_pinned_metrics(
    metrics_json: str,
    state: Annotated[dict, InjectedState],
) -> Command:
    """Add KPI tiles to the dashboard. metrics_json: JSON array of {id, title, value, hint} objects."""
    new_metrics = json.loads(metrics_json)
    existing = state.get("pinnedMetrics", [])
    return Command(update={"pinnedMetrics": existing + new_metrics})


@tool
def update_pinned_metrics(metrics_json: str) -> Command:
    """Replace all pinned metrics. Include every metric you want to keep. metrics_json: JSON array of {id, title, value, hint} objects."""
    metrics = json.loads(metrics_json)
    return Command(update={"pinnedMetrics": metrics})


@tool
def add_charts(charts_json: str) -> Command:
    """Add or replace all charts on the dashboard. charts_json: JSON array. Each chart needs type (line|bar|pie), title, x, y, and data (list of {x_field: value, y_field: value} records)."""
    charts = json.loads(charts_json)
    return Command(update={"charts": charts})


@tool
def set_surface_state(
    mode: str = "artifact",
    active_agent: str = "ATLAS",
    lens: str = "CPC",
) -> Command:
    """Update the active surface. mode: chat|artifact|canvas. active_agent: ATLAS|JARVIS|CICERONE|HYVE. lens: CPC|Atlas|Ecosystem|Funder|Mode."""
    return Command(update={
        "surface_state": {
            "mode": mode,
            "activeAgent": active_agent,
            "lens": lens,
            "timestamp": datetime.now().isoformat(),
        }
    })


@tool
def set_artifact_block(
    type: str,
    confidence_tier: str,
    sections_json: str = "{}",
    corpus_citations_json: str = "[]",
    npv_value: Optional[float] = None,
    discount_rate: Optional[float] = None,
) -> Command:
    """
    Set the main artifact block rendered in the Atlas artifact panel.
    - type: "brief" | "evidence" | "chart"
    - confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust"
    - sections_json: JSON string mapping heading to body text, e.g. '{"Strategic Case": "..."}'
    - corpus_citations_json: JSON array e.g. '[{"id":"x","title":"y","organisation":"z","score":0.8}]'
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
        }
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
) -> Command:
    """
    Set the Decision Spine — the core Atlas decision object. Call this on every substantive response.
    confidence_tier must be one of: Speculative | Indicative | Supported | Robust
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
        }
    })


atlas_tools = [
    add_pinned_metrics,
    update_pinned_metrics,
    add_charts,
    set_surface_state,
    set_artifact_block,
    set_decision_spine,
]
