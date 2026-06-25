"""Wide pass graceful degradation when corpus Postgres is down."""

from __future__ import annotations

from agents.atlas_v5.wide_pass import WidePassResult, assemble_spec_from_wide_pass
from agents.orchestrator.retrieval_fabric import EvidenceBag


def test_assemble_online_only_when_corpus_unavailable():
    wide = WidePassResult(
        outcome="orient",
        query="Funding organisation decarbonisation",
        stats=None,
        retrieval_meta={
            "corpus_unavailable": True,
            "online_only": True,
            "lane_mode": "dual",
        },
        evidence_bag=EvidenceBag(
            lane_mode="dual",
            external=[
                {
                    "title": "Rail decarbonisation plan",
                    "url": "https://www.gov.uk/example",
                    "publisher": "DfT",
                    "snippet": "Programme funding context",
                },
                {
                    "title": "Innovate UK call",
                    "url": "https://example.com/call",
                    "publisher": "Innovate UK",
                    "snippet": "Funding opportunity",
                },
            ],
        ),
    )
    spec = assemble_spec_from_wide_pass(wide)
    assert spec.scope.startswith("ONLINE ONLY")
    assert len(spec.web_evidence) >= 2
    assert spec.query == wide.query
