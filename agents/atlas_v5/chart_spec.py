"""ChartSpec builder — guardrailed ECharts options from corpus stats."""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.chart_router import select_chart_kind
from agents.atlas_v5.j1t1_assembler import format_gbp_compact
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.visual_intent import is_funder_bar_query
from agents.contracts.answer_spec import AnswerSpec, ChartBlock
from agents.registry.viz_guardrail import sanitise_chart_spec, validate_chart_spec

_ATLAS_BAR_COLORS = ["#3F7A52", "#3E6B8C", "#B07A2E", "#94908A", "#6B6560"]


def build_funder_bar_chart(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    *,
    query: str = "",
) -> ChartBlock | None:
    if not stats.funders:
        return None
    if query and not is_funder_bar_query(query):
        if select_chart_kind(query) != "bar":
            return None

    rows = sorted(stats.funders, key=lambda r: r.funding_sum, reverse=True)[:6]
    names = [r.lead_funder for r in rows]
    values = [round(r.funding_sum) for r in rows]

    option: dict[str, Any] = {
        "title": {
            "text": "Funding by lead funder · corpus floor",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 8, "right": 16, "top": 36, "bottom": 8, "containLabel": True},
        "xAxis": {
            "type": "value",
            "name": "GBP (floor)",
            "axisLabel": {
                "formatter": "{value}",
                "color": "#94908A",
                "fontSize": 10,
            },
        },
        "yAxis": {
            "type": "category",
            "data": names,
            "axisLabel": {"color": "#56524C", "fontSize": 11},
        },
        "series": [
            {
                "type": "bar",
                "data": [
                    {
                        "value": v,
                        "itemStyle": {
                            "color": _ATLAS_BAR_COLORS[idx % len(_ATLAS_BAR_COLORS)],
                            "borderRadius": [0, 3, 3, 0],
                        },
                    }
                    for idx, v in enumerate(values)
                ],
                "label": {
                    "show": True,
                    "position": "right",
                    "formatter": "{c}",
                    "fontSize": 10,
                    "color": "#56524C",
                },
            }
        ],
        "tooltip": {
            "trigger": "axis",
            "formatter": "{b}: £{c} (corpus floor)",
        },
    }

    ok, issues = validate_chart_spec(option)
    if not ok:
        return None
    option = sanitise_chart_spec(option)

    data_keys = ["stats.funding_floor_gbp"]
    if index.get("stats.project_count"):
        data_keys.append("stats.project_count")

    return ChartBlock(
        engine="echarts",
        kind="bar",
        title="Funding by lead funder",
        option=option,
        data_keys=data_keys,
        gate_status="pass",
        gate_errors=issues,
    )


def attach_chart_if_applicable(
    spec: AnswerSpec,
    stats: J1T1CorpusStats | None,
    index: KeyedFigureIndex,
    query: str,
) -> AnswerSpec:
    if stats is None or spec.chart is not None:
        return spec
    chart = build_funder_bar_chart(stats, index, query=query)
    if chart is None:
        return spec
    return spec.model_copy(update={"chart": chart})
