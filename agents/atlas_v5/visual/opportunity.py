"""Data-to-viz opportunity selection — question × discovery pairing."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from agents.atlas_v5.intent import is_strategy_alignment_query
from agents.atlas_v5.visual.data_profile import DataProfile
from agents.atlas_v5.visual.suppress import SuppressionDecision, assess_data_strength

ChartKind = Literal["bar", "pie", "heatmap", "sankey", "line"]
ChartRole = Literal[
    "ranking",
    "composition",
    "distribution",
    "flow",
    "coverage",
    "compare",
    "temporal",
    "theme_stack",
    "evolution",
]

_FLOW_RE = re.compile(
    r"\b(flow|pathway|route|channel|sankey|where.*fund|fund.*move|network|ecosystem|connect)\b",
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
    r"\b(which|should we|prioriti[sz]e|decide|choose|recommend|where to invest|best way|opportunit)\b",
    re.I,
)
_FUNDING_RE = re.compile(
    r"\b(fund|funder|grant|£|budget|investment|innovate uk|epsrc|dft)\b",
    re.I,
)
_CORPUS_FLOOR_RE = re.compile(
    r"\b(state of play|landscape|funding floor|corpus floor|magnitude)\b",
    re.I,
)
_SWOT_RE = re.compile(r"\b(swot|s\.w\.o\.t)\b", re.I)

# Minimum discovery strength before any chart can attach.
_MIN_DISCOVERY = 0.30
# Combined score when question and data both contribute.
_ALIGN_THRESHOLD = 0.52
# Higher bar when the question did not ask for this shape (discovery-led surprise).
_DISCOVERY_SURPRISE_THRESHOLD = 0.60
# Question-led attach needs at least this much data behind the visual.
_MIN_DISCOVERY_FOR_ASK = 0.32

_FUNDING_ROLES = frozenset({"ranking", "distribution", "composition", "compare", "evolution"})


@dataclass
class VisualOpportunity:
    kind: ChartKind
    role: ChartRole
    story: str
    priority: int
    query_affinity: float = 0.0
    discovery_strength: float = 0.0
    pairing_score: float = 0.0
    pairing_mode: str = ""


@dataclass
class OpportunityPlan:
    opportunities: list[VisualOpportunity] = field(default_factory=list)
    rejected: list[dict[str, str]] = field(default_factory=list)
    suppression: SuppressionDecision | None = None
    intent: str = "unknown"


def _classify_intent(profile: DataProfile) -> str:
    """Primary question shape — guides affinity, not a hard on/off gate."""
    q = profile.query
    if profile.outcome == "connect" or _FLOW_RE.search(q):
        return "flow_pathway"
    if _COVERAGE_RE.search(q):
        return "evidence_coverage"
    if _TEMPORAL_RE.search(q):
        return "temporal_audit"
    if _THEME_RE.search(q):
        return "theme_mix"
    if _COMPARE_RE.search(q):
        return "comparison_ranking"
    if _FUNDING_RE.search(q) or _CORPUS_FLOOR_RE.search(q):
        return "portfolio_audit"
    if _DECISION_RE.search(q):
        return "decision_surface"
    return "unknown"


def _discovery_strength(role: ChartRole, profile: DataProfile) -> float:
    """How much usable shape did search/stats actually surface for this visual?"""
    if role == "ranking":
        if not profile.has_funder_breakdown or profile.funded_funder_count < 2:
            return 0.0
        strength = 0.35 + min(profile.funded_funder_count, 6) * 0.1
        if profile.project_count >= 10:
            strength += 0.15
        return min(1.0, strength)

    if role == "distribution":
        if not profile.has_funder_breakdown or profile.funder_count < 2:
            return 0.0
        if profile.null_funding_ratio < 0.12:
            return 0.0
        return min(1.0, 0.30 + profile.null_funding_ratio + profile.funder_count * 0.05)

    if role == "composition":
        if not (2 <= profile.funder_count <= 5 and profile.funded_funder_count >= 2):
            return 0.0
        return min(1.0, 0.40 + profile.funded_funder_count * 0.12)

    if role == "coverage":
        if not profile.has_evidence_matrix:
            return 0.0
        return min(1.0, 0.35 + profile.citation_count * 0.06)

    if role == "flow":
        if not profile.has_flow_data:
            return 0.0
        return min(1.0, 0.30 + profile.flow_link_count * 0.12)

    if role == "temporal":
        if not profile.has_temporal_series:
            return 0.0
        return min(1.0, 0.32 + profile.temporal_year_count * 0.14)

    if role == "theme_stack":
        if not profile.has_theme_breakdown:
            return 0.0
        return min(1.0, 0.34 + profile.theme_pair_count * 0.1)

    if role == "compare":
        if not (
            profile.has_scale_conflict
            or (
                profile.has_web_programme
                and profile.has_funder_breakdown
                and profile.lead_lane in ("web", "balanced")
            )
        ):
            return 0.0
        strength = 0.45
        if profile.has_scale_conflict:
            strength += 0.25
        if profile.web_verified_count >= 1:
            strength += 0.1
        return min(1.0, strength)

    if role == "evolution":
        if not (
            profile.has_web_programme
            and profile.lead_lane == "web"
            and not profile.has_scale_conflict
        ):
            return 0.0
        return min(1.0, 0.55 + profile.web_verified_count * 0.08)

    return 0.0


def _query_affinity(role: ChartRole, intent: str, query: str, profile: DataProfile) -> float:
    """How well would this visual serve the user's question if data supports it?"""
    if _SWOT_RE.search(query):
        return 0.05

    if is_strategy_alignment_query(query):
        if role == "coverage" and (_COVERAGE_RE.search(query) or intent == "evidence_coverage"):
            return 0.82
        if role in _FUNDING_ROLES or role == "temporal":
            return 0.08
        if role == "flow":
            return 0.12
        if role == "coverage" and profile.has_evidence_matrix:
            return 0.38
        return 0.12

    affinity = 0.18

    if role == "ranking":
        if intent in ("comparison_ranking", "portfolio_audit"):
            affinity += 0.45
        if _FUNDING_RE.search(query) or _CORPUS_FLOOR_RE.search(query):
            affinity += 0.28
        if _COMPARE_RE.search(query):
            affinity += 0.12

    elif role == "distribution":
        if intent == "portfolio_audit":
            affinity += 0.40
        if _FUNDING_RE.search(query):
            affinity += 0.30

    elif role == "composition":
        if intent in ("comparison_ranking", "portfolio_audit"):
            affinity += 0.35
        if _COMPARE_RE.search(query) and "share" in query.lower():
            affinity += 0.25

    elif role == "coverage":
        if intent == "evidence_coverage":
            affinity += 0.50
        if _COVERAGE_RE.search(query):
            affinity += 0.35
        if intent == "flow_pathway":
            affinity = max(affinity, 0.42)

    elif role == "flow":
        if intent == "flow_pathway" or profile.outcome == "connect":
            affinity += 0.55
        if _FLOW_RE.search(query):
            affinity += 0.30

    elif role == "temporal":
        if intent == "temporal_audit":
            affinity += 0.55
        if _TEMPORAL_RE.search(query):
            affinity += 0.30
        if intent == "decision_surface" and profile.has_temporal_series:
            affinity = max(affinity, 0.32)

    elif role == "theme_stack":
        if intent == "theme_mix":
            affinity += 0.55
        if _THEME_RE.search(query):
            affinity += 0.30

    elif role == "compare":
        if intent in ("comparison_ranking", "portfolio_audit"):
            affinity += 0.40
        if _COMPARE_RE.search(query) or _CORPUS_FLOOR_RE.search(query):
            affinity += 0.28

    elif role == "evolution":
        if _CORPUS_FLOOR_RE.search(query) or profile.lead_lane == "web":
            affinity += 0.35

    if intent == "decision_surface":
        affinity += 0.08

    return min(1.0, affinity)


