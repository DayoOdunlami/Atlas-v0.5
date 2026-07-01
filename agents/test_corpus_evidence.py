"""Tests for corpus project + document hit merging."""

from __future__ import annotations

from agents.atlas_v5.corpus_evidence import (
    citations_from_hits,
    merge_corpus_hits,
    merge_document_citations_into_spec,
)
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec, CorpusCitation
from agents.orchestrator.retrieval_fabric import EvidenceBag


def test_merge_corpus_hits_includes_documents():
    bag = EvidenceBag(
        corpus_raw=[{"id": "p1", "title": "Project A", "source_type": "project", "similarity": 0.8}],
        corpus_documents=[
            {
                "document_id": "d1",
                "chunk_id": "c1",
                "title": "Better Connected",
                "publisher": "DfT",
                "similarity": 0.77,
                "source_type": "knowledge_doc",
            }
        ],
    )
    merged = merge_corpus_hits(bag)
    assert len(merged) == 2
    assert merged[1]["source_type"] == "knowledge_doc"
    assert merged[1]["id"] == "d1"


def test_merge_document_citations_into_spec():
    spec = AnswerSpec.model_validate(
        {
            "object": "Strategy alignment",
            "scope": "CORPUS",
            "mode": "Diagnose",
            "tier": "Indicative",
            "verdict": {"sentence": "x", "tail": ""},
            "soWhat": {
                "lookingAt": "a",
                "oneDecision": "b",
                "gate": "c",
                "primaryAction": "d",
                "turn": "1/4",
            },
            "corpus_citations": [
                CorpusCitation(id="p1", title="Project", score=0.7, source_type="project")
            ],
        }
    )
    wide = WidePassResult(
        outcome="diagnose",
        query="alignment",
        evidence_bag=EvidenceBag(
            corpus_documents=[
                {
                    "document_id": "d1",
                    "title": "Better Connected",
                    "publisher": "DfT",
                    "similarity": 0.81,
                    "source_type": "knowledge_doc",
                }
            ]
        ),
    )
    out = merge_document_citations_into_spec(spec, wide)
    assert len(out.corpus_citations) == 2
    assert out.corpus_citations[1].source_type == "knowledge_doc"


def test_citations_from_hits_knowledge_doc():
    cites = citations_from_hits(
        [{"document_id": "d1", "title": "IUK plan", "publisher": "Innovate UK", "similarity": 0.6}]
    )
    assert cites[0].id == "d1"
    assert cites[0].organisation == "Innovate UK"
