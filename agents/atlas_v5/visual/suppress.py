"""Weak-data suppression — when charts would mislead."""

from __future__ import annotations

from dataclasses import dataclass

from agents.atlas_v5.intent import is_strategy_alignment_query
from agents.atlas_v5.visual.data_profile import DataProfile

MAX_CHARTS_PER_TURN = 3


@dataclass
class SuppressionDecision:
    allow_any: bool
    max_charts: int
    strength: str  # strong | moderate | weak
    reasons: list[str]


def assess_data_strength(profile: DataProfile) -> SuppressionDecision:
    reasons: list[str] = []

    if is_strategy_alignment_query(profile.query):
        reasons.append(
            "strategy alignment — prose + gap matrix only until pillar tags exist"
        )
        return SuppressionDecision(
            allow_any=False,
            max_charts=0,
            strength="moderate",
            reasons=reasons,
        )

    if profile.project_count < 2 and profile.citation_count < 3:
        reasons.append("fewer than 2 projects and fewer than 3 citations — visuals would mislead")
        return SuppressionDecision(
            allow_any=False,
            max_charts=0,
            strength="weak",
            reasons=reasons,
        )

    if profile.tier == "Speculative" and profile.project_count < 5:
        reasons.append("Speculative tier with thin corpus — at most one simple visual")
        return SuppressionDecision(
            allow_any=True,
            max_charts=1,
            strength="weak",
            reasons=reasons,
        )

    if profile.is_sparse:
        reasons.append("sparse slice — limit to one visual")
        return SuppressionDecision(
            allow_any=True,
            max_charts=1,
            strength="moderate",
            reasons=reasons,
        )

    if profile.project_count >= 10 and profile.has_funder_breakdown:
        return SuppressionDecision(
            allow_any=True,
            max_charts=MAX_CHARTS_PER_TURN,
            strength="strong",
            reasons=[],
        )

    return SuppressionDecision(
        allow_any=True,
        max_charts=min(2, MAX_CHARTS_PER_TURN),
        strength="moderate",
        reasons=reasons or ["moderate corpus depth — up to two visuals"],
    )
