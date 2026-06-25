"""Trust model v2 — ledger, validators, reconcile."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import build_keyed_index
from agents.atlas_v5.reconcile_spec import reconcile_answer_spec
from agents.atlas_v5.trust.reconcile_v2 import resolve_lead_lane
from agents.atlas_v5.trust.validate_web import extract_programme_total_gbp
from agents.atlas_v5.visual.attach import attach_visuals
from agents.atlas_v5.wide_pass import WidePassResult
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _stats() -> J1T1CorpusStats:
    return J1T1CorpusStats(
        project_count=55,
        funding_sum=8_170_000,
        null_funding_count=10,
        funded_row_count=45,
        org_count=30,
        live_since_2024=27,
        funders=[
            FunderBreakdownRow("Innovate UK", 40, 2, 7_000_000),
            FunderBreakdownRow("EPSRC", 5, 5, 0),
        ],
    )


def test_ledger_corpus_figures_have_lane_and_validation():
    stats = _stats()
    skeleton = assemble_j1t1_spec(stats)
    wide = WidePassResult(
        outcome="orient",
        query="state of play",
        stats=stats,
        retrieval_meta={"lane_mode": "corpus_only", "external_skipped": True},
    )
    index = build_keyed_index(wide, skeleton)
    fig = index.get("stats.funding_floor_gbp")
    assert fig is not None
    assert fig.lane == "corpus"
    assert fig.validation_status == "verified"


def test_web_programme_extract_from_govuk_snippet():
    bag = EvidenceBag(
        external=[
            {
                "title": "Rail decarbonisation plan",
                "url": "https://www.gov.uk/government/publications/rail-decarbonisation",
                "publisher": "Department for Transport",
                "snippet": "The programme represents investment of £11.7 billion over the period.",
            }
        ],
        lane_mode="dual",
    )
    amount, status, _prov, refs = extract_programme_total_gbp(bag)
    assert amount is not None
    assert amount >= 1_000_000_000
    assert status in ("verified", "candidate")
    assert refs


def test_conflict_detection_corpus_floor_vs_web_programme():
    stats = _stats()
    skeleton = assemble_j1t1_spec(stats)
    bag = EvidenceBag(
        external=[
            {
                "title": "National programme",
                "url": "https://www.gov.uk/example",
                "publisher": "gov.uk",
                "snippet": "£11.7 billion programme funding",
            }
        ],
        lane_mode="dual",
    )
    wide = WidePassResult(
        outcome="orient",
        query="programme scale rail decarbonisation",
        stats=stats,
        evidence_bag=bag,
        retrieval_meta={"lane_mode": "dual", "external_count": 1},
    )
    spec = reconcile_answer_spec(skeleton, bag, query=wide.query, has_sql_stats=True)
    index = build_keyed_index(wide, spec)
    assert index.get("web.programme_total_gbp") is not None
    assert "funding_scale" in " ".join(index.conflict_keys)


def test_web_led_lane_on_programme_query():
    lead = resolve_lead_lane(
        "national programme scale for rail decarbonisation",
        shopping=None,
        corpus_substantive=True,
        web_substantive=True,
        index=build_keyed_index(
            WidePassResult(outcome="orient", query="q", stats=_stats()),
            assemble_j1t1_spec(_stats()),
        ),
    )
    assert lead == "web"


def test_dual_lane_attaches_peer_chart():
    stats = _stats()
    skeleton = assemble_j1t1_spec(stats)
    bag = EvidenceBag(
        external=[
            {
                "title": "Rail plan",
                "url": "https://www.gov.uk/rail",
                "publisher": "Department for Transport",
                "snippet": "£11.7 billion investment programme",
            }
        ],
        lane_mode="dual",
    )
    spec = reconcile_answer_spec(
        skeleton, bag, query="programme scale funding breakdown", has_sql_stats=True
    )
    wide = WidePassResult(
        outcome="orient",
        query="programme scale funding breakdown",
        stats=stats,
        evidence_bag=bag,
        corpus_hits=[{"source_type": "project", "organisation": "Org A"}],
        retrieval_meta={"lane_mode": "dual", "external_count": 1},
    )
    index = build_keyed_index(wide, spec)
    result = attach_visuals(spec, wide, index, wide.query)
    assert result.meta.get("lead_lane")
    assert len(result.spec.charts) >= 1
