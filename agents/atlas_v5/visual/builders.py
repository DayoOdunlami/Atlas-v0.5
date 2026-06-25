"""ECharts builders — keyed figures only."""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.visual.opportunity import VisualOpportunity
from agents.contracts.answer_spec import ChartBlock, ChartInteractionSpec
from agents.registry.viz_guardrail import sanitise_chart_spec, validate_chart_spec

_ATLAS_BAR_COLORS = ["#3F7A52", "#3E6B8C", "#B07A2E", "#94908A", "#6B6560"]
_SOURCE_LABELS = {
    "project": "Corpus projects",
    "live_call": "Live calls",
    "cpc_internal": "CPC internal",
    "cpc_claim": "CPC claims",
    "document": "Documents",
}


def _tier_ceiling_label(index: KeyedFigureIndex | None) -> str | None:
    if not index:
        return None
    tiers = [f.confidence_tier for f in index.figures.values() if f.confidence_tier]
    if not tiers:
        return None
    order = ["Speculative", "Indicative", "Supported", "Robust"]
    worst = min(tiers, key=lambda t: order.index(t) if t in order else 0)
    if worst in ("Speculative", "Indicative"):
        return f"{worst} ceiling"
    return None


def _finalize(
    opp: VisualOpportunity,
    option: dict[str, Any],
    data_keys: list[str],
    *,
    title: str,
    interaction: ChartInteractionSpec | None = None,
    index: KeyedFigureIndex | None = None,
    series_lanes: list[str] | None = None,
    validation_statuses: list[str] | None = None,
    reconciliation_note: str | None = None,
) -> ChartBlock | None:
    ok, issues = validate_chart_spec(option)
    if not ok:
        return None
    option = sanitise_chart_spec(option)
    tier_note = _tier_ceiling_label(index)
    final_title = title
    if tier_note:
        final_title = f"{title} · {tier_note}"
    return ChartBlock(
        engine="echarts",
        kind=opp.kind,
        title=final_title,
        role=opp.role,
        story=opp.story,
        option=option,
        data_keys=data_keys,
        series_lanes=series_lanes or [],
        validation_statuses=validation_statuses or [],
        lead_lane=index.lead_lane if index else None,
        reconciliation_note=reconciliation_note,
        interaction_spec=interaction,
        gate_status="pass",
        gate_errors=issues,
    )


def build_funder_ranking_bar(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    if not stats.funders:
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
            "axisLabel": {"color": "#94908A", "fontSize": 10},
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
                    "fontSize": 10,
                    "color": "#56524C",
                },
            }
        ],
        "tooltip": {"trigger": "axis", "formatter": "{b}: £{c} (corpus floor)"},
    }
    data_keys = ["stats.funding_floor_gbp"]
    if index.get("stats.project_count"):
        data_keys.append("stats.project_count")
    interaction = ChartInteractionSpec(
        type="floor_adjust",
        key="stats.funding_floor_gbp",
        label="Adjust corpus floor scale",
        min=0.8,
        max=1.2,
        default=1.0,
    )
    return _finalize(
        opp,
        option,
        data_keys,
        title="Funding by lead funder",
        interaction=interaction,
    )


def build_null_funding_bar(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    if not stats.funders:
        return None
    rows = sorted(stats.funders, key=lambda r: r.null_funding_count, reverse=True)[:6]
    if sum(r.null_funding_count for r in rows) == 0:
        return None
    names = [r.lead_funder for r in rows]
    values = [r.null_funding_count for r in rows]
    option: dict[str, Any] = {
        "title": {
            "text": "Null funding rows by lead funder",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 8, "right": 16, "top": 36, "bottom": 8, "containLabel": True},
        "xAxis": {
            "type": "value",
            "name": "Null rows",
            "axisLabel": {"color": "#94908A", "fontSize": 10},
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
                            "color": "#B07A2E",
                            "borderRadius": [0, 3, 3, 0],
                        },
                    }
                    for v in values
                ],
            }
        ],
        "tooltip": {"trigger": "axis"},
    }
    data_keys = ["stats.null_funding_count"]
    if index.get("stats.project_count"):
        data_keys.append("stats.project_count")
    return _finalize(opp, option, data_keys, title="Null funding by funder")


