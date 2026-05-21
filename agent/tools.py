# ADK imports
import os
import json
from google.adk.tools import ToolContext, FunctionTool
from typing import List, Dict, Optional

# Local imports
from state import Metric, Chart, DecisionSpine


def add_pinned_metrics(
    tool_context: ToolContext, new_pinned_metrics: List[Metric]
) -> Dict[str, str]:
    """
    Add a list of new metrics to the dashboard. Make sure metrics have unique ids.
    """
    try:
        current_metrics = tool_context.state.get("pinnedMetrics", [])
        tool_context.state["pinnedMetrics"] = current_metrics + new_pinned_metrics
        return {"status": "success", "message": "Pinned metrics set successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Error updating pinned metrics: {str(e)}"}


def update_pinned_metrics(
    tool_context: ToolContext, updated_pinned_metrics: List[Metric]
) -> Dict[str, str]:
    """
    Replace the full list of pinned metrics. Include all metrics you want to keep.
    """
    try:
        tool_context.state["pinnedMetrics"] = updated_pinned_metrics
        return {"status": "success", "message": "Pinned metrics updated successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Error updating pinned metrics: {str(e)}"}


def add_charts(
    tool_context: ToolContext, charts: List[Chart]
) -> Dict[str, str]:
    """
    Add or replace all charts on the dashboard.
    Each chart needs: type ("line"|"bar"|"pie"), title, x (category field name),
    y (value field name), and data (list of records where each key matches x or y).
    Example data row for a bar chart with x="year", y="value": {"year": "2024", "value": 42}
    """
    try:
        serialized = [
            c.model_dump() if hasattr(c, "model_dump") else c for c in charts
        ]
        tool_context.state["charts"] = serialized
        return {"status": "success", "message": f"Added {len(serialized)} chart(s) successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Error adding charts: {str(e)}"}


def set_surface_state(
    tool_context: ToolContext,
    mode: str = "artifact",
    active_agent: str = "ATLAS",
    lens: str = "CPC",
) -> Dict[str, str]:
    """Update the active surface. mode: chat|artifact|canvas. active_agent: ATLAS|JARVIS|CICERONE|HYVE. lens: CPC|Atlas|Ecosystem|Funder|Mode."""
    try:
        from datetime import datetime
        tool_context.state["surface_state"] = {
            "mode": mode,
            "activeAgent": active_agent,
            "lens": lens,
            "timestamp": datetime.now().isoformat(),
        }
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def set_artifact_block(
    tool_context: ToolContext,
    type: str,
    confidence_tier: str,
    sections_json: str = "{}",
    corpus_citations_json: str = "[]",
    npv_value: Optional[float] = None,
    discount_rate: Optional[float] = None,
) -> Dict[str, str]:
    """
    Set the main artifact block rendered in the Atlas artifact panel.
    - type: "brief" | "evidence" | "chart"
    - confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust"
    - sections_json: JSON string mapping heading to body, e.g. '{"Strategic Case": "..."}'
    - corpus_citations_json: JSON array e.g. '[{"id":"x","title":"y","organisation":"z","score":0.8}]'
    - npv_value: optional NPV in pounds
    - discount_rate: optional discount rate percentage
    """
    try:
        sections = json.loads(sections_json) if sections_json else {}
        citations = json.loads(corpus_citations_json) if corpus_citations_json else []
        tool_context.state["artifact_block"] = {
            "type": type,
            "confidence_tier": confidence_tier,
            "sections": sections,
            "corpus_citations": citations,
            "npv_value": npv_value,
            "discount_rate": discount_rate,
        }
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def set_decision_spine(
    tool_context: ToolContext, decision_spine: DecisionSpine
) -> Dict[str, str]:
    """
    Set the Decision Spine — the core Atlas decision object.
    Call this on every substantive response.
    Required fields: decision, recommendation, confidence_tier, key_assumption, next_action.
    """
    try:
        tool_context.state["decision_spine"] = decision_spine.model_dump()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


tools = [
    FunctionTool(func=add_pinned_metrics),
    FunctionTool(func=update_pinned_metrics),
    FunctionTool(func=add_charts),
    FunctionTool(func=set_surface_state),
    FunctionTool(func=set_artifact_block),
    FunctionTool(func=set_decision_spine),
]
