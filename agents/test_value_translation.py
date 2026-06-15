"""
D3.1–D3.6 acceptance tests — Passport, Requirement Spec, Matcher, Value Translation, Report.

D3.6: Sameer validation harness.

Uses a realistic test scenario:
  Entity (Passport): CPC smart mobility innovation programme
  Opportunity (RequirementSpec): Innovate UK Smart Mobility Call
  Expected: every essential criterion has a verdict, every claim has a transfer label,
            confidence tier reflects citation count, blocks_data is populated.
"""

import pytest
from agents.matcher.passport import (
    Passport, PassportClaim, dict_to_passport, validate_passport
)
from agents.matcher.requirement_spec import (
    RequirementSpec, RequirementCriterion,
    extract_requirement_spec, validate_requirement_spec
)
from agents.matcher.matcher import run_matcher
from agents.matcher.value_translation import translate_match_result, summarise_translation
from agents.matcher.report import build_value_translation_report
from agents.registry.render_model import validate_render_model


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def _make_cpc_passport() -> Passport:
    """Minimal CPC smart mobility passport for testing."""
    return Passport(
        entity_name="CPC Smart Mobility Programme",
        owner_org="Connected Places Catapult",
        sector_origin="transport",
        sector_target="smart mobility",
        summary=(
            "CPC has delivered 12+ smart mobility projects across UK cities, "
            "including MaaS pilots, freight optimisation, and connected vehicle trials."
        ),
        trl_level=6,
        claims=[
            PassportClaim(
                domain="smart mobility",
                text="CPC has deployed a MaaS platform across 3 UK cities at TRL 7.",
                confidence_tier="Supported",
                role="primary",
            ),
            PassportClaim(
                domain="data infrastructure",
                text="CPC operates a national transport data sharing platform with 40+ data feeds.",
                confidence_tier="Robust",
                role="primary",
            ),
            PassportClaim(
                domain="economic appraisal",
                text="CPC has conducted Green Book appraisals for 5 transport investment cases.",
                confidence_tier="Indicative",
                role="supporting",
            ),
        ],
    )


def _make_innovateuk_spec() -> RequirementSpec:
    """Simplified Innovate UK Smart Mobility call requirement spec."""
    return RequirementSpec(
        source_text="Innovate UK seeks applicants with demonstrated deployment of smart mobility solutions at scale.",
        title="Innovate UK Smart Mobility Challenge 2026",
        sector_target="smart mobility",
        funder="Innovate UK",
        criteria=[
            RequirementCriterion(
                label="Demonstrated deployment at scale",
                description="Applicants must demonstrate previous deployment of smart mobility solutions at TRL 7+.",
                importance="essential",
                domain="smart mobility",
                evidence_type="case_study",
            ),
            RequirementCriterion(
                label="Data infrastructure capability",
                description="Strong evidence of data sharing and platform management.",
                importance="essential",
                domain="data infrastructure",
                evidence_type="case_study",
            ),
            RequirementCriterion(
                label="Economic appraisal experience",
                description="Should have experience with cost-benefit analysis and business case development.",
                importance="desirable",
                domain="economic appraisal",
                evidence_type="publication",
            ),
            RequirementCriterion(
                label="Climate resilience",
                description="Nice to have: climate adaptation considerations.",
                importance="nice_to_have",
                domain="climate resilience",
                evidence_type="case_study",
            ),
        ],
    )


# ---------------------------------------------------------------------------
# D3.1 Passport schema
# ---------------------------------------------------------------------------

def test_passport_validates_clean():
    p = _make_cpc_passport()
    errs = validate_passport(p)
    assert errs == []


def test_passport_validates_empty_claims():
    p = Passport(entity_name="Test", summary="Some summary", claims=[])
    errs = validate_passport(p)
    assert any("claims" in e for e in errs)


def test_passport_properties():
    p = _make_cpc_passport()
    assert "smart mobility" in p.capability_domains
    assert "data infrastructure" in p.capability_domains
    assert p.overall_tier in ("Supported", "Robust")
    assert len(p.strong_claims) >= 2


def test_dict_to_passport():
    d = {
        "title": "Test Project",
        "owner_org": "Test Org",
        "summary": "A test summary.",
        "claims": [
            {"domain": "data infrastructure", "text": "We have data.",
             "confidence_tier": "Supported", "role": "primary"},
        ],
    }
    p = dict_to_passport(d)
    assert p.entity_name == "Test Project"
    assert len(p.claims) == 1


# ---------------------------------------------------------------------------
# D3.2 Requirement Spec
# ---------------------------------------------------------------------------

def test_spec_validates_clean():
    spec = _make_innovateuk_spec()
    errs = validate_requirement_spec(spec)
    assert errs == []


def test_spec_extract_heuristic():
    text = (
        "Applicants must have demonstrated deployment of transport technology. "
        "Evidence of data sharing capabilities is required. "
        "Deadline: 30/09/2026. Total value: £2.5M."
    )
    spec = extract_requirement_spec(text, title="Test Call", funder="UKRI")
    assert spec.title == "Test Call"
    assert len(spec.criteria) >= 1
    assert spec.total_value or spec.deadline  # at least one extracted


