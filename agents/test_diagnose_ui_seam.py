"""Phase 3.5 — diagnose pipeline + block payload materialization tests."""

import pytest

from agents.matcher.fixtures import cpc_smart_mobility_passport, innovate_uk_smart_mobility_spec
from agents.matcher.report import build_value_translation_report
from agents.orchestrator.diagnose import (
    run_value_translation_pipeline,
    should_run_value_translation,
)
from agents.orchestrator.format_pass import run_format_pass
from agents.orchestrator.block_payloads import materialize_render_blocks


CANONICAL_QUERY = (
    "What evidence does CPC have in smart mobility that would transfer "
    "to the Innovate UK Smart City Challenge?"
)


def test_should_run_value_translation_diagnose():
    assert should_run_value_translation(
        "diagnose",
        "What transfer gaps does CPC have for the Innovate UK Smart City Challenge?",
    ) is True


def test_should_not_run_vt_for_generic_gap_audit():
    """Generic gap audits use corpus builders — not the VT demo vertical."""
    assert should_run_value_translation("diagnose", "What evidence gaps does CPC have in smart mobility?") is False


def test_should_run_value_translation_connect_transfer():
    assert should_run_value_translation("connect", CANONICAL_QUERY) is True


def test_run_value_translation_pipeline_canonical():
    model = run_value_translation_pipeline(query=CANONICAL_QUERY, outcome="connect")
    assert model is not None
    assert model["outcome"] == "diagnose"
    assert model.get("blocks_data")
    assert "match_bench" in model["blocks_data"]
    assert "transfer_lanes" in model["blocks_data"]


def test_format_pass_materializes_render_blocks():
    report = build_value_translation_report(
        passport=cpc_smart_mobility_passport(),
        spec=innovate_uk_smart_mobility_spec(),
    )
    formatted = run_format_pass(report, query=CANONICAL_QUERY)
    blocks = formatted.get("render_blocks") or []
    assert len(blocks) >= 3
    types = {b["type"] for b in blocks}
    assert "TransferLanes" in types
    assert "MatchBench" in types


def test_materialize_transfer_lanes_content():
    report = build_value_translation_report(
        passport=cpc_smart_mobility_passport(),
        spec=innovate_uk_smart_mobility_spec(),
    )
    block_ids = ["transfer_lanes", "match_bench", "dimension_gap"]
    blocks = materialize_render_blocks(report, block_ids)
    lanes = next(b for b in blocks if b["type"] == "TransferLanes")
    assert len(lanes["content"]) >= 1
    assert lanes["content"][0]["transfer_outcome"] in (
        "travels-as-is",
        "needs-reframing",
        "not-credible-here",
        "evidence-needed",
    )
