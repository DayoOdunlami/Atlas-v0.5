"""Unit tests for visual block selection — Sprint 3 sankey + knowledge_graph."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.visual_recipe_director import (  # noqa: E402
    _build_sankey_flows,
    _vb_knowledge_graph,
    _vb_sankey,
    build_visual_blocks,
)


def _project_citations(n: int = 4) -> list[dict]:
    return [
        {
            "id": f"p{i}",
            "title": f"Project {i} autonomous freight",
            "organisation": f"Org {i % 3}",
            "score": 0.7,
            "source_type": "project",
        }
        for i in range(n)
    ]


def test_sankey_from_projects_without_live_calls():
    cites = _project_citations(4)
    flows = _build_sankey_flows(cites)
    assert flows is not None
    assert len(flows) >= 3
    block = _vb_sankey(cites)
    assert block is not None
    assert block["type"] == "sankey"
    assert block["data"]["flows"]


def test_connect_recipe_emits_sankey():
    cites = _project_citations(4)
    blocks = build_visual_blocks(
        recipe_id="connect",
        verified=cites,
        sections={},
        confidence_tier="Indicative",
        npv_value=None,
        discount_rate=0.035,
        evidence_gaps=[],
    )
    types = [b["type"] for b in blocks]
    assert "sankey" in types


def test_knowledge_graph_lower_threshold():
    cites = _project_citations(3)
    graph = _vb_knowledge_graph(cites)
    assert graph is not None
    assert graph["type"] == "knowledge_graph"
    assert len(graph["data"]["edges"]) >= 2


def test_orient_graph_at_four_citations_without_heatmap():
    # Two orgs only → no heatmap (<3 domains); graph should still attempt at 4 cites
    cites = [
        {"id": "a", "title": "A", "organisation": "Org A", "score": 0.8, "source_type": "project"},
        {"id": "b", "title": "B", "organisation": "Org A", "score": 0.7, "source_type": "project"},
        {"id": "c", "title": "C", "organisation": "Org B", "score": 0.6, "source_type": "project"},
        {"id": "d", "title": "D", "organisation": "Org B", "score": 0.5, "source_type": "project"},
    ]
    blocks = build_visual_blocks(
        recipe_id="orient",
        verified=cites,
        sections={},
        confidence_tier="Indicative",
        npv_value=None,
        discount_rate=0.035,
        evidence_gaps=[],
    )
    types = [b["type"] for b in blocks]
    assert "knowledge_graph" in types


def test_orient_skips_graph_when_heatmap_and_under_eight():
    cites = _project_citations(5)  # 3 orgs → heatmap; 5 < 8 → no graph
    blocks = build_visual_blocks(
        recipe_id="orient",
        verified=cites,
        sections={},
        confidence_tier="Indicative",
        npv_value=None,
        discount_rate=0.035,
        evidence_gaps=[],
    )
    types = [b["type"] for b in blocks]
    assert "domain_heatmap" in types
    assert "knowledge_graph" not in types


def run() -> bool:
    tests = [
        test_sankey_from_projects_without_live_calls,
        test_connect_recipe_emits_sankey,
        test_knowledge_graph_lower_threshold,
        test_orient_graph_at_four_citations_without_heatmap,
        test_orient_skips_graph_when_heatmap_and_under_eight,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  [PASS] {t.__name__}")
            passed += 1
        except Exception as exc:
            print(f"  [FAIL] {t.__name__}: {exc}")
    print(f"\n{'=' * 40}\n  Results: {passed}/{len(tests)} passed\n{'=' * 40}")
    return passed == len(tests)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
