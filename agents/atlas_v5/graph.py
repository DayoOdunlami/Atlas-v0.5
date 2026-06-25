"""
Atlas v5 — LangGraph shell synced to CopilotKit co-agent state.

Multi-node graph streams partial canvas (wide pass skeleton) then final AnswerSpec,
with reasoning_trace steps after each stage.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated, Any

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from agents.atlas_v5.graph_nodes import extract_query as _extract_query
from agents.atlas_v5.graph_nodes import (
    finalize_turn,
    gather_evidence,
    prepare_turn,
    route_after_route,
    route_turn,
    stream_spine,
    synthesize_turn,
)
from agents.atlas_v5.reasoning_trace import append_trace


def _merge_trace(
    existing: list[dict[str, Any]] | None,
    new: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Nodes emit incremental steps; prepare resets the trace."""
    if not new:
        return list(existing or [])
    if len(new) == 1 and new[0].get("node") == "prepare":
        return list(new)
    return list(existing or []) + list(new)


class AtlasV5State(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    query: str
    answer_spec_envelope: dict[str, Any]
    answer_dev_meta: dict[str, Any]
    canvas_cleared: bool
    error: str | None
    reasoning_trace: Annotated[list[dict[str, Any]], _merge_trace]
    turn_active: bool
    turn_pipeline: dict[str, Any]
    ux_prefs: dict[str, bool]


def build_atlas_v5_graph():
    g = StateGraph(AtlasV5State)
    g.add_node("prepare", prepare_turn)
    g.add_node("route", route_turn)
    g.add_node("gather", gather_evidence)
    g.add_node("stream_spine", stream_spine)
    g.add_node("synthesise", synthesize_turn)
    g.add_node("finalize", finalize_turn)

    g.set_entry_point("prepare")
    g.add_edge("prepare", "route")
    g.add_conditional_edges(
        "route",
        route_after_route,
        {"gather": "gather", "finalize": "finalize"},
    )
    g.add_edge("gather", "stream_spine")
    g.add_edge("stream_spine", "synthesise")
    g.add_edge("synthesise", END)
    g.add_edge("finalize", END)
    return g.compile(checkpointer=MemorySaver())


atlas_v5_graph = build_atlas_v5_graph()
