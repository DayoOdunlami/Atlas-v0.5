"""Phase 4 outcome builder tests."""

import pytest

from agents.orchestrator.outcome_builders import (
    build_orient_model,
    build_connect_model,
    build_act_model,
    build_defend_model,
)
from agents.orchestrator.format_pass import run_format_pass


@pytest.mark.parametrize("builder,expected_block", [
    (build_orient_model, "OpportunityList"),
    (build_connect_model, "TransferLanes"),
    (build_act_model, "EconomicCase"),
    (build_defend_model, "ClaimLedger"),
])
def test_outcome_builders_materialize_blocks(builder, expected_block):
    query = "smart mobility innovation UK transport"
    model = builder(query)
    formatted = run_format_pass(model, query=query)
    blocks = formatted.get("render_blocks") or []
    types = {b["type"] for b in blocks}
    assert expected_block in types
    assert formatted.get("render_mode") == "blocks"


def test_orient_has_corpus_scaffold():
    model = build_orient_model("rail innovation landscape")
    assert model["outcome"] == "orient"
    assert "blocks_data" in model


def test_defend_has_objections():
    model = build_defend_model("challenge CPC smart mobility evidence")
    items = model["blocks_data"]["objection_response"]["items"]
    assert len(items) >= 1
