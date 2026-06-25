"""Data-to-viz opportunity selection — deterministic, infographic-aligned."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from agents.atlas_v5.visual.data_profile import DataProfile
from agents.atlas_v5.visual.suppress import SuppressionDecision, assess_data_strength

ChartKind = Literal["bar", "pie", "heatmap", "sankey"]
ChartRole = Literal["ranking", "composition", "distribution", "flow", "coverage", "compare"]

_FLOW_RE = re.compile(
    r"\b(flow|pathway|route|channel|sankey|where.*fund|fund.*move|network|ecosystem)\b",
    re.I,
)
_COVERAGE_RE = re.compile(
    r"\b(thin|gap|missing|weak|coverage|evidence gap|where.*lack)\b",
    re.I,
)
_COMPARE_RE = re.compile(r"\b(compare|versus|vs\.?|rank|top \d+|breakdown|share)\b", re.I)
_TEMPORAL_RE = re.compile(
    r"\b(over time|timeline|trend|year|since 20|historical|evolution|trajectory)\b",
    re.I,
)
_THEME_RE = re.compile(
    r"\b(mode|theme|modal|sector mix|stacked|by mode|by theme|transport mode)\b",
    re.I,
)
_DECISION_RE = re.compile(
    r"\b(which|should we|prioriti[sz]e|decide|choose|recommend|where to invest)\b",
    re.I,
)


@dataclass
class VisualOpportunity:
    kind: ChartKind
    role: ChartRole
    story: str
    priority: int


@dataclass
class OpportunityPlan:
    opportunities: list[VisualOpportunity] = field(default_factory=list)
    rejected: list[dict[str, str]] = field(default_factory=list)
    suppression: SuppressionDecision | None = None
    intent: str = "unknown"


def _classify_intent(profile: DataProfile) -> str:
    q = profile.query
    if profile.outcome == "connect" or _FLOW_RE.search(q):
        return "flow_pathway"
    if _COVERAGE_RE.search(q):
        return "evidence_coverage"
    if _DECISION_RE.search(q):
        return "decision_surface"
    if _TEMPORAL_RE.search(q) or profile.has_temporal_series:
        return "temporal_audit"
    if _THEME_RE.search(q) or profile.has_theme_breakdown:
        return "theme_mix"
    if _COMPARE_RE.search(q):
        return "comparison_ranking"
    if profile.has_funder_breakdown:
        return "portfolio_audit"
    return "unknown"


def select_opportunities(profile: DataProfile) -> OpportunityPlan:
    suppression = assess_data_strength(profile)
    plan = OpportunityPlan(suppression=suppression, intent=_classify_intent(profile))

    if not suppression.allow_any:
        plan.rejected.append(
            {"kind": "all", "reason": "; ".join(suppression.reasons) or "data too weak"}
        )
        return plan

    candidates: list[VisualOpportunity] = []

    if profile.has_funder_breakdown and profile.funded_funder_count >= 2:
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="ranking",
                story="Lead-funder skew in corpus slice — floor funding only",
                priority=10 if plan.intent == "comparison_ranking" else 8,
            )
        )

    if (
        profile.has_funder_breakdown
        and profile.null_funding_ratio >= 0.12
        and profile.funder_count >= 2
    ):
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="distribution",
                story="Null funding concentrates by funder — shapes floor interpretation",
                priority=9 if profile.null_funding_ratio >= 0.25 else 7,
            )
        )

    if 2 <= profile.funder_count <= 5 and profile.funded_funder_count >= 2:
        candidates.append(
            VisualOpportunity(
                kind="pie",
                role="composition",
                story="Part-of-whole view of corpus floor by lead funder",
                priority=6,
            )
        )

    if profile.has_evidence_matrix:
        candidates.append(
            VisualOpportunity(
                kind="heatmap",
                role="coverage",
                story="Evidence density by source type and confidence band",
                priority=9 if plan.intent == "evidence_coverage" else 5,
            )
        )

    if profile.has_flow_data and (
        plan.intent == "flow_pathway" or profile.outcome == "connect"
    ):
        candidates.append(
            VisualOpportunity(
                kind="sankey",
                role="flow",
                story="Organisation and evidence-type flows in retrieved slice",
                priority=10 if plan.intent == "flow_pathway" else 7,
            )
        )

    if profile.has_temporal_series:
        candidates.append(
            VisualOpportunity(
                kind="line",
                role="temporal",
                story="Project starts by year — corpus slice trajectory",
                priority=10 if plan.intent == "temporal_audit" else 6,
            )
        )

    if profile.has_theme_breakdown:
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="theme_stack",
                story="Mode × theme project mix in corpus slice",
                priority=9 if plan.intent == "theme_mix" else 5,
            )
        )

    if profile.has_scale_conflict or (
        profile.has_web_programme
        and profile.has_funder_breakdown
        and profile.lead_lane in ("web", "balanced")
    ):
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="compare",
                story="Corpus floor vs web programme scale — peer lanes, not incumbent vs second-class",
                priority=11 if profile.has_scale_conflict else 9,
            )
        )

    if (
        profile.has_web_programme
        and profile.lead_lane == "web"
        and not profile.has_scale_conflict
    ):
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="evolution",
                story="Web-validated programme scale leads this turn",
                priority=10,
            )
        )

    candidates.sort(key=lambda o: -o.priority)

    seen_roles: set[str] = set()
    for opp in candidates:
        if opp.role in seen_roles:
            plan.rejected.append(
                {"kind": opp.kind, "reason": f"duplicate role {opp.role} — lower priority skipped"}
            )
            continue
        if len(plan.opportunities) >= suppression.max_charts:
            plan.rejected.append(
                {"kind": opp.kind, "reason": f"max charts ({suppression.max_charts}) reached"}
            )
            continue
        seen_roles.add(opp.role)
        plan.opportunities.append(opp)

    if not plan.opportunities and profile.project_count >= 2 and profile.funded_funder_count >= 1:
        plan.rejected.append(
            {"kind": "bar", "reason": "no opportunity passed data-shape + intent filters"}
        )

    return plan