def _pair_opportunity(
    role: ChartRole,
    intent: str,
    query: str,
    profile: DataProfile,
) -> tuple[bool, float, float, float, str]:
    """
    Score question × discovery pairing.

    Returns (attach, query_affinity, discovery_strength, combined_score, mode).
    """
    qa = _query_affinity(role, intent, query, profile)
    ds = _discovery_strength(role, profile)

    if ds < _MIN_DISCOVERY:
        return False, qa, ds, 0.0, "discovery too thin"

    if qa >= 0.62:
        score = 0.58 * qa + 0.42 * ds
        if ds >= _MIN_DISCOVERY_FOR_ASK and score >= _ALIGN_THRESHOLD:
            return True, qa, ds, score, "question-led"
        return False, qa, ds, score, "question asks for visual but discovery insufficient"

    if ds >= 0.68 and qa >= 0.22:
        score = 0.32 * qa + 0.68 * ds
        if score >= _DISCOVERY_SURPRISE_THRESHOLD:
            return True, qa, ds, score, "discovery-led"
        return False, qa, ds, score, "strong discovery but weak question fit"

    score = 0.50 * qa + 0.50 * ds
    if score >= _ALIGN_THRESHOLD:
        return True, qa, ds, score, "aligned"

    return False, qa, ds, score, "pairing below threshold"


