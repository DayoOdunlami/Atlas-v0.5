"""ChartSpec builder — guardrailed ECharts options from corpus stats (legacy entry)."""

from __future__ import annotations

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.visual.attach import VisualAttachResult, attach_visuals
from agents.atlas_v5.visual.builders import build_funder_ranking_bar
from agents.atlas_v5.visual.opportunity import VisualOpportunity
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec, ChartBlock


def build_funder_bar_chart(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    *,
    query: str = "",
) -> ChartBlock | None:
    """Backward-compatible single bar builder (no query gate)."""
    del query
    opp = VisualOpportunity(
        kind="bar",
        role="ranking",
        story="Lead-funder skew in corpus slice — floor funding only",
        priority=10,
    )
    return build_funder_ranking_bar(stats, index, opp)


def attach_chart_if_applicable(
    spec: AnswerSpec,
    stats: J1T1CorpusStats | None,
    index: KeyedFigureIndex,
    query: str,
) -> AnswerSpec:
    wide = WidePassResult(
        outcome=str(spec.mode).lower().replace("findpath", "find_path"),
        query=query,
        stats=stats,
        corpus_hits=[],
        retrieval_meta={"lane_mode": index.lane_mode},
    )
    return attach_visuals(spec, wide, index, query).spec


def attach_charts_with_meta(
    spec: AnswerSpec,
    wide: WidePassResult,
    index: KeyedFigureIndex,
    query: str,
) -> VisualAttachResult:
    return attach_visuals(spec, wide, index, query)