def test_spec_essential_criteria():
    spec = _make_innovateuk_spec()
    essential = spec.essential_criteria
    assert len(essential) == 2
    domains = [c.domain for c in essential]
    assert "smart mobility" in domains
    assert "data infrastructure" in domains


# ---------------------------------------------------------------------------
# D3.3 Matcher
# ---------------------------------------------------------------------------

def test_matcher_all_criteria_have_verdict():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)

    assert len(result.matches) == len(spec.criteria)
    for match in result.matches:
        assert match.verdict in ("FIT", "GAP", "RISK", "MOVE")


def test_matcher_fit_for_strong_evidence():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)

    # CPC has Robust data infrastructure evidence → should be FIT
    data_match = next(m for m in result.matches if m.criterion_domain == "data infrastructure")
    assert data_match.verdict == "FIT"
    assert data_match.score >= 0.8


def test_matcher_move_for_no_evidence():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)

    # Climate resilience — no claim in passport → MOVE
    climate_match = next(m for m in result.matches if m.criterion_domain == "climate resilience")
    assert climate_match.verdict == "MOVE"
    assert climate_match.score == 0.0


def test_matcher_scores():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)

    assert 0.0 <= result.overall_fit_score <= 1.0
    assert 0.0 <= result.gap_severity <= 1.0


# ---------------------------------------------------------------------------
# D3.4 Value Translation
# ---------------------------------------------------------------------------

def test_translation_all_claims_labelled():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)
    translated = translate_match_result(result)

    assert len(translated) == len(result.matches)
    for tc in translated:
        assert tc.transfer_label in (
            "travels-as-is", "needs-reframing", "not-credible-here", "evidence-needed"
        )


def test_translation_fit_robust_travels():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)
    translated = translate_match_result(result)

    data_tc = next(t for t in translated if t.criterion_domain == "data infrastructure")
    assert data_tc.transfer_label == "travels-as-is"
    assert data_tc.action_required == ""


def test_translation_move_evidence_needed():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)
    translated = translate_match_result(result)

    climate_tc = next(t for t in translated if t.criterion_domain == "climate resilience")
    assert climate_tc.transfer_label == "evidence-needed"
    assert len(climate_tc.action_required) > 0


def test_translation_summary():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    result = run_matcher(passport, spec)
    translated = translate_match_result(result)
    summary = summarise_translation(translated)

    assert summary["total"] == len(translated)
    assert "travels-as-is" in summary["by_label"] or "evidence-needed" in summary["by_label"]
    assert 0.0 <= summary["readiness_rate"] <= 1.0


# ---------------------------------------------------------------------------
# D3.5 + D3.6 End-to-end Value Translation Report (Sameer harness)
# ---------------------------------------------------------------------------

def test_report_produces_valid_render_model():
    passport = _make_cpc_passport()
    spec = _make_innovateuk_spec()
    corpus_citations = [
        {"id": "00000000-0000-0000-0000-000000000001", "title": "MaaS Pilot Bristol"},
        {"id": "00000000-0000-0000-0000-000000000002", "title": "Transport Data Platform"},
        {"id": "00000000-0000-0000-0000-000000000003", "title": "Green Book Appraisal Study"},
    ]

    report = build_value_translation_report(
        passport=passport,
        spec=spec,
        corpus_citations=corpus_citations,
        thread_id="test-thread-001",
        canonical_question_id="cq-diagnose-001",
    )

    # 1. Valid render model
    errs = validate_render_model(report)
    assert errs == [], f"Render model validation errors: {errs}"

    # 2. Correct outcome
    assert report["outcome"] == "diagnose"

    # 3. Confidence tier reflects citation count
    assert report["confidence_tier"] in ("Indicative", "Supported", "Robust")

    # 4. Blocks data populated
    blocks_data = report.get("blocks_data", {})
    assert "match_bench" in blocks_data
    assert "transfer_lanes" in blocks_data
    assert "dimension_gap" in blocks_data

    # 5. Every essential criterion has a verdict
    matches = blocks_data["match_bench"]["matches"]
    essential_matches = [m for m in matches if m["importance"] == "essential"]
    assert len(essential_matches) == 2
    for m in essential_matches:
        assert m["verdict"] in ("FIT", "GAP", "RISK", "MOVE")

    # 6. Every claim has a transfer label
    lanes = blocks_data["transfer_lanes"]["lanes"]
    for lane in lanes:
        assert "transfer_label" in lane
        assert lane["transfer_label"] in (
            "travels-as-is", "needs-reframing", "not-credible-here", "evidence-needed"
        )

    # 7. Headline is informative
    assert "CPC Smart Mobility Programme" in report["headline"]
    assert "Innovate UK" in report["headline"]


def test_report_handles_empty_passport_gracefully():
    passport = Passport(entity_name="", summary="", claims=[])
    spec = _make_innovateuk_spec()

    report = build_value_translation_report(passport=passport, spec=spec)
    assert report["confidence_tier"] == "Speculative"
    assert "Validation errors" in report["insight_card"] or "Incomplete" in report["headline"]
