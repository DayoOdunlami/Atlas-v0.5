"""Corpus evidence gate — block misleading canvas when evidence is absent."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.atlas_v5.corpus_gate import (
    CorpusEvidenceRequired,
    can_compose_substantive_canvas,
    substantive_blocked_offer,
    verified_project_hits,
)
from agents.atlas_v5.turn_classifier import TurnDecision
from agents.atlas_v5.wide_pass import WidePassResult, assemble_spec_from_wide_pass
from mcps.cpc_corpus import transport


def _decision() -> TurnDecision:
    return TurnDecision(route="substantive", source="heuristic", outcome_hint="orient")


def test_verified_hits_require_uuid_shape():
    wide = WidePassResult(
        outcome="orient",
        query="rail decarbonisation",
        corpus_hits=[
            {"id": "not-a-uuid", "title": "X"},
            {
                "id": "bb918318-0000-4000-8000-000000000001",
                "title": "Battery train charging",
            },
        ],
    )
    assert len(verified_project_hits(wide)) == 1


def test_zero_verified_hits_blocks_substantive_canvas():
    wide = WidePassResult(
        outcome="orient",
        query="Which transport mode should we prioritise for decarbonisation?",
        stats=None,
        corpus_hits=[],
        retrieval_meta={"corpus_stats_skipped": True},
    )
    assert can_compose_substantive_canvas(wide) is False
    offer = substantive_blocked_offer(wide, wide.query, _decision())
    assert offer is not None
    assert offer["update_canvas"] is False
    assert offer["dev_meta"]["corpus_status"] == "insufficient_evidence"
    assert "online-only" in offer["reply"].lower() or "continue online" in offer["reply"].lower()


def test_find_path_allowed_without_corpus_hits():
    wide = WidePassResult(
        outcome="find_path",
        query="I've got an idea but I'm not sure what I'm asking",
        stats=None,
        corpus_hits=[],
    )
    assert can_compose_substantive_canvas(wide) is True
    assert substantive_blocked_offer(wide, wide.query, _decision()) is None


def test_semantic_hits_allow_rest_fallback_assemble():
    wide = WidePassResult(
        outcome="orient",
        query="rail decarbonisation",
        stats=None,
        corpus_hits=[
            {
                "id": "bb918318-0000-4000-8000-000000000001",
                "title": "Battery train charging",
                "similarity": 0.91,
            }
        ],
        retrieval_meta={"corpus_status": "rest_or_search"},
    )
    assert can_compose_substantive_canvas(wide) is True
    spec = assemble_spec_from_wide_pass(wide)
    assert len(spec.corpus_citations) >= 1
    assert "SEMANTIC" in spec.scope


def test_assemble_zero_hits_raises():
    wide = WidePassResult(
        outcome="act",
        query="What funding might fit an SME innovator?",
        stats=None,
        corpus_hits=[],
    )
    with pytest.raises(CorpusEvidenceRequired):
        assemble_spec_from_wide_pass(wide)


def test_needs_online_only_when_transport_unavailable():
    from agents.atlas_v5.wide_pass import needs_online_only_consent

    wide = WidePassResult(
        outcome="orient",
        query="rail funding",
        stats=None,
        retrieval_meta={"corpus_unavailable": True},
    )
    transport.set_transport("rest_vector")
    assert needs_online_only_consent(wide) is False
    transport.set_transport("unavailable")
    assert needs_online_only_consent(wide) is True
