"""Phase F PR1 — parallel retrieval fabric tests."""
from __future__ import annotations

from unittest.mock import patch

from agents.orchestrator.evidence_schema import make_external_evidence
from agents.orchestrator.retrieval_fabric import EvidenceBag, run_retrieval_fabric
from agents.orchestrator.retrieval_planner import RetrievalPlan


def _dual_plan() -> RetrievalPlan:
    return RetrievalPlan(
        lane_mode="dual",
        corpus_k=5,
        external_enabled=True,
        external_timeout_s=2.0,
        govuk_query="rail funding UK",
        exa_queries=["rail funding UK"],
    )


@patch("agents.orchestrator.retrieval_fabric._fetch_external_bundle")
@patch("agents.orchestrator.retrieval_fabric._fetch_corpus")
def test_run_retrieval_fabric_parallel(mock_corpus, mock_external):
    mock_corpus.return_value = [{"id": "p1", "title": "Rail project"}]
    ext = make_external_evidence(
        title="Innovate UK rail call",
        url="https://www.gov.uk/test",
        publisher="InnovateUK",
    )
    mock_external.return_value = ([ext], [], [])

    bag = run_retrieval_fabric("rail opportunities", "connect", _dual_plan())

    mock_corpus.assert_called_once()
    mock_external.assert_called_once()
    assert len(bag.corpus_raw) == 1
    assert len(bag.external) == 1
    assert bag.lane_mode == "dual"
    assert bag.corpus_thin is True
    assert bag.has_external is True


def test_evidence_bag_meta_shape():
    bag = EvidenceBag(
        corpus_raw=[{"id": "a"}, {"id": "b"}],
        external=[make_external_evidence(title="Gov", url="https://gov.uk", publisher="DfT")],
        candidates=[],
        lane_mode="dual",
        corpus_ms=12.3,
        external_ms=45.6,
        errors=["exa: timeout"],
    )
    meta = bag.as_meta()
    assert meta["corpus_count"] == 2
    assert meta["external_count"] == 1
    assert meta["corpus_ms"] == 12.3
    assert meta["errors"] == ["exa: timeout"]
    assert bag.corpus_thin is False


@patch("agents.orchestrator.retrieval_fabric._fetch_corpus")
def test_external_skipped_when_disabled(mock_corpus):
    mock_corpus.return_value = [{"id": "only"}]
    plan = RetrievalPlan(lane_mode="corpus_only", external_enabled=False)
    bag = run_retrieval_fabric("query", "orient", plan)
    assert bag.external_skipped is True
    assert bag.external == []
    assert len(bag.corpus_raw) == 1
