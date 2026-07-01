"""Attach 0..N charts to AnswerSpec from visual opportunity engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.visual.builders import build_chart_for_opportunity
from agents.atlas_v5.visual.data_profile import build_data_profile, _citations_as_dicts
from agents.atlas_v5.visual.opportunity import select_opportunities
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec, ChartBlock


@dataclass
class VisualAttachResult:
    spec: AnswerSpec
    meta: dict[str, Any] = field(default_factory=dict)


def attach_visuals(
    spec: AnswerSpec,
    wide: WidePassResult,
    index: KeyedFigureIndex,
    query: str,
) -> VisualAttachResult:
    if spec.charts or spec.chart is not None:
        return VisualAttachResult(spec=spec, meta={"visual_skipped": "charts already present"})

    profile = build_data_profile(wide, spec, query=query, index=index)
    plan = select_opportunities(profile)
    citations = _citations_as_dicts(wide, spec)
    stats: J1T1CorpusStats | None = wide.stats

    charts: list[ChartBlock] = []
    build_rejected: list[dict[str, str]] = []

    for opp in plan.opportunities:
        block = build_chart_for_opportunity(opp, stats, index, citations)
        if block is None:
            build_rejected.append(
                {"kind": opp.kind, "role": opp.role, "reason": "builder returned None (gate failed)"}
            )
            continue
        charts.append(block)

    meta: dict[str, Any] = {
        "visual_intent": plan.intent,
        "visual_strength": plan.suppression.strength if plan.suppression else "unknown",
        "visual_suppression": plan.suppression.reasons if plan.suppression else [],
        "lead_lane": index.lead_lane,
        "trust_conflicts": index.conflict_keys,
        "validation_summary": index.validation_summary,
        "visual_opportunities": [
            {
                "kind": o.kind,
                "role": o.role,
                "story": o.story,
                "priority": o.priority,
                "query_affinity": o.query_affinity,
                "discovery_strength": o.discovery_strength,
                "pairing_score": o.pairing_score,
                "pairing_mode": o.pairing_mode,
            }
            for o in plan.opportunities
        ],
        "visual_rejected": plan.rejected + build_rejected,
        "charts_attached": len(charts),
    }

    if not charts:
        meta["visual_suppressed"] = True
        if not meta["visual_rejected"] and plan.suppression and plan.suppression.reasons:
            meta["visual_suppression_reason"] = "; ".join(plan.suppression.reasons)
        return VisualAttachResult(spec=spec, meta=meta)

    updated = spec.model_copy(
        update={
            "charts": charts,
            "chart": charts[0],
        }
    )
    meta["visual_suppressed"] = False
    meta["chart_kinds"] = [c.kind for c in charts]
    return VisualAttachResult(spec=updated, meta=meta)
