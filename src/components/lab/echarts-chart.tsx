"use client";

/**
 * EChartsChart — React wrapper for Apache ECharts (via echarts-for-react).
 *
 * Unlocks chart types Recharts cannot render:
 *   Sankey, Radar, Heatmap, Gauge, Sunburst, Calendar, Tree, Graph
 *
 * Also works for standard types (bar, line, scatter) as a bake-off comparison.
 *
 * The atlas colour palette is injected into each option object so every chart
 * uses design-system tokens: #6366f1 · #10b981 · #f59e0b · #ef4444 · #8b5cf6
 */

import type { EChartsOption } from "echarts";
import { lazy, Suspense } from "react";
import type { EChartsReactProps } from "echarts-for-react";

// Dynamic import to keep the ~900 kB bundle out of the initial chunk
const ReactECharts = lazy(() => import("echarts-for-react"));

// Atlas design-system palette (must match CSS --chart-* vars)
export const ATLAS_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

/** Shared ECharts axis / grid / tooltip defaults for dark UI */
export const ATLAS_ECHART_DEFAULTS: EChartsOption = {
  backgroundColor: "transparent",
  textStyle: { color: "#94a3b8", fontFamily: "Geist, sans-serif" },
  color: ATLAS_COLORS,
  grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
  tooltip: {
    backgroundColor: "rgba(30,41,59,0.95)",
    borderColor: "#4b5563",
    textStyle: { color: "#f8fafc", fontSize: 12 },
    confine: true,
  },
  legend: { textStyle: { color: "#94a3b8", fontSize: 11 } },
};

interface EChartsChartProps {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
}

export function EChartsChart({ option, className, style }: EChartsChartProps) {
  // Merge atlas defaults with caller option — caller wins on conflicts
  const mergedOption: EChartsOption = {
    ...ATLAS_ECHART_DEFAULTS,
    color: ATLAS_COLORS,
    ...option,
    tooltip: { ...ATLAS_ECHART_DEFAULTS.tooltip, ...(option.tooltip as object | undefined) },
    legend: { ...ATLAS_ECHART_DEFAULTS.legend, ...(option.legend as object | undefined) },
  };

  const props: EChartsReactProps = {
    option: mergedOption,
    style: style ?? { height: "220px", width: "100%" },
    className,
    theme: "dark",
    notMerge: true,
    lazyUpdate: false,
    opts: { renderer: "svg" },
  };

  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center text-xs text-muted-foreground animate-pulse"
          style={style ?? { height: "220px", width: "100%" }}
        >
          Loading ECharts…
        </div>
      }
    >
      <ReactECharts {...props} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec builders for ECharts-exclusive chart types
// ─────────────────────────────────────────────────────────────────────────────

/** Sankey — funder → call status flow. Recharts has no equivalent. */
export function buildSankeyOption(
  data: Array<{ funder: string; status: string; count: number }>,
): EChartsOption {
  const funders = [...new Set(data.map((d) => d.funder))];
  const statuses = [...new Set(data.map((d) => d.status))];

  const nodes = [
    ...funders.map((f) => ({ name: f })),
    ...statuses.map((s) => ({
      name: s,
      itemStyle: { color: s === "open" ? "#10b981" : "#4b5563" },
    })),
  ];
  const links = data.map((d) => ({ source: d.funder, target: d.status, value: d.count }));

  return {
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove",
      formatter: (params: unknown) => {
        const p = params as { data: { source?: string; target?: string; name?: string; value: number } };
        if (p.data.source)
          return `${p.data.source} → ${p.data.target}: <b>${p.data.value}</b>`;
        return `${p.data.name}: <b>${p.data.value}</b>`;
      },
    },
    series: [
      {
        type: "sankey",
        data: nodes,
        links,
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
        label: { color: "#f8fafc", fontSize: 11 },
        nodeWidth: 14,
        nodeGap: 10,
        layoutIterations: 32,
        left: "2%",
        right: "8%",
        top: "5%",
        bottom: "5%",
      },
    ],
  };
}

/** Radar — multi-axis coverage scores. Great for Five Case Model or evidence coverage. */
export function buildRadarOption(
  scores: Record<string, number>,
  label = "Coverage",
): EChartsOption {
  const axes = Object.keys(scores);
  return {
    tooltip: {},
    radar: {
      indicator: axes.map((a) => ({ name: a, max: 100 })),
      radius: "62%",
      center: ["50%", "52%"],
      axisName: { color: "#94a3b8", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: "#2d3748" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: axes.map((a) => scores[a]),
            name: label,
            areaStyle: { opacity: 0.18, color: "#6366f1" },
          },
        ],
        lineStyle: { color: "#6366f1", width: 2 },
        symbol: "circle",
        symbolSize: 5,
        itemStyle: { color: "#6366f1" },
      },
    ],
  };
}