def _candidate_opportunities(profile: DataProfile, intent: str) -> list[VisualOpportunity]:
    """All chart shapes the discovery layer could build — scoring decides attach."""
    candidates: list[VisualOpportunity] = []

    if profile.has_funder_breakdown and profile.funded_funder_count >= 2:
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="ranking",
                story="Lead-funder skew in corpus slice — floor funding only",
                priority=10 if intent == "comparison_ranking" else 8,
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
                priority=9 if intent == "evidence_coverage" else 5,
            )
        )

    if profile.has_flow_data:
        candidates.append(
            VisualOpportunity(
                kind="sankey",
                role="flow",
                story="Organisation and evidence-type flows in retrieved slice",
                priority=10 if intent == "flow_pathway" else 7,
            )
        )

    if profile.has_temporal_series:
        candidates.append(
            VisualOpportunity(
                kind="line",
                role="temporal",
                story="Project starts by year — corpus slice trajectory",
                priority=10 if intent == "temporal_audit" else 6,
            )
        )

    if profile.has_theme_breakdown:
        candidates.append(
            VisualOpportunity(
                kind="bar",
                role="theme_stack",
                story="Mode × theme project mix in corpus slice",
                priority=9 if intent == "theme_mix" else 5,
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

    return candidates


def select_opportunities(profile: DataProfile) -> OpportunityPlan:
    suppression = assess_data_strength(profile)
    intent = _classify_intent(profile)
    plan = OpportunityPlan(suppression=suppression, intent=intent)

    if is_strategy_alignment_query(profile.query):
        plan.rejected.append(
            {
                "kind": "all",
                "reason": "strategy alignment — no portfolio charts until pillar concordance exists",
            }
        )
        return plan

    if not suppression.allow_any:
        plan.rejected.append(
            {"kind": "all", "reason": "; ".join(suppression.reasons) or "data too weak"}
        )
        return plan

    scored: list[VisualOpportunity] = []
    for opp in _candidate_opportunities(profile, intent):
        attach, qa, ds, score, mode = _pair_opportunity(
            opp.role, intent, profile.query, profile
        )
        opp.query_affinity = round(qa, 3)
        opp.discovery_strength = round(ds, 3)
        opp.pairing_score = round(score, 3)
        opp.pairing_mode = mode
        if attach:
            opp.priority = int(round(score * 10))
            scored.append(opp)
        else:
            plan.rejected.append(
                {
                    "kind": opp.kind,
                    "role": opp.role,
                    "reason": mode,
                    "query_affinity": str(opp.query_affinity),
                    "discovery_strength": str(opp.discovery_strength),
                    "pairing_score": str(opp.pairing_score),
                }
            )

    scored.sort(key=lambda o: (-o.pairing_score, -o.priority))

    seen_roles: set[str] = set()
    for opp in scored:
        if opp.role in seen_roles:
            plan.rejected.append(
                {"kind": opp.kind, "reason": f"duplicate role {opp.role} — lower score skipped"}
            )
            continue
        if len(plan.opportunities) >= suppression.max_charts:
            plan.rejected.append(
                {"kind": opp.kind, "reason": f"max charts ({suppression.max_charts}) reached"}
            )
            continue
        seen_roles.add(opp.role)
        plan.opportunities.append(opp)

    if not plan.opportunities and profile.project_count >= 2:
        plan.rejected.append(
            {"kind": "all", "reason": "no chart passed question × discovery pairing threshold"}
        )

    return plan
