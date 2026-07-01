"""Phase 1 — graph_nodes must delegate to run_turn.py (no independent turn brain)."""

from __future__ import annotations

from pathlib import Path


_FORBIDDEN_IMPORT_FRAGMENTS = (
    "from agents.atlas_v5.turn_classifier import",
    "from agents.atlas_v5.wide_pass import",
    "from agents.atlas_v5.corpus_gate import",
    "from agents.atlas_v5.showcase import",
    "from agents.atlas_v5.chat_router import",
    "from agents.atlas_v5.deep_synthesis import",
    "from agents.atlas_v5.online_only import",
)


def test_graph_nodes_has_no_independent_routing_imports():
    src = Path(__file__).resolve().parent / "atlas_v5" / "graph_nodes.py"
    text = src.read_text(encoding="utf-8")
    for fragment in _FORBIDDEN_IMPORT_FRAGMENTS:
        assert fragment not in text, f"graph_nodes must not import brain module: {fragment}"
    for name in (
        "plan_turn_pipeline",
        "gather_substantive_evidence",
        "finalize_turn_payload",
        "execute_substantive_turn",
    ):
        assert name in text, f"graph_nodes must delegate via {name}"