/** Heatmap — matrix density. source_type × tier × count. */
export function buildHeatmapOption(
  data: Array<{ source_type: string; tier: string; count: number }>,
): EChartsOption {
  const xs = [...new Set(data.map((d) => d.source_type))];
  const ys = [...new Set(data.map((d) => d.tier))];
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  return {
    grid: { left: "12%", right: "8%", top: "10%", bottom: "18%", containLabel: false },
    xAxis: {
      type: "category",
      data: xs,
      axisLabel: { color: "#94a3b8", fontSize: 10, rotate: -20 },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    yAxis: {
      type: "category",
      data: ys,
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "2%",
      inRange: { color: ["#1e293b", "#6366f1"] },
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    series: [
      {
        type: "heatmap",
        data: data.map((d) => [xs.indexOf(d.source_type), ys.indexOf(d.tier), d.count]),
        label: { show: true, color: "#f8fafc", fontSize: 10 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } },
      },
    ],
  };
}

/** Gauge — single score 0–100. Good for confidence tier, evidence coverage, NPV probability. */
export function buildGaugeOption(value: number, label: string): EChartsOption {
  return {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: "85%",
        pointer: { show: false },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: { borderWidth: 1, borderColor: "#6366f1", color: "#6366f1" },
        },
        axisLine: { lineStyle: { width: 8, color: [[1, "#1e293b"]] } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        data: [
          {
            value,
            name: label,
            title: {
              offsetCenter: ["0%", "32%"],
              color: "#94a3b8",
              fontSize: 11,
            },
            detail: {
              offsetCenter: ["0%", "-5%"],
              valueAnimation: true,
              formatter: "{value}",
              color: "#f8fafc",
              fontSize: 22,
              fontWeight: "bold",
            },
          },
        ],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic builders — field-name-agnostic, used by ChartRenderer for agent specs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic Sankey — agent passes field names for source/target/value.
 * data rows: { [sourceField]: string, [targetField]: string, [valueField]: number }
 */
export function buildGenericSankeyOption(
  data: Array<Record<string, string | number>>,
  sourceField: string,
  targetField: string,
  valueField: string,
): EChartsOption {
  const sourceNames = [...new Set(data.map((d) => String(d[sourceField])))];
  const targetNames = [...new Set(data.map((d) => String(d[targetField])))];
  // Deduplicate node names across source and target sets
  const allNames = [...new Set([...sourceNames, ...targetNames])];
  const nodes = allNames.map((n) => ({ name: n }));
  const links = data.map((d) => ({
    source: String(d[sourceField]),
    target: String(d[targetField]),
    value: Number(d[valueField] ?? 0),
  }));
  return {
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove",
      formatter: (params: unknown) => {
        const p = params as { data: { source?: string; target?: string; name?: string; value: number } };
        if (p.data.source)
          return `${p.data.source} → ${p.data.target}: <b>${p.data.value}</b>`;
        return `${p.data.name}: <b>${p.data.value}</b>`;
      },
    },
    series: [{
      type: "sankey",
      data: nodes,
      links,
      emphasis: { focus: "adjacency" },
      lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
      label: { color: "#f8fafc", fontSize: 11 },
      nodeWidth: 14,
      nodeGap: 10,
      layoutIterations: 32,
      left: "2%",
      right: "10%",
      top: "5%",
      bottom: "5%",
    }],
  };
}

/**
 * Generic Radar — agent passes field names for axis label and score value.
 * data rows: { [axisField]: string, [valueField]: number }
 * max defaults to 100.
 */
export function buildGenericRadarOption(
  data: Array<Record<string, string | number>>,
  axisField: string,
  valueField: string,
  label = "Coverage",
  max = 100,
): EChartsOption {
  const axes = data.map((d) => String(d[axisField]));
  const values = data.map((d) => Number(d[valueField] ?? 0));
  return {
    tooltip: {},
    radar: {
      indicator: axes.map((a) => ({ name: a, max })),
      radius: "62%",
      center: ["50%", "52%"],
      axisName: { color: "#94a3b8", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: "#2d3748" } },
    },
    series: [{
      type: "radar",
      data: [{ value: values, name: label, areaStyle: { opacity: 0.18, color: "#6366f1" } }],
      lineStyle: { color: "#6366f1", width: 2 },
      symbol: "circle",
      symbolSize: 5,
      itemStyle: { color: "#6366f1" },
    }],
  };
}

/**
 * Generic Heatmap — agent passes field names for x-axis, y-axis, and cell value.
 * data rows: { [xField]: string, [yField]: string, [valueField]: number }
 */
export function buildGenericHeatmapOption(
  data: Array<Record<string, string | number>>,
  xField: string,
  yField: string,
  valueField: string,
): EChartsOption {
  const xs = [...new Set(data.map((d) => String(d[xField])))];
  const ys = [...new Set(data.map((d) => String(d[yField])))];
  const maxVal = Math.max(...data.map((d) => Number(d[valueField] ?? 0)), 1);
  return {
    grid: { left: "12%", right: "8%", top: "10%", bottom: "18%", containLabel: false },
    xAxis: {
      type: "category",
      data: xs,
      axisLabel: { color: "#94a3b8", fontSize: 10, rotate: -20 },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    yAxis: {
      type: "category",
      data: ys,
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "2%",
      inRange: { color: ["#1e293b", "#6366f1"] },
      textStyle: { color: "#94a3b8", fontSize: 10 },
    },
    series: [{
      type: "heatmap",
      data: data.map((d) => [xs.indexOf(String(d[xField])), ys.indexOf(String(d[yField])), Number(d[valueField] ?? 0)]),
      label: { show: true, color: "#f8fafc", fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } },
    }],
  };
}

/** Standard bar using ECharts — for bake-off comparison with Recharts + Vega-Lite */
export function buildEChartBarOption(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): EChartsOption {
  return {
    xAxis: {
      type: "category",
      data: data.map((d) => String(d[xKey])),
      axisLabel: { color: "#94a3b8", fontSize: 10, rotate: -20 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLine: { show: false },
    },
    tooltip: { trigger: "axis" },
    series: [
      {
        type: "bar",
        data: data.map((d) => Number(d[yKey])),
        barMaxWidth: 40,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: "#6366f1" },
      },
    ],
  };
}

/** Standard area using ECharts — for bake-off comparison */
export function buildEChartAreaOption(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): EChartsOption {
  return {
    xAxis: {
      type: "category",
      data: data.map((d) => String(d[xKey])),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLine: { show: false },
    },
    tooltip: { trigger: "axis" },
    series: [
      {
        type: "line",
        data: data.map((d) => Number(d[yKey])),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#6366f1", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(99,102,241,0.4)" },
              { offset: 1, color: "rgba(99,102,241,0.02)" },
            ],
          },
        },
      },
    ],
  };
}

