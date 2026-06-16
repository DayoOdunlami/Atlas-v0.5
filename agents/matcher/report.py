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
    is_demo_comparison: bool = False,
    passport_is_fixture: bool = False,
    spec_is_fixture: bool = False,
    original_query: str | None = None,
) -> dict[str, Any]:
    """
    Run the full Diagnose pipeline and return a verified AtlasRenderModel.

    Honestly labels fixture-driven comparisons via `is_demo_comparison` so the
    UI/chat can disclose what the user is actually looking at.
    """
    passport_errors = validate_passport(passport)
    spec_errors = validate_requirement_spec(spec)

    if passport_errors or spec_errors:
        error_notes = " | ".join(passport_errors + spec_errors)
        return build_atlas_render_model(
            outcome="diagnose",
            headline=f"Incomplete data: {passport.entity_name} × {spec.title}",
            insight_card=f"Validation errors prevented matching: {error_notes}",
            confidence_tier="Speculative",
            corpus_citations=corpus_citations or [],
            query=original_query or f"{passport.entity_name} vs {spec.title}",
            canonical_question_id=canonical_question_id,
            thread_id=thread_id,
        )

    match_result = run_matcher(passport, spec)
    translated_claims = translate_match_result(match_result)
    translation_summary = summarise_translation(translated_claims)

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

    essential_ready = translation_summary["essential_ready"]
    total_essential = translation_summary["total_essential"]

    if is_demo_comparison:
        headline = (
            f"Sample comparison — {passport.entity_name} × {spec.title}"
        )
    else:
        headline = (
            f"{passport.entity_name}: {essential_ready}/{total_essential} essential criteria met for {spec.title}"
        )

    executive_summary = _build_executive_summary(
        passport=passport,
        spec=spec,
        match_result=match_result,
        translation_summary=translation_summary,
        is_demo_comparison=is_demo_comparison,
        passport_is_fixture=passport_is_fixture,
        spec_is_fixture=spec_is_fixture,
        citation_count=citation_count,
    )

    vc = match_result.verdict_counts
    insight = (
        f"Match assessment: {vc.get('FIT', 0)} FIT, {vc.get('GAP', 0)} GAP, "
        f"{vc.get('RISK', 0)} RISK, {vc.get('MOVE', 0)} MOVE across {len(match_result.matches)} criteria. "
        f"Overall fit score: {match_result.overall_fit_score:.0%}. "
        f"Gap severity: {match_result.gap_severity:.0%}."
    )

    sections: dict[str, str] = {
        "entity": f"{passport.entity_name} ({passport.owner_org})",
        "opportunity": spec.title,
        "funder": spec.funder,
        "overall_fit_score": f"{match_result.overall_fit_score:.0%}",
        "gap_severity": f"{match_result.gap_severity:.0%}",
        "executive_summary": executive_summary,
    }
    if is_demo_comparison:
        sections["sample_disclosure"] = _sample_disclosure(passport_is_fixture, spec_is_fixture)

    block_caption = _executive_caption(match_result, translation_summary, is_demo_comparison)

    return build_atlas_render_model(
        outcome="diagnose",
        headline=headline,
        insight_card=executive_summary,  # promote exec summary to the primary insight
        sections=sections,
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=original_query or f"{passport.entity_name} vs {spec.title}",
        extra={
            "executive_summary": executive_summary,
            "match_assessment_caption": insight,
            "is_demo_comparison": is_demo_comparison,
            "passport_is_fixture": passport_is_fixture,
            "spec_is_fixture": spec_is_fixture,
            "match_result": match_result.to_dict(),
            "translation_summary": translation_summary,
            "blocks_data": {
                "executive_summary": {
                    "summary": executive_summary,
                    "caption": block_caption,
                    "is_demo_comparison": is_demo_comparison,
                },
                "match_bench": {
                    "matches": match_result.to_dict()["matches"],
                    "what_this_means": (
                        "Each row is one essential criterion in the call vs the strongest claim "
                        "in the passport. MOVE/GAP rows are where evidence is missing or needs reframing."
                    ),
                },
                "transfer_lanes": {
                    "lanes": translation_summary["claims"],
                    "what_this_means": (
                        "Four-lane verdict: which evidence travels as-is, needs reframing, "
                        "is not credible here, or is missing entirely."
                    ),
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
                    "what_this_means": (
                        "Capability dimensions the call needs vs what the passport claims. "
                        "Unknown = no claim found in this dimension; not a measured weakness."
                    ),
                },
            },
        },
    )


def _build_executive_summary(
    *,
    passport: Passport,
    spec: RequirementSpec,
    match_result: Any,
    translation_summary: dict[str, Any],
    is_demo_comparison: bool,
    passport_is_fixture: bool,
    spec_is_fixture: bool,
    citation_count: int,
) -> str:
    essential_ready = translation_summary["essential_ready"]
    total_essential = translation_summary["total_essential"]
    fit_score = match_result.overall_fit_score
    vc = match_result.verdict_counts

    parts: list[str] = []

    if is_demo_comparison:
        parts.append(
            f"**Sample comparison.** You're seeing {passport.entity_name} matched against "
            f"{spec.title} — "
            + _sample_disclosure(passport_is_fixture, spec_is_fixture)
            + " The score below reflects this sample, not CPC's true state of play."
        )
    else:
        if essential_ready == 0:
            parts.append(
                f"**No essential criteria met as-is** for {spec.title} from the {passport.entity_name} passport."
            )
        elif essential_ready < total_essential:
            parts.append(
                f"**{essential_ready} of {total_essential} essential criteria** travel as-is from "
                f"{passport.entity_name} to {spec.title}."
            )
        else:
            parts.append(
                f"**All {total_essential} essential criteria** are met from {passport.entity_name}."
            )

    if vc.get("MOVE", 0) and vc["MOVE"] == len(match_result.matches):
        parts.append(
            "Every criterion is currently **MOVE (evidence not yet mapped)** — this most often "
            "means the passport hasn't claimed evidence in these dimensions, not that CPC lacks it. "
            "Strongest next step is to ingest specific project case studies into the passport."
        )
    elif vc.get("MOVE", 0):
        parts.append(
            f"{vc['MOVE']} criteria are MOVE — claim evidence is missing in the passport for these dimensions."
        )

    if citation_count == 0:
        parts.append(
            "Corpus search returned **no related projects** for this query — either the topic isn't "
            "indexed or the query terms didn't match. Try a sector-specific reframing."
        )
    elif citation_count:
        parts.append(
            f"Corpus search found **{citation_count}** related project(s) — see citations panel."
        )

    return "  \n".join(parts)


def _sample_disclosure(passport_is_fixture: bool, spec_is_fixture: bool) -> str:
    bits: list[str] = []
    if passport_is_fixture:
        bits.append("the passport is a 3-claim demo")
    if spec_is_fixture:
        bits.append("the spec is the demo Innovate UK Smart Mobility call")
    if not bits:
        return ""
    return "(" + " and ".join(bits) + ")."


def _executive_caption(match_result: Any, translation_summary: dict[str, Any], is_demo: bool) -> str:
    if is_demo:
        return "Sample comparison — score reflects demo fixtures, not real CPC state."
    fit = match_result.overall_fit_score
    if fit >= 0.6:
        return "Strong fit — proceed with evidence pack."
    if fit >= 0.3:
        return "Partial fit — close gaps before bidding."
    return "Weak fit on current passport — investigate evidence in source projects."
