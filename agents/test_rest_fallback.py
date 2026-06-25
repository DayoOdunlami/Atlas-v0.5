"""REST fallback assembler when Postgres stats blocked but HTTPS search works."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.atlas_v5.rest_fallback_assembler import assemble_rest_fallback_spec
from agents.atlas_v5.trust.validate_web import build_web_figures
from agents.atlas_v5.wide_pass import WidePassResult, assemble_spec_from_wide_pass
from agents.orchestrator.retrieval_fabric import EvidenceBag


def test_build_web_figures_empty_external_no_crash():
    bag = EvidenceBag(external=[], candidates=[])
    figures = build_web_figures(bag, external_skipped=False)
    assert "web.external_count" in figures
    assert figures["web.external_count"].value == 0


def test_assemble_rest_fallback_from_hits():
    wide = WidePassResult(
        outcome="orient",
        query="rail decarbonisation",
        corpus_hits=[
            {
                "id": "bb918318-0000-4000-8000-000000000001",
                "title": "Battery train charging",
                "organisation": "Innovate UK",
                "similarity": 0.91,
            }
        ],
        retrieval_meta={"corpus_status": "rest_or_search"},
    )
    spec = assemble_rest_fallback_spec(wide)
    assert len(spec.corpus_citations) == 1
    assert "HTTPS" in spec.scope


def test_assemble_spec_zero_hits_rest_tier_no_crash():
    wide = WidePassResult(
        outcome="act",
        query="What kind of funding might fit an SME innovator like that?",
        stats=None,
        corpus_hits=[],
        retrieval_meta={"corpus_status": "rest_or_search", "corpus_stats_skipped": True},
    )
    spec = assemble_spec_from_wide_pass(wide)
    assert spec.mode == "Act"
    assert "ONLINE ONLY" not in spec.scope


def test_needs_online_only_consent_false_when_rest_tier():
    from agents.atlas_v5.wide_pass import needs_online_only_consent
    from mcps.cpc_corpus import transport

    wide = WidePassResult(
        outcome="orient",
        query="rail funding",
        stats=None,
        retrieval_meta={"corpus_unavailable": True},
    )
    transport.set_transport("rest_keyword")
    assert needs_online_only_consent(wide) is False
    transport.set_transport("unavailable")
    assert needs_online_only_consent(wide) is True


def test_assemble_spec_uses_rest_fallback_not_online_only():
    bag = EvidenceBag(
        corpus_raw=[
            {
                "id": "uuid-1",
                "title": "Project A",
                "organisation": "CPC",
                "similarity": 0.8,
            }
        ],
        external=[],
    )
    wide = WidePassResult(
        outcome="orient",
        query="State of play on rail decarbonisation",
        stats=None,
        corpus_hits=bag.corpus_raw,
        evidence_bag=bag,
        retrieval_meta={
            "corpus_unavailable": True,
            "corpus_status": "rest_or_search",
            "corpus_stats_skipped": True,
        },
    )
    spec = assemble_spec_from_wide_pass(wide)
    assert len(spec.corpus_citations) >= 1
    assert "ONLINE ONLY" not in spec.scope
