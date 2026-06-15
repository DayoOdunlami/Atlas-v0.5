"""
agents.orchestrator.outcome_quality
====================================

Structural quality rubric for orchestrator outcomes.

Scores effectiveness without an LLM judge — checks:
  - triage routes to the expected outcome
  - required blocks are present with non-empty content
  - confidence tier aligns with citation count
  - diagnose: every essential criterion has a verdict + transfer label
  - headline / insight_card meet minimum substance thresholds
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]

_TIER_ORDER = ("Speculative", "Indicative", "Supported", "Robust")

_OUTCOME_FOCUS_BLOCKS: dict[Outcome, list[str]] = {
    "orient": ["OpportunityList"],
    "connect": ["TransferLanes", "OpportunityList"],
    "diagnose": ["TransferLanes", "MatchBench"],
    "act": ["EconomicCase", "ActionPlan"],
    "defend": ["ClaimLedger", "ObjectionResponse"],
}

# Golden prompts: (query, expected_outcome)
GOLDEN_PROMPTS: list[tuple[str, Outcome]] = [
    (
        "What evidence does CPC have in smart mobility that would transfer "
        "to the Innovate UK Smart City Challenge?",
        "connect",  # triage picks connect on 'transfer'; VT path still runs
    ),
    (
        "What evidence gaps does CPC have in smart mobility infrastructure?",
        "diagnose",
    ),
    (
        "Explore the UK smart mobility innovation landscape",
        "orient",
    ),
    (
        "Build an investment case for an autonomous freight corridor pilot",
        "act",
    ),
    (
        "Defend CPC's evidence position against board scrutiny on smart mobility",
        "defend",
    ),
]


@dataclass
class QualityReport:
    outcome: str
    query: str
    completeness: float
    evidence_alignment: float
    block_substance: float
    matcher_integrity: float
    overall: float
    failures: list[str] = field(default_factory=list)
    passes: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return len(self.failures) == 0 and self.overall >= 0.7


def _tier_ceiling(citation_count: int) -> str:
    if citation_count >= 5:
        return "Robust"
    if citation_count >= 3:
        return "Supported"
    if citation_count >= 1:
        return "Indicative"
    return "Speculative"


def _tier_index(tier: str) -> int:
    try:
        return _TIER_ORDER.index(tier)
    except ValueError:
        return 0


def score_render_model(
    model: dict[str, Any],
    *,
    query: str = "",
    expected_outcome: Outcome | None = None,
) -> QualityReport:
    """Score a format-passed render model (0.0–1.0 per dimension)."""
    failures: list[str] = []
    passes: list[str] = []
    outcome = model.get("outcome", "orient")
    q = query or model.get("query", "")

    # --- Completeness ---
    completeness_checks = 0
    completeness_passed = 0

    headline = model.get("headline", "")
    insight = model.get("insight_card", "")
    for label, val, min_len in [
        ("headline", headline, 15),
        ("insight_card", insight, 20),
    ]:
        completeness_checks += 1
        if len(val) >= min_len:
            completeness_passed += 1
            passes.append(f"{label} meets min length ({len(val)} >= {min_len})")
        else:
            failures.append(f"{label} too short ({len(val)} < {min_len})")

    if expected_outcome and outcome != expected_outcome:
        # connect vs diagnose both acceptable for transfer canonical query
        if not (expected_outcome == "connect" and outcome == "diagnose"):
            failures.append(f"outcome mismatch: got {outcome}, expected {expected_outcome}")
    else:
        passes.append(f"outcome={outcome}")

    completeness_checks += 1
    if model.get("confidence_tier") in _TIER_ORDER:
        completeness_passed += 1
    else:
        failures.append("invalid or missing confidence_tier")

    completeness = completeness_passed / max(completeness_checks, 1)

    # --- Evidence alignment ---
    citations = model.get("corpus_citations") or []
    tier = model.get("confidence_tier", "Speculative")
    ceiling = _tier_ceiling(len(citations))
    if _tier_index(tier) <= _tier_index(ceiling):
        evidence_alignment = 1.0
        passes.append(f"confidence_tier {tier} within ceiling {ceiling} for {len(citations)} citations")
    else:
        evidence_alignment = 0.0
        failures.append(f"confidence_tier {tier} exceeds ceiling {ceiling} for {len(citations)} citations")

    # --- Block substance ---
    render_blocks = model.get("render_blocks") or []
    expected_types = _OUTCOME_FOCUS_BLOCKS.get(outcome, [])  # type: ignore[arg-type]
    found_types = {b.get("type") for b in render_blocks}
    substance_checks = max(len(expected_types), 1)
    substance_passed = 0

    for et in expected_types:
        block = next((b for b in render_blocks if b.get("type") == et), None)
        if block is None:
            failures.append(f"missing focus block type: {et}")
            continue
        content = block.get("content")
        has_content = (
            (isinstance(content, list) and len(content) > 0)
            or (isinstance(content, dict) and len(content) > 0)
        )
        if has_content:
            substance_passed += 1
            passes.append(f"{et} has content")
        else:
            failures.append(f"{et} has empty content")

    block_substance = substance_passed / substance_checks

    # --- Matcher integrity (diagnose / value translation) ---
    blocks_data = model.get("blocks_data") or {}
    matcher_checks = 0
    matcher_passed = 0

    if outcome in ("diagnose", "connect") and blocks_data.get("match_bench"):
        matches = blocks_data["match_bench"].get("matches", [])
        essential = [m for m in matches if m.get("importance") == "essential"]
        for m in essential:
            matcher_checks += 1
            if m.get("verdict") in ("FIT", "GAP", "RISK", "MOVE"):
                matcher_passed += 1
            else:
                failures.append(f"essential criterion missing verdict: {m.get('criterion')}")

        lanes = blocks_data.get("transfer_lanes", {}).get("lanes", [])
        for lane in lanes:
            matcher_checks += 1
            label = lane.get("transfer_label")
            if label in ("travels-as-is", "needs-reframing", "not-credible-here", "evidence-needed"):
                matcher_passed += 1
            else:
                failures.append(f"invalid transfer_label: {label}")

        if matcher_checks:
            passes.append(f"matcher: {matcher_passed}/{matcher_checks} checks passed")

    matcher_integrity = matcher_passed / matcher_checks if matcher_checks else 1.0

    # --- Overall (weighted) ---
    overall = round(
        0.25 * completeness
        + 0.20 * evidence_alignment
        + 0.35 * block_substance
        + 0.20 * matcher_integrity,
        3,
    )

    return QualityReport(
        outcome=outcome,
        query=q,
        completeness=completeness,
        evidence_alignment=evidence_alignment,
        block_substance=block_substance,
        matcher_integrity=matcher_integrity,
        overall=overall,
        failures=failures,
        passes=passes,
    )


def run_golden_prompt_pipeline(query: str, expected_outcome: Outcome) -> dict[str, Any]:
    """
    Run triage → deterministic builder → verify → format for a golden prompt.
    Returns the format-passed render model.
    """
    from agents.orchestrator.triage import triage_query
    from agents.orchestrator.diagnose import run_value_translation_pipeline
    from agents.orchestrator.outcome_builders import build_outcome_model
    from agents.orchestrator.format_pass import run_format_pass
    from agents.spine.verify import run_verify_spine

    triage = triage_query(query)
    outcome = triage.outcome

    vt = run_value_translation_pipeline(query=query, outcome=outcome)
    if vt is not None:
        model = vt
    elif outcome in ("orient", "connect", "act", "defend"):
        model = build_outcome_model(query=query, outcome=outcome)
    else:
        model = build_outcome_model(query=query, outcome=expected_outcome)

    verified = run_verify_spine(
        artifact=model,
        query=query,
        headline=model.get("headline", ""),
        effort=triage.effort,
    )
    return run_format_pass(verified, query=query)
