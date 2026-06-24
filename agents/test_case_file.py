"""Case file — in-memory declared claims (Increment 0)."""

from __future__ import annotations

import uuid

import pytest

from agents.atlas_v5.case_file import (
    CaseClaim,
    bootstrap_declared_claims_heuristic,
    declared_markup_block,
    load_case_file,
    merge_case_claims,
    save_case_file,
    to_answer_spec_claims,
)
from agents.atlas_v5.composition_gate import validate_composition_gate
from agents.atlas_v5.composition_merge import merge_composition_markup
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import build_keyed_index
from agents.atlas_v5.reconcile_spec import apply_declared_claims_to_spec
from agents.atlas_v5.wide_pass import WidePassResult


@pytest.fixture(autouse=True)
def _clear_memory_store():
    import agents.atlas_v5.case_file as cf

    cf._MEMORY.clear()
    yield
    cf._MEMORY.clear()


def test_load_save_round_trip_in_memory():
    tid = f"thread-{uuid.uuid4()}"
    claims = [
        CaseClaim(id=str(uuid.uuid4()), text="SME rail innovator", kind="domain"),
        CaseClaim(id=str(uuid.uuid4()), text="No trial partner yet", kind="constraint"),
    ]
    save_case_file(tid, claims)
    loaded = load_case_file(tid)
    assert len(loaded) == 2
    assert loaded[0].kind == "domain"
    assert loaded[1].source == "declared"


def test_merge_case_claims_updates_by_id():
    cid = str(uuid.uuid4())
    prior = [CaseClaim(id=cid, text="old", kind="fact")]
    updates = [CaseClaim(id=cid, text="refined fact", kind="fact")]
    merged = merge_case_claims(prior, updates)
    assert len(merged) == 1
    assert merged[0].text == "refined fact"


def test_bootstrap_uncertainty_cue():
    q = "I'm not sure what I'm asking — something about rail decarb for my SME"
    boot = bootstrap_declared_claims_heuristic(q)
    kinds = {c.kind for c in boot}
    assert "uncertainty" in kinds


def test_analyst_landscape_query_no_manufactured_declared():
    """Analyst domain words must not become declared situation claims."""
    q = "state of rail decarbonisation"
    assert bootstrap_declared_claims_heuristic(q) == []


def test_resolve_session_claims_empty_for_analyst_query():
    from agents.atlas_v5.deep_synthesis import _resolve_session_claims

    wide = WidePassResult(
        outcome="orient",
        query="state of rail decarbonisation",
        stats=None,
        retrieval_meta={"lane_mode": "corpus_only"},
        session_claims=[],
    )
    claims = _resolve_session_claims(
        "state of rail decarbonisation",
        wide,
        thread_id="analyst-empty-test",
        deep=None,
    )
    assert claims == []


def test_to_answer_spec_claims_capped_indicative():
    claims = [
        CaseClaim(id=str(uuid.uuid4()), text="We might get Innovate funding", kind="hypothesis"),
        CaseClaim(id=str(uuid.uuid4()), text="Rail SME", kind="domain"),
    ]
    spec_claims = to_answer_spec_claims(claims)
    assert all(c.source == "declared" for c in spec_claims)
    assert all(c.trust == "declared" for c in spec_claims)
    assert spec_claims[0].tier == "Speculative"
    assert spec_claims[1].tier == "Indicative"


MOCK_STATS = J1T1CorpusStats(
    project_count=55,
    funding_sum=8_172_702.05,
    null_funding_count=18,
    funded_row_count=37,
    org_count=30,
    live_since_2024=27,
    funders=[FunderBreakdownRow("Innovate UK", 36, 1, 7_903_940.05)],
    top_citations=[],
    queried_at="2026-06-17T00:00:00Z",
)


def test_declared_markup_passes_gate_with_orphan_figures_in_section():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="q",
        stats=MOCK_STATS,
        retrieval_meta={"external_skipped": True, "lane_mode": "corpus_only"},
    )
    index = build_keyed_index(wide, skeleton)
    claims = [
        CaseClaim(id=str(uuid.uuid4()), text="Budget around £500k", kind="constraint"),
    ]
    block = declared_markup_block(claims)
    body = (
        f"{block}"
        '<div data-material="owned" data-key="stats.funding_floor_gbp">'
        "{{stats.funding_floor_gbp}}</div>"
    )
    merge = merge_composition_markup(body, index)
    assert not merge.errors
    gate = validate_composition_gate(body, merge.merged_markup, merge, index)
    assert gate.passed, gate.errors


def test_apply_declared_claims_to_spec_adds_reconciliation_note():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    claims = [CaseClaim(id=str(uuid.uuid4()), text="Rail SME", kind="domain")]
    out = apply_declared_claims_to_spec(skeleton, claims)
    assert any(c.source == "declared" for c in out.claims)
    assert any("declared situation" in (n.message or "") for n in out.reconciliation.notes)