/** Stacked bar using ECharts — for bake-off comparison */
export function buildEChartStackedOption(
  data: Array<{ funder: string; status: string; count: number }>,
): EChartsOption {
  const funders = [...new Set(data.map((d) => d.funder))];
  const statuses = [...new Set(data.map((d) => d.status))];
  const colors: Record<string, string> = { open: "#10b981", closed: "#6366f1", unknown: "#4b5563" };

  return {
    xAxis: {
      type: "category",
      data: funders,
      axisLabel: { color: "#94a3b8", fontSize: 10, rotate: -15 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLine: { show: false },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: statuses, textStyle: { color: "#94a3b8", fontSize: 10 }, bottom: 0 },
    series: statuses.map((s) => ({
      name: s,
      type: "bar" as const,
      stack: "total",
      data: funders.map((f) => data.find((d) => d.funder === f && d.status === s)?.count ?? 0),
      itemStyle: {
        color: colors[s] ?? ATLAS_COLORS[statuses.indexOf(s) % ATLAS_COLORS.length],
        borderRadius: statuses.indexOf(s) === statuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0],
      },
    })),
  };
}

/** Donut / Pie using ECharts — for bake-off comparison */
export function buildEChartPieOption(
  data: Array<Record<string, string | number>>,
  nameKey: string,
  valueKey: string,
): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: "2%", textStyle: { color: "#94a3b8", fontSize: 10 } },
    series: [
      {
        type: "pie",
        radius: ["30%", "65%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold", color: "#f8fafc" } },
        data: data.map((d, i) => ({
          name: String(d[nameKey]),
          value: Number(d[valueKey]),
          itemStyle: { color: ATLAS_COLORS[i % ATLAS_COLORS.length] },
        })),
      },
    ],
  };
}