def build_funder_composition_pie(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    rows = [r for r in stats.funders if r.funding_sum > 0]
    if len(rows) < 2:
        return None
    rows = sorted(rows, key=lambda r: r.funding_sum, reverse=True)[:5]
    option: dict[str, Any] = {
        "title": {
            "text": "Corpus floor share by funder",
            "left": "center",
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "tooltip": {"trigger": "item", "formatter": "{b}: £{c} ({d}%)"},
        "series": [
            {
                "type": "pie",
                "radius": ["38%", "62%"],
                "data": [
                    {
                        "name": r.lead_funder,
                        "value": round(r.funding_sum),
                        "itemStyle": {
                            "color": _ATLAS_BAR_COLORS[idx % len(_ATLAS_BAR_COLORS)],
                        },
                    }
                    for idx, r in enumerate(rows)
                ],
                "label": {"fontSize": 10, "color": "#56524C"},
            }
        ],
    }
    return _finalize(
        opp,
        option,
        ["stats.funding_floor_gbp"],
        title="Funder composition (floor)",
    )


def build_evidence_heatmap(
    citations: list[dict[str, Any]],
    opp: VisualOpportunity,
) -> ChartBlock | None:
    if len(citations) < 4:
        return None
    sorted_c = sorted(citations, key=lambda c: float(c.get("score") or 0.0), reverse=True)
    n = len(sorted_c)
    tier_buckets: dict[tuple[str, str], int] = {}
    for i, c in enumerate(sorted_c):
        src = _SOURCE_LABELS.get(str(c.get("source_type", "project")), "Other")
        if i < n // 3:
            tier = "Supported"
        elif i < 2 * n // 3:
            tier = "Indicative"
        else:
            tier = "Speculative"
        tier_buckets[(src, tier)] = tier_buckets.get((src, tier), 0) + 1
    if len(tier_buckets) < 3:
        return None

    x_labels = sorted({k[0] for k in tier_buckets})
    y_labels = ["Supported", "Indicative", "Speculative"]
    data: list[list[int]] = []
    for yi, y in enumerate(y_labels):
        for xi, x in enumerate(x_labels):
            data.append([xi, yi, tier_buckets.get((x, y), 0)])

    option: dict[str, Any] = {
        "title": {
            "text": "Evidence coverage matrix",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 80, "right": 16, "top": 36, "bottom": 40},
        "xAxis": {
            "type": "category",
            "data": x_labels,
            "splitArea": {"show": True},
            "axisLabel": {"fontSize": 10, "color": "#56524C", "rotate": 20},
        },
        "yAxis": {
            "type": "category",
            "data": y_labels,
            "splitArea": {"show": True},
            "axisLabel": {"fontSize": 10, "color": "#56524C"},
        },
        "visualMap": {
            "min": 0,
            "max": max(v[2] for v in data) or 1,
            "calculable": False,
            "orient": "horizontal",
            "left": "center",
            "bottom": 0,
            "inRange": {"color": ["#F8F6F1", "#3F7A52"]},
            "show": False,
        },
        "series": [
            {
                "type": "heatmap",
                "data": data,
                "label": {"show": True, "fontSize": 10},
            }
        ],
        "tooltip": {"position": "top"},
    }
    return _finalize(
        opp,
        option,
        ["corpus.citation_count"],
        title="Evidence coverage matrix",
    )


def build_flow_sankey(
    citations: list[dict[str, Any]],
    opp: VisualOpportunity,
) -> ChartBlock | None:
    flow: dict[tuple[str, str], int] = {}
    for c in citations:
        st = c.get("source_type") or "project"
        if st == "live_call":
            funder = str(c.get("funder") or "").strip()[:30]
            if funder:
                key = (funder, "Live funding calls")
                flow[key] = flow.get(key, 0) + 1
        elif st == "project":
            org = str(c.get("organisation") or c.get("lead_org_name") or "").strip()[:30]
            if org:
                key = (org, "Corpus projects")
                flow[key] = flow.get(key, 0) + 1
        elif st in ("cpc_internal", "cpc_claim"):
            bu = str(c.get("business_unit") or c.get("organisation") or "CPC internal").strip()[:30]
            key = (bu, "CPC capability evidence")
            flow[key] = flow.get(key, 0) + 1

    if len(flow) < 3:
        return None

    nodes: list[dict[str, str]] = []
    node_set: set[str] = set()
    links: list[dict[str, Any]] = []
    for (src, tgt), val in sorted(flow.items(), key=lambda x: -x[1]):
        for name in (src, tgt):
            if name not in node_set:
                node_set.add(name)
                nodes.append({"name": name})
        links.append({"source": src, "target": tgt, "value": val})

    option: dict[str, Any] = {
        "title": {
            "text": "Evidence flow",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "series": [
            {
                "type": "sankey",
                "layout": "none",
                "emphasis": {"focus": "adjacency"},
                "data": nodes,
                "links": links,
                "lineStyle": {"color": "gradient", "curveness": 0.5},
                "label": {"fontSize": 10, "color": "#56524C"},
            }
        ],
        "tooltip": {"trigger": "item"},
    }
    return _finalize(
        opp,
        option,
        ["corpus.citation_count"],
        title="Evidence flow",
    )


def build_dual_scale_bar(
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    floor = index.get("stats.funding_floor_gbp")
    programme = index.get("web.programme_total_gbp") or index.get("web.programme_upper_gbp")
    if not floor or not programme:
        return None
    if not isinstance(floor.value, (int, float)) or not isinstance(programme.value, (int, float)):
        return None

    categories = ["Corpus slice (floor)", "Web programme scale"]
    values = [round(float(floor.value)), round(float(programme.value))]
    note = None
    if index.conflict_keys:
        note = "Contested scale — corpus floor and web programme measure different scopes"

    option: dict[str, Any] = {
        "title": {
            "text": "Peer lanes — corpus floor vs web programme",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 8, "right": 16, "top": 36, "bottom": 8, "containLabel": True},
        "xAxis": {
            "type": "value",
            "name": "GBP",
            "axisLabel": {"color": "#94908A", "fontSize": 10},
        },
        "yAxis": {
            "type": "category",
            "data": categories,
            "axisLabel": {"color": "#56524C", "fontSize": 11},
        },
        "series": [
            {
                "type": "bar",
                "data": [
                    {
                        "value": values[0],
                        "itemStyle": {"color": _ATLAS_BAR_COLORS[0], "borderRadius": [0, 3, 3, 0]},
                    },
                    {
                        "value": values[1],
                        "itemStyle": {"color": _ATLAS_BAR_COLORS[1], "borderRadius": [0, 3, 3, 0]},
                    },
                ],
                "label": {
                    "show": True,
                    "position": "right",
                    "fontSize": 10,
                    "color": "#56524C",
                },
            }
        ],
        "tooltip": {
            "trigger": "axis",
            "formatter": "{b}: £{c}",
        },
    }
    data_keys = [floor.key, programme.key]
    return _finalize(
        opp,
        option,
        data_keys,
        title="Corpus floor vs web programme",
        index=index,
        series_lanes=["corpus", "web"],
        validation_statuses=[floor.validation_status, programme.validation_status],
        reconciliation_note=note,
    )


def build_web_programme_bar(
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    programme = index.get("web.programme_total_gbp") or index.get("web.programme_upper_gbp")
    if not programme or not isinstance(programme.value, (int, float)):
        return None
    if programme.validation_status in ("absent", "declined"):
        return None

    val = round(float(programme.value))
    option: dict[str, Any] = {
        "title": {
            "text": "Web-validated programme scale",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 8, "right": 16, "top": 36, "bottom": 8, "containLabel": True},
        "xAxis": {
            "type": "value",
            "name": "GBP",
            "axisLabel": {"color": "#94908A", "fontSize": 10},
        },
        "yAxis": {
            "type": "category",
            "data": ["Programme scale (web lane)"],
            "axisLabel": {"color": "#56524C", "fontSize": 11},
        },
        "series": [
            {
                "type": "bar",
                "data": [
                    {
                        "value": val,
                        "itemStyle": {"color": _ATLAS_BAR_COLORS[1], "borderRadius": [0, 3, 3, 0]},
                    }
                ],
                "label": {"show": True, "position": "right", "fontSize": 10},
            }
        ],
        "tooltip": {"trigger": "axis"},
    }
    return _finalize(
        opp,
        option,
        [programme.key],
        title=f"Programme scale · {programme.validation_status}",
        index=index,
        series_lanes=["web"],
        validation_statuses=[programme.validation_status],
        reconciliation_note=programme.provenance[:120],
    )


def build_start_year_line(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    if len(stats.start_years) < 3:
        return None
    years = [str(r.year) for r in stats.start_years]
    counts = [r.project_count for r in stats.start_years]
    option: dict[str, Any] = {
        "title": {
            "text": "Project starts by year · corpus slice",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "grid": {"left": 8, "right": 16, "top": 36, "bottom": 24, "containLabel": True},
        "xAxis": {
            "type": "category",
            "data": years,
            "name": "Start year",
            "axisLabel": {"color": "#56524C", "fontSize": 10},
        },
        "yAxis": {
            "type": "value",
            "name": "Projects",
            "min": 0,
            "axisLabel": {"color": "#94908A", "fontSize": 10},
        },
        "series": [
            {
                "type": "line",
                "data": counts,
                "smooth": True,
                "itemStyle": {"color": _ATLAS_BAR_COLORS[0]},
                "areaStyle": {"opacity": 0.08, "color": _ATLAS_BAR_COLORS[0]},
            }
        ],
        "tooltip": {"trigger": "axis"},
    }
    data_keys = ["stats.project_count"]
    if index.get("stats.live_since_2024"):
        data_keys.append("stats.live_since_2024")
    return _finalize(
        opp,
        option,
        data_keys,
        title="Corpus trajectory by start year",
        index=index,
        series_lanes=["corpus"],
        validation_statuses=["verified"],
    )


def build_mode_theme_stacked_bar(
    stats: J1T1CorpusStats,
    index: KeyedFigureIndex,
    opp: VisualOpportunity,
) -> ChartBlock | None:
    if len(stats.mode_themes) < 3:
        return None
    theme_totals: dict[str, int] = {}
    mode_set: set[str] = set()
    for row in stats.mode_themes:
        theme_totals[row.theme] = theme_totals.get(row.theme, 0) + row.project_count
        mode_set.add(row.mode)
    themes = sorted(theme_totals.keys(), key=lambda t: -theme_totals[t])[:5]
    modes = sorted(mode_set)[:4]
    if len(themes) < 2 or len(modes) < 2:
        return None

    lookup = {(r.mode, r.theme): r.project_count for r in stats.mode_themes}
    series = []
    for idx, mode in enumerate(modes):
        series.append(
            {
                "name": mode,
                "type": "bar",
                "stack": "mix",
                "emphasis": {"focus": "series"},
                "data": [lookup.get((mode, theme), 0) for theme in themes],
                "itemStyle": {"color": _ATLAS_BAR_COLORS[idx % len(_ATLAS_BAR_COLORS)]},
            }
        )

    option: dict[str, Any] = {
        "title": {
            "text": "Mode × theme project mix",
            "left": 0,
            "textStyle": {"fontSize": 12, "fontWeight": 500, "color": "#56524C"},
        },
        "legend": {"top": 28, "textStyle": {"fontSize": 10, "color": "#56524C"}},
        "grid": {"left": 8, "right": 16, "top": 56, "bottom": 24, "containLabel": True},
        "xAxis": {
            "type": "category",
            "data": themes,
            "name": "Theme",
            "axisLabel": {"color": "#56524C", "fontSize": 10, "rotate": 15},
        },
        "yAxis": {
            "type": "value",
            "name": "Projects",
            "min": 0,
            "axisLabel": {"color": "#94908A", "fontSize": 10},
        },
        "series": series,
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
    }
    return _finalize(
        opp,
        option,
        ["stats.project_count"],
        title="Mode × theme mix",
        index=index,
        series_lanes=["corpus"],
        validation_statuses=["verified"],
    )


def build_chart_for_opportunity(
    opp: VisualOpportunity,
    stats: J1T1CorpusStats | None,
    index: KeyedFigureIndex,
    citations: list[dict[str, Any]],
) -> ChartBlock | None:
    if opp.kind == "bar" and opp.role == "compare":
        return build_dual_scale_bar(index, opp)
    if opp.kind == "bar" and opp.role == "evolution":
        return build_web_programme_bar(index, opp)
    if opp.kind == "line" and opp.role == "temporal":
        if not stats:
            return None
        return build_start_year_line(stats, index, opp)
    if opp.kind == "bar" and opp.role == "theme_stack":
        if not stats:
            return None
        return build_mode_theme_stacked_bar(stats, index, opp)
    if opp.kind == "bar" and opp.role == "ranking":
        if not stats:
            return None
        return build_funder_ranking_bar(stats, index, opp)
    if opp.kind == "bar" and opp.role == "distribution":
        if not stats:
            return None
        return build_null_funding_bar(stats, index, opp)
    if opp.kind == "pie":
        if not stats:
            return None
        return build_funder_composition_pie(stats, index, opp)
    if opp.kind == "heatmap":
        return build_evidence_heatmap(citations, opp)
    if opp.kind == "sankey":
        return build_flow_sankey(citations, opp)
    return None
