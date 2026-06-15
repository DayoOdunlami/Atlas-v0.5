"""
agents.matcher.report
======================

Evidence Gap & Value Translation Report builder.

Assembles the Diagnose outcome render model from the full Phase 3 pipeline:
  Passport + Requirement Spec → MatchResult → TranslatedClaims → Report

Returns a ready-to-render AtlasRenderModel (from agents.registry.render_model)
populated with dimension_gap, match_bench, and transfer_lanes block data.
"""
from __future__ import annotations

from typing import Any

from agents.matcher.passport import Passport, validate_passport
from agents.matcher.requirement_spec import RequirementSpec, validate_requirement_spec
from agents.matcher.matcher import run_matcher
from agents.matcher.value_translation import translate_match_result, summarise_translation
from agents.registry.render_model import build_atlas_render_model


def build_value_translation_report(
    *,
    passport: Passport,
    spec: RequirementSpec,
    corpus_citations: list[dict[str, Any]] | None = None,
    thread_id: str | None = None,
    canonical_question_id: str | None = None,
) -> dict[str, Any]:
    """
    Run the full Diagnose pipeline and return a verified AtlasRenderModel.

    Acceptance criteria (D3.5):
      ✓ every_essential_criterion has a verdict (FIT | GAP | RISK | MOVE)
      ✓ every claim has a transfer_label
      ✓ confidence_tier is set correctly based on FIT count
      ✓ match_bench and transfer_lanes block data is populated
    """
    passport_errors = validate_passport(passport)
    spec_errors = validate_requirement_spec(spec)

    if passport_errors or spec_errors:
        # Return a Speculative report noting the validation issues
        error_notes = " | ".join(passport_errors + spec_errors)
        return build_atlas_render_model(
            outcome="diagnose",
            headline=f"Incomplete data: {passport.entity_name} × {spec.title}",
            insight_card=f"Validation errors prevented matching: {error_notes}",
            confidence_tier="Speculative",
            corpus_citations=corpus_citations or [],
            query=f"{passport.entity_name} vs {spec.title}",
            canonical_question_id=canonical_question_id,
            thread_id=thread_id,
        )

    match_result = run_matcher(passport, spec)
    translated_claims = translate_match_result(match_result)
    translation_summary = summarise_translation(translated_claims)

    # Determine confidence tier from fit score + citation count
    fit_score = match_result.overall_fit_score
    citations = corpus_citations or []
    citation_count = len(citations)

    if citation_count >= 5 and fit_score >= 0.6:
        tier = "Robust"
    elif citation_count >= 3 and fit_score >= 0.4:
        tier = "Supported"
    elif citation_count >= 1 or fit_score >= 0.2:
        tier = "Indicative"
    else:
        tier = "Speculative"

    # Build headline
    essential_ready = translation_summary["essential_ready"]
    total_essential = translation_summary["total_essential"]
    headline = (
        f"{passport.entity_name}: {essential_ready}/{total_essential} essential criteria met for {spec.title}"
    )

    # Build insight card
    vc = match_result.verdict_counts
    insight = (
        f"Match assessment: {vc.get('FIT', 0)} FIT, {vc.get('GAP', 0)} GAP, "
        f"{vc.get('RISK', 0)} RISK, {vc.get('MOVE', 0)} MOVE across {len(match_result.matches)} criteria. "
        f"Overall fit score: {match_result.overall_fit_score:.0%}. "
        f"Gap severity: {match_result.gap_severity:.0%}."
    )

    # Sections
    sections: dict[str, str] = {
        "entity": f"{passport.entity_name} ({passport.owner_org})",
        "opportunity": spec.title,
        "funder": spec.funder,
        "overall_fit_score": f"{match_result.overall_fit_score:.0%}",
        "gap_severity": f"{match_result.gap_severity:.0%}",
    }

    return build_atlas_render_model(
        outcome="diagnose",
        headline=headline,
        insight_card=insight,
        sections=sections,
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=f"{passport.entity_name} vs {spec.title}",
        extra={
            "match_result": match_result.to_dict(),
            "translation_summary": translation_summary,
            "blocks_data": {
                "match_bench": {
                    "matches": match_result.to_dict()["matches"],
                },
                "transfer_lanes": {
                    "lanes": translation_summary["claims"],
                },
                "dimension_gap": {
                    "dimensions": [
                        {
                            "domain": m.criterion_domain,
                            "verdict": m.verdict,
                            "score": m.score,
                            "description": m.rationale,
                        }
                        for m in match_result.matches
                    ],
                },
            },
        },
    )