/** Scatter using ECharts — for bake-off comparison */
export function buildEChartScatterOption(
  data: Array<Record<string, string | number>>,
  xKey: string,
  yKey: string,
): EChartsOption {
  return {
    xAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLine: { lineStyle: { color: "#4b5563" } },
    },
    tooltip: { trigger: "item", formatter: (p: unknown) => {
      const params = p as { value: [number, number] };
      return `x: ${params.value[0]}, y: ${params.value[1]}`;
    }},
    series: [
      {
        type: "scatter",
        data: data.map((d) => [Number(d[xKey]), Number(d[yKey])]),
        symbolSize: 7,
        itemStyle: { color: "#6366f1", opacity: 0.75 },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Force-directed Knowledge Graph
// The use case: agent queries FalkorDB/Graphiti → returns subgraph → renders here
// ─────────────────────────────────────────────────────────────────────────────

export type GraphNodeCategory = "theme" | "project" | "funder" | "document" | "concept";

export interface GraphNode {
  id: string;
  name: string;
  category: GraphNodeCategory;
  /** Controls visual size — use similarity score or connection count */
  value?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** Edge label shown on hover */
  label?: string;
}

const GRAPH_CATEGORY_COLORS: Record<GraphNodeCategory, string> = {
  theme:    "#6366f1",  // indigo
  project:  "#10b981",  // emerald
  funder:   "#f59e0b",  // amber
  document: "#06b6d4",  // cyan
  concept:  "#8b5cf6",  // violet
};

const GRAPH_CATEGORY_SIZE: Record<GraphNodeCategory, number> = {
  theme:    28,
  project:  18,
  funder:   24,
  document: 14,
  concept:  16,
};

/**
 * buildEChartGraphOption — force-directed knowledge graph.
 *
 * Data shape mirrors what Graphiti MCP returns:
 *   nodes: Array<{ id, name, category, value? }>
 *   edges: Array<{ source, target, label? }>
 *
 * Atlas agent would emit chart_spec: { type: "graph", nodes: [...], links: [...] }
 * and the artifact panel renders this.
 */
export function buildEChartGraphOption(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts?: {
    title?: string;
    repulsion?: number;
    gravity?: number;
    labelMinSize?: number;
    hideLabelsUntilHover?: boolean;
  },
): EChartsOption {
  const categories = (["theme", "project", "funder", "document", "concept"] as GraphNodeCategory[]).map(
    (cat) => ({ name: cat, itemStyle: { color: GRAPH_CATEGORY_COLORS[cat] } }),
  );
  const hideLabels = opts?.hideLabelsUntilHover ?? nodes.length > 8;
  const fontSize = opts?.labelMinSize ?? 10;

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const params = p as { dataType: string; data: { name: string; category?: string; label?: string; source?: string; target?: string } };
        if (params.dataType === "edge") {
          return `${params.data.source} → ${params.data.target}${params.data.label ? `<br/><i>${params.data.label}</i>` : ""}`;
        }
        return `<b>${params.data.name}</b>${params.data.category ? `<br/>${params.data.category}` : ""}`;
      },
    },
    legend: {
      data: categories.map((c) => c.name),
      textStyle: { color: "#94a3b8", fontSize: 10 },
      bottom: 4,
      icon: "circle",
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,  // pan + zoom
        draggable: true,
        data: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          category: categories.findIndex((c) => c.name === n.category),
          symbolSize: (n.value ?? 1) * 4 + GRAPH_CATEGORY_SIZE[n.category],
          label: {
            show: !hideLabels,
            color: "#f8fafc",
            fontSize,
            formatter: (p: unknown) => {
              const name = (p as { data: { name: string } }).data.name;
              return name.length > 22 ? `${name.slice(0, 20)}…` : name;
            },
          },
          itemStyle: { color: GRAPH_CATEGORY_COLORS[n.category], opacity: 0.9 },
        })),
        links: edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: e.label ? { show: false, formatter: e.label, color: "#94a3b8", fontSize: 9 } : undefined,
          lineStyle: { color: "#4b5563", width: 1, opacity: 0.5, curveness: 0.15 },
        })),
        categories,
        force: {
          repulsion: opts?.repulsion ?? 160,
          gravity: opts?.gravity ?? 0.06,
          edgeLength: [80, 180],
          friction: 0.35,
          layoutAnimation: true,
        },
        emphasis: {
          focus: "adjacency",
          label: { show: true, fontSize: fontSize + 1, fontWeight: "bold" },
          lineStyle: { width: 2, opacity: 1, color: "#94a3b8" },
        },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 6],
      },
    ],
  };
}
