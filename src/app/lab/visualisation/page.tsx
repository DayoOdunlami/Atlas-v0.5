"use client";

/**
 * /lab/visualisation — Atlas Visualisation Prototype Lab
 *
 * Tabs:
 *   Corpus Tests    — fixture vs live atlas DB per-card
 *   Framework Bake-off — Recharts | Vega-Lite | ECharts side-by-side
 *                        + ECharts-exclusive chart types (Sankey, Radar, Heatmap, Gauge)
 *                        + Network graph (@xyflow/react vs AntV G6 / Neo4j NVL)
 *   Chart Vocabulary   — gallery of every renderable type with live examples
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import { VegaLiteChart } from "@/components/lab/vega-lite-chart";
import {
  EChartsChart,
  buildSankeyOption,
  buildRadarOption,
  buildHeatmapOption,
  buildGaugeOption,
  buildEChartAreaOption,
  buildEChartBarOption,
  buildEChartStackedOption,
  buildEChartPieOption,
  buildEChartScatterOption,
  buildEChartGraphOption,
  type GraphNode,
  type GraphEdge,
} from "@/components/lab/echarts-chart";
import { KnowledgeGraph } from "@/components/lab/knowledge-graph";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_TYPES,
  type ChartType,
  type ChartDataRecord,
  type ChartSpec,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inferChartType(rendererHint: string, data: ChartDataRecord[]): ChartType {
  if (rendererHint.includes("line")) return "line";
  if (rendererHint.includes("scatter")) return "scatter";
  if (rendererHint.includes("stacked")) {
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    if (keys.length >= 3) return "stacked-bar";
  }
  return "bar";
}

function suggestChartType(data: ChartDataRecord[]): ChartType {
  if (data.length === 0) return "bar";
  const keys = Object.keys(data[0]);
  const hasXY = keys.includes("x") && keys.includes("y");
  const hasSeries = keys.length >= 3 && keys.some((k) => k !== "count" && k !== "value");
  const isTimeSeries = keys.some((k) => k === "year" || k === "date" || k === "month");
  const isProportional = data.length <= 6;
  if (hasXY) return "scatter";
  if (hasSeries) return "stacked-bar";
  if (isTimeSeries) return "area";
  if (isProportional) return "pie";
  return "bar";
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test cases
// ─────────────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  title: string;
  description: string;
  corpusCase?: string;
  defaultChartType: ChartType;
  fixtureData: ChartDataRecord[];
  fixtureX: string;
  fixtureY: string;
  fixtureSeries?: string;
  fixtureStory: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: "project_timeline",
    title: "Project Timeline",
    description: "CPC-funded projects by year",
    corpusCase: "project_timeline",
    defaultChartType: "area",
    fixtureX: "year",
    fixtureY: "count",
    fixtureStory: "Fixture: 10 years of mock CPC project activity",
    fixtureData: [
      { year: "2015", count: 4 }, { year: "2016", count: 7 },
      { year: "2017", count: 11 }, { year: "2018", count: 18 },
      { year: "2019", count: 23 }, { year: "2020", count: 15 },
      { year: "2021", count: 29 }, { year: "2022", count: 34 },
      { year: "2023", count: 41 }, { year: "2024", count: 22 },
    ],
  },
  {
    id: "live_calls_landscape",
    title: "Live Calls Landscape",
    description: "Funding calls by funder × status",
    corpusCase: "live_calls_landscape",
    defaultChartType: "stacked-bar",
    fixtureX: "funder",
    fixtureY: "count",
    fixtureSeries: "status",
    fixtureStory: "Fixture: mock funder call volumes by status",
    fixtureData: [
      { funder: "Innovate UK", status: "open", count: 18 },
      { funder: "Innovate UK", status: "closed", count: 24 },
      { funder: "UKRI", status: "open", count: 12 },
      { funder: "UKRI", status: "closed", count: 19 },
      { funder: "OZEV", status: "open", count: 8 },
      { funder: "OZEV", status: "closed", count: 10 },
      { funder: "DfT", status: "open", count: 5 },
      { funder: "DfT", status: "closed", count: 9 },
    ],
  },
  {
    id: "knowledge_authority",
    title: "Knowledge Authority",
    description: "Approved documents by source type",
    corpusCase: "knowledge_authority",
    defaultChartType: "bar",
    fixtureX: "source_type",
    fixtureY: "count",
    fixtureStory: "Fixture: mock approved document breakdown",
    fixtureData: [
      { source_type: "policy", count: 34 },
      { source_type: "research", count: 28 },
      { source_type: "guidance", count: 19 },
      { source_type: "case_study", count: 13 },
      { source_type: "unclassified", count: 5 },
    ],
  },
  {
    id: "semantic_clusters",
    title: "Semantic Clusters",
    description: "Top themes in the knowledge base",
    corpusCase: "semantic_clusters",
    defaultChartType: "radial-bar",
    fixtureX: "label",
    fixtureY: "count",
    fixtureStory: "Fixture: mock theme distribution",
    fixtureData: [
      { label: "EV charging", count: 47 },
      { label: "active travel", count: 39 },
      { label: "freight", count: 31 },
      { label: "autonomous vehicles", count: 24 },
      { label: "MaaS", count: 19 },
      { label: "rail innovation", count: 15 },
    ],
  },
  {
    id: "innovation_map",
    title: "Innovation Map",
    description: "Projects in 2D innovation space",
    corpusCase: "innovation_map",
    defaultChartType: "scatter",
    fixtureX: "x",
    fixtureY: "y",
    fixtureStory: "Fixture: 40 projects positioned by UMAP coordinates",
    fixtureData: Array.from({ length: 40 }, (_, i) => ({
      x: Math.round((Math.sin(i * 0.7) * 45 + 50) * 10) / 10,
      y: Math.round((Math.cos(i * 0.5) * 35 + 50) * 10) / 10,
    })),
  },
  {
    id: "five_case_flow",
    title: "Five Case Model",
    description: "HM Treasury Five Case Model dependency flow",
    defaultChartType: "bar",
    fixtureX: "",
    fixtureY: "",
    fixtureStory: "Fixture: Five Case Model — SVG (React Flow at D7)",
    fixtureData: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Corpus API
// ─────────────────────────────────────────────────────────────────────────────

interface CorpusResponse {
  ok: boolean;
  case: string;
  renderer: string;
  data_source: string;
  story: string;
  data: ChartDataRecord[];
  caveats: string[];
  row_count: number;
  error?: string;
  detail?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Five Case SVG
// ─────────────────────────────────────────────────────────────────────────────

function FiveCaseSvg() {
  const boxes = [
    { x: 20, y: 20, label: "Strategic Case", color: "#6366f1" },
    { x: 180, y: 20, label: "Economic Case", color: "#8b5cf6" },
    { x: 340, y: 20, label: "Commercial Case", color: "#0ea5e9" },
    { x: 180, y: 120, label: "Financial Case", color: "#10b981" },
    { x: 340, y: 120, label: "Management Case", color: "#f59e0b" },
  ];
  return (
    <svg viewBox="0 0 500 200" className="w-full h-[200px]" aria-label="Five Case Model">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      <line x1="110" y1="47" x2="180" y2="47" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="270" y1="47" x2="340" y2="47" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="230" y1="80" x2="230" y2="120" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="390" y1="80" x2="390" y2="120" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      {boxes.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={140} height={56} rx={6}
            fill={b.color} opacity={0.15} stroke={b.color} strokeWidth={1.5} />
          <text x={b.x + 70} y={b.y + 28} textAnchor="middle"
            dominantBaseline="middle" fontSize={11} fill={b.color} fontWeight="600">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart type pill selector
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ChartType, string> = {
  bar: "Bar", line: "Line", area: "Area", pie: "Pie",
  scatter: "Scatter", "radial-bar": "Radial", "stacked-bar": "Stacked",
};

function ChartTypePicker({
  value, onChange, recommended,
}: {
  value: ChartType;
  onChange: (t: ChartType) => void;
  recommended: ChartType;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {CHART_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={[
            "px-2 py-0.5 rounded text-xs font-mono transition-colors border",
            value === t
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
          ].join(" ")}
          title={t === recommended ? "Recommended for this data shape" : undefined}
        >
          {TYPE_LABELS[t]}{t === recommended && value !== t ? " ★" : ""}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpus Tests tab — LabCard
// ─────────────────────────────────────────────────────────────────────────────

interface CardState {
  mode: "fixture" | "corpus";
  chartType: ChartType;
  loading: boolean;
  corpus: CorpusResponse | null;
  error: string | null;
}

function LabCard({ tc }: { tc: TestCase }) {
  const [state, setState] = useState<CardState>({
    mode: "fixture",
    chartType: tc.defaultChartType,
    loading: false,
    corpus: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const switchMode = useCallback(
    async (next: "fixture" | "corpus") => {
      if (next === "fixture") {
        abortRef.current?.abort();
        setState((s) => ({ ...s, mode: "fixture", loading: false, error: null }));
        return;
      }
      if (!tc.corpusCase) {
        setState((s) => ({ ...s, mode: "corpus", error: "No corpus case for this card." }));
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState((s) => ({ ...s, mode: "corpus", loading: true, error: null }));
      try {
        const res = await fetch(`/api/atlas5/visualisation-data?case=${tc.corpusCase}`, {
          signal: ctrl.signal,
        });
        const json: CorpusResponse = await res.json();
        if (!ctrl.signal.aborted) {
          const suggested = json.ok ? inferChartType(json.renderer, json.data) : state.chartType;
          setState((s) => ({
            ...s, loading: false, corpus: json, chartType: suggested,
            error: json.ok ? null : (json.detail ?? json.error ?? "API error"),
          }));
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setState((s) => ({
            ...s, loading: false,
            error: e instanceof Error ? e.message : "Fetch failed",
          }));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tc.corpusCase],
  );

  const { mode, chartType, loading, corpus, error } = state;
  const activeData: ChartDataRecord[] = mode === "corpus" && corpus?.ok ? corpus.data : tc.fixtureData;
  const recommended = suggestChartType(activeData);

  function buildSpec(): ChartSpec {
    const xKey = mode === "corpus" && corpus?.data.length
      ? Object.keys(corpus.data[0]).find((k) => k !== "count" && k !== "value") ?? tc.fixtureX
      : tc.fixtureX;
    const yKey = mode === "corpus" && corpus?.data.length
      ? (Object.keys(corpus.data[0]).find((k) => k === "count" || k === "value") ?? tc.fixtureY)
      : tc.fixtureY;
    const seriesKey = tc.fixtureSeries ?? "series";
    if (chartType === "stacked-bar") return { type: "stacked-bar", title: tc.title, x: xKey, y: yKey, series: seriesKey };
    return { type: chartType as Exclude<ChartType, "stacked-bar">, title: tc.title, x: xKey, y: yKey };
  }

  function renderChart() {
    if (tc.id === "five_case_flow") return <FiveCaseSvg />;
    if (loading) return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground animate-pulse">Loading from corpus…</div>;
    if (error) return (
      <div className="flex flex-col items-center justify-center h-[220px] gap-2" data-testid={`corpus-error-${tc.id}`}>
        <span className="text-xs text-destructive">{error}</span>
        <span className="text-xs text-muted-foreground">Fixture mode still works ↑</span>
      </div>
    );
    if (mode === "corpus" && !corpus) return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Click Corpus to load live data</div>;
    if (activeData.length === 0) return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No data returned</div>;
    return <ChartRenderer spec={buildSpec()} data={activeData} />;
  }

  const story = mode === "corpus" && corpus?.story ? corpus.story : tc.fixtureStory;

  return (
    <Card data-testid={`card-${tc.id}`} className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">{tc.title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{tc.description}</CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant={mode === "fixture" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-xs" onClick={() => switchMode("fixture")} data-testid={`mode-fixture-${tc.id}`}>Fixture</Button>
            <Button variant={mode === "corpus" ? "secondary" : "ghost"} size="sm" className="h-6 px-2 text-xs" onClick={() => switchMode("corpus")} disabled={!tc.corpusCase} data-testid={`mode-corpus-${tc.id}`}>Corpus</Button>
          </div>
        </div>
        {story && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{story}</p>}
        {mode === "corpus" && corpus?.data_source && <p className="text-xs font-mono text-indigo-500 dark:text-indigo-400">↳ {corpus.data_source} · {corpus.row_count} rows</p>}
        {mode === "corpus" && corpus?.caveats?.length ? (
          <ul className="mt-0.5 space-y-0.5">{corpus.caveats.map((c, i) => <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {c}</li>)}</ul>
        ) : null}
        {tc.id !== "five_case_flow" && (
          <ChartTypePicker value={chartType} onChange={(t) => setState((s) => ({ ...s, chartType: t }))} recommended={recommended} />
        )}
      </CardHeader>
      <CardContent className="pt-0 flex-1" data-testid={`chart-${tc.id}`}>{renderChart()}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vega-Lite spec builder — improved theming to match Recharts visual language
// ─────────────────────────────────────────────────────────────────────────────

// Atlas colour palette as hex — must match CSS --chart-* vars
const VL_PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function buildVegaSpec(tc: TestCase, data: ChartDataRecord[], chartType: ChartType): object {
  const xKey = tc.fixtureX;
  const yKey = tc.fixtureY;
  const seriesKey = tc.fixtureSeries;

  const base = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container" as const,
    height: 210,
    background: "transparent",
    data: { values: data },
    config: {
      view: { stroke: "transparent" },
      font: "Geist, ui-sans-serif, system-ui, sans-serif",
      axis: {
        domainColor: "#4b5563",
        gridColor: "#1e293b",
        gridDash: [3, 3],
        labelColor: "#94a3b8",
        titleColor: "#94a3b8",
        labelFontSize: 11,
        tickColor: "#4b5563",
      },
      legend: {
        labelColor: "#94a3b8",
        titleColor: "#94a3b8",
        labelFontSize: 11,
        symbolSize: 80,
      },
      bar: { cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    },
  };

  // Arc / donut
  if (chartType === "pie" || chartType === "radial-bar") {
    return {
      ...base,
      mark: { type: "arc", innerRadius: 40, outerRadius: 90 },
      encoding: {
        theta: { field: yKey, type: "quantitative" },
        color: {
          field: xKey,
          type: "nominal",
          scale: { range: VL_PALETTE },
          legend: { orient: "bottom", columns: 3 },
        },
        tooltip: [{ field: xKey, type: "nominal" }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  // Scatter
  if (chartType === "scatter") {
    return {
      ...base,
      mark: { type: "point", filled: true, size: 55, opacity: 0.75 },
      encoding: {
        x: { field: xKey, type: "quantitative", axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#6366f1" },
        tooltip: [{ field: xKey, type: "quantitative" }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  // Stacked bar
  if (chartType === "stacked-bar" && seriesKey) {
    return {
      ...base,
      mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
      encoding: {
        x: { field: xKey, type: "nominal", axis: { labelAngle: -25 } },
        y: { field: yKey, type: "quantitative" },
        color: {
          field: seriesKey,
          type: "nominal",
          scale: { range: VL_PALETTE },
          legend: { orient: "bottom" },
        },
        tooltip: [
          { field: xKey, type: "nominal" },
          { field: seriesKey, type: "nominal" },
          { field: yKey, type: "quantitative" },
        ],
      },
    };
  }

  const xIsNumeric = data.length > 0 && typeof data[0][xKey] === "number";
  const xType = xIsNumeric ? "quantitative" : "ordinal";

  // Area
  if (chartType === "area") {
    return {
      ...base,
      mark: { type: "area", interpolate: "monotone", fillOpacity: 0.25, strokeWidth: 2.5, line: { color: "#6366f1", strokeWidth: 2.5 } },
      encoding: {
        x: { field: xKey, type: xType, axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#6366f1" },
        tooltip: [{ field: xKey, type: xType }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  // Line
  if (chartType === "line") {
    return {
      ...base,
      mark: { type: "line", interpolate: "monotone", strokeWidth: 2.5, point: { size: 40, filled: true } },
      encoding: {
        x: { field: xKey, type: xType, axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#6366f1" },
        tooltip: [{ field: xKey, type: xType }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  // Default bar — color each bar independently using Atlas palette
  return {
    ...base,
    mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    encoding: {
      x: { field: xKey, type: "nominal", axis: { labelAngle: -25 } },
      y: { field: yKey, type: "quantitative" },
      color: {
        field: xKey,
        type: "nominal",
        scale: { range: VL_PALETTE },
        legend: null,
      },
      tooltip: [{ field: xKey, type: "nominal" }, { field: yKey, type: "quantitative" }],
    },
  };
}

// VL JSON snippet for "agent would write" panel
const VL_SNIPPETS: Record<string, string> = {
  project_timeline: `{
  "mark": { "type": "area", "interpolate": "monotone" },
  "encoding": {
    "x": { "field": "year", "type": "ordinal" },
    "y": { "field": "count", "type": "quantitative" }
  }
}`,
  live_calls_landscape: `{
  "mark": "bar",
  "encoding": {
    "x": { "field": "funder", "type": "nominal" },
    "y": { "field": "count", "type": "quantitative" },
    "color": { "field": "status", "type": "nominal" }
  }
}`,
  knowledge_authority: `{
  "mark": "bar",
  "encoding": {
    "x": { "field": "source_type", "type": "nominal" },
    "y": { "field": "count", "type": "quantitative" }
  }
}`,
  semantic_clusters: `{
  "mark": { "type": "arc", "innerRadius": 40 },
  "encoding": {
    "theta": { "field": "count", "type": "quantitative" },
    "color": { "field": "label", "type": "nominal" }
  }
}`,
  innovation_map: `{
  "mark": { "type": "point", "filled": true },
  "encoding": {
    "x": { "field": "x", "type": "quantitative" },
    "y": { "field": "y", "type": "quantitative" }
  }
}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Framework metadata
// ─────────────────────────────────────────────────────────────────────────────

const FW = {
  recharts: {
    name: "Recharts",
    bundle: "~180 kB",
    approach: "JSX components",
    color: "text-violet-400",
    border: "border-violet-500/25",
    tag: "bg-violet-500/10 text-violet-400",
    reliability: 3,
    pros: ["Native React", "Smooth CSS animations", "Design token colours", "7 types live"],
    cons: ["LLM writes JSX — higher error rate", "Different API per chart type"],
    note: "Default renderer. Best for dashboard widgets and any chart the agent generates via chart_spec. React animations give it a polish edge over the other two.",
  },
  vegaLite: {
    name: "Vega-Lite",
    bundle: "~620 kB",
    approach: "JSON grammar (declarative)",
    color: "text-sky-400",
    border: "border-sky-500/25",
    tag: "bg-sky-500/10 text-sky-400",
    reliability: 5,
    pros: ["LLM writes JSON — fewest hallucinations", "30+ chart types", "Built-in transforms (aggregate, fold)", "Composable multi-view"],
    cons: ["3× larger bundle", "No CSS animations (static render)", "Less React-idiomatic"],
    note: "Best for agent-generated charts. The grammar is well-represented in LLM training data — an agent can write a valid VL spec reliably. The 3× bundle cost is the main trade-off.",
  },
  echarts: {
    name: "ECharts",
    bundle: "~300 kB (tree-shaken)",
    approach: "JSON option object",
    color: "text-emerald-400",
    border: "border-emerald-500/25",
    tag: "bg-emerald-500/10 text-emerald-400",
    reliability: 4,
    pros: ["Sankey, Radar, Heatmap, Gauge, Sunburst — Recharts can't do these", "Tree-shakeable", "Good LLM reliability (option API)", "Smooth animations"],
    cons: ["Larger than Recharts", "Not JSX-native — needs wrapper", "Sankey needs non-trivial data prep"],
    note: "Install for chart types Recharts can't render. Sankey (funder → project → theme flow) and Radar (Five Case coverage) are the primary Atlas use cases.",
  },
};

function ReliabilityStars({ n }: { n: number }) {
  return (
    <span className="text-xs">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "text-amber-400" : "text-muted-foreground/30"}>★</span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-framework panel (in bake-off)
// ─────────────────────────────────────────────────────────────────────────────

function FrameworkPanel({
  fw,
  children,
  snippet,
  insight,
}: {
  fw: typeof FW.recharts;
  children: React.ReactNode;
  snippet?: string;
  insight?: string;
}) {
  const [showSnippet, setShowSnippet] = useState(false);
  return (
    <Card className={`border ${fw.border} flex flex-col`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className={`text-sm font-semibold ${fw.color}`}>{fw.name}</CardTitle>
            <CardDescription className="text-xs">{fw.approach} · {fw.bundle}</CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">LLM</span>
            <ReliabilityStars n={fw.reliability} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 space-y-3">
        {children}
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{fw.note}</p>
          {insight && <p className={`text-xs italic ${fw.color} opacity-80`}>{insight}</p>}
          <div className="flex flex-wrap gap-1">
            {fw.pros.map((p) => (
              <span key={p} className={`text-xs px-1.5 py-0.5 rounded ${fw.tag}`}>+ {p}</span>
            ))}
            {fw.cons.map((c) => (
              <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">− {c}</span>
            ))}
          </div>
          {snippet && (
            <div>
              <button
                onClick={() => setShowSnippet((v) => !v)}
                className={`text-xs font-mono ${fw.color} hover:opacity-80`}
              >
                {showSnippet ? "▾ hide spec" : "▸ agent would write…"}
              </button>
              {showSnippet && (
                <pre className="mt-1.5 p-2 rounded bg-muted text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
                  {snippet}
                </pre>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bake-off commentary
// ─────────────────────────────────────────────────────────────────────────────

const BAKEOFF_COMMENTARY: Record<string, { why: string; vlInsight: string; ecInsight: string }> = {
  project_timeline: {
    why: "Time-ordered data with a single metric. Area mark emphasises volume and growth shape.",
    vlInsight: "6-line JSON spec. LLMs write year/count → area reliably — the commonest VL pattern.",
    ecInsight: "ECharts gradient fill (dark → indigo) makes the area feel richer. Smooth animation on load. ECharts wins on visual polish here.",
  },
  live_calls_landscape: {
    why: "Three-dimensional data: funder × status × count. Stacked bars show both totals and composition.",
    vlInsight: "Color encoding on status creates stacked bars automatically. No client pivot needed.",
    ecInsight: "ECharts handles the legend and stacking cleanly. Color distinction open/closed is sharper.",
  },
  knowledge_authority: {
    why: "Simple categorical ranking — bar is the most honest, unambiguous encoding.",
    vlInsight: "Shortest VL spec (3 lines of encoding). Every LLM writes this correctly first time.",
    ecInsight: "Minimal difference from Recharts at this chart type. ECharts adds axis animations.",
  },
  semantic_clusters: {
    why: "Part-to-whole with 6 categories — donut shows proportion while the hole prevents area distortion.",
    vlInsight: "Arc mark with theta encoding. VL defaults to a clean donut/pie with legend.",
    ecInsight: "ECharts donut with individual item colours matches Recharts radial-bar more closely.",
  },
  innovation_map: {
    why: "Two independent numeric axes — scatter is the only honest 2D encoding.",
    vlInsight: "Point mark: the simplest 2-field VL spec. LLMs always get this right.",
    ecInsight: "ECharts scatter with hover tooltip. Near-identical output to Recharts at this chart type.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Framework Bake-off tab
// ─────────────────────────────────────────────────────────────────────────────

function BakeoffTab() {
  const caseOptions = TEST_CASES.filter((tc) => tc.id !== "five_case_flow");
  const [selectedId, setSelectedId] = useState(caseOptions[0].id);

  const tc = caseOptions.find((c) => c.id === selectedId) ?? caseOptions[0];
  const data = tc.fixtureData;
  const chartType = tc.defaultChartType;
  const commentary = BAKEOFF_COMMENTARY[tc.id];

  const rechartsSpec: ChartSpec = useMemo(() => {
    if (chartType === "stacked-bar" && tc.fixtureSeries)
      return { type: "stacked-bar", title: tc.title, x: tc.fixtureX, y: tc.fixtureY, series: tc.fixtureSeries };
    return { type: chartType as Exclude<ChartType, "stacked-bar">, title: tc.title, x: tc.fixtureX, y: tc.fixtureY };
  }, [tc, chartType]);

  const vegaSpec = useMemo(() => buildVegaSpec(tc, data, chartType), [tc, chartType, data]);

  const echartsOption = useMemo(() => {
    switch (chartType) {
      case "area":
      case "line":
        return buildEChartAreaOption(data as Array<Record<string, string | number>>, tc.fixtureX, tc.fixtureY);
      case "stacked-bar":
        return buildEChartStackedOption(data as Array<{ funder: string; status: string; count: number }>);
      case "bar":
      case "radial-bar":
        return buildEChartBarOption(data as Array<Record<string, string | number>>, tc.fixtureX, tc.fixtureY);
      case "pie":
        return buildEChartPieOption(data as Array<Record<string, string | number>>, tc.fixtureX, tc.fixtureY);
      case "scatter":
        return buildEChartScatterOption(data as Array<Record<string, string | number>>, tc.fixtureX, tc.fixtureY);
      default:
        return buildEChartBarOption(data as Array<Record<string, string | number>>, tc.fixtureX, tc.fixtureY);
    }
  }, [tc, chartType, data]);

  return (
    <div className="space-y-6">
      {/* Dataset picker */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Choose dataset</p>
        <div className="flex flex-wrap gap-1.5">
          {caseOptions.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={[
                "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                selectedId === c.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
              ].join(" ")}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Why this chart */}
      {commentary && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-foreground mb-1">
              Why <span className="text-violet-400">{TYPE_LABELS[chartType]}</span> for {tc.title}?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{commentary.why}</p>
          </CardContent>
        </Card>
      )}

      {/* 3-panel comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FrameworkPanel fw={FW.recharts} insight={commentary?.ecInsight}>
          <ChartRenderer spec={rechartsSpec} data={data} />
        </FrameworkPanel>

        <FrameworkPanel fw={FW.vegaLite} snippet={VL_SNIPPETS[tc.id]} insight={commentary?.vlInsight}>
          <VegaLiteChart spec={vegaSpec} className="w-full h-[210px]" />
        </FrameworkPanel>

        <FrameworkPanel fw={FW.echarts} insight={commentary?.ecInsight}>
          <EChartsChart option={echartsOption} style={{ height: "210px", width: "100%" }} />
        </FrameworkPanel>
      </div>

      {/* ECharts exclusive chart types */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">ECharts exclusive — chart types Recharts cannot render</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Sankey */}
          <Card className={`border ${FW.echarts.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold ${FW.echarts.color}`}>Sankey</CardTitle>
              <CardDescription className="text-xs">Flow: funder → call status. Recharts has no equivalent.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <EChartsChart
                option={buildSankeyOption(
                  TEST_CASES.find(t => t.id === "live_calls_landscape")!.fixtureData as Array<{ funder: string; status: string; count: number }>
                )}
                style={{ height: "220px", width: "100%" }}
              />
              <p className="text-xs text-muted-foreground mt-2">Atlas use case: funder → project → theme flow. Shows where CPC innovation investment originates and where it lands.</p>
            </CardContent>
          </Card>

          {/* Radar */}
          <Card className={`border ${FW.echarts.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold ${FW.echarts.color}`}>Radar</CardTitle>
              <CardDescription className="text-xs">Multi-axis coverage. Recharts has no equivalent.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <EChartsChart
                option={buildRadarOption({
                  Strategic: 82, Economic: 67, Commercial: 54, Financial: 71, Management: 45,
                }, "Five Case Coverage")}
                style={{ height: "220px", width: "100%" }}
              />
              <p className="text-xs text-muted-foreground mt-2">Atlas use case: Five Case Model completeness at a glance. Which case is weakest? Where is evidence thin?</p>
            </CardContent>
          </Card>

          {/* Heatmap */}
          <Card className={`border ${FW.echarts.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold ${FW.echarts.color}`}>Heatmap</CardTitle>
              <CardDescription className="text-xs">Matrix density. Recharts has no equivalent.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <EChartsChart
                option={buildHeatmapOption([
                  { source_type: "policy", tier: "primary", count: 22 },
                  { source_type: "policy", tier: "secondary", count: 8 },
                  { source_type: "research", tier: "primary", count: 14 },
                  { source_type: "research", tier: "secondary", count: 18 },
                  { source_type: "guidance", tier: "primary", count: 6 },
                  { source_type: "guidance", tier: "secondary", count: 12 },
                  { source_type: "case_study", tier: "primary", count: 4 },
                  { source_type: "case_study", tier: "secondary", count: 7 },
                ])}
                style={{ height: "220px", width: "100%" }}
              />
              <p className="text-xs text-muted-foreground mt-2">Atlas use case: source type × authority tier matrix. Where is the corpus thin? What type of evidence is missing?</p>
            </CardContent>
          </Card>

          {/* Gauge */}
          <Card className={`border ${FW.echarts.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold ${FW.echarts.color}`}>Gauge</CardTitle>
              <CardDescription className="text-xs">Single score 0–100. Recharts has no equivalent.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <EChartsChart
                option={buildGaugeOption(73, "Evidence Coverage")}
                style={{ height: "220px", width: "100%" }}
              />
              <p className="text-xs text-muted-foreground mt-2">Atlas use case: confidence tier as a score. Evidence coverage at 73 = Supported. Below 50 = Indicative. Above 90 = Robust.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Network graph */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Network graph — @xyflow/react (installed)</h2>
          <Badge variant="secondary" className="text-xs">live</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Knowledge Graph Preview</CardTitle>
              <CardDescription className="text-xs">Themes → Projects → Funders using @xyflow/react</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <KnowledgeGraph className="h-[320px] w-full rounded border border-border" />
              <p className="text-xs text-muted-foreground mt-2">Pan, zoom, and click nodes. This is the @xyflow/react DAG renderer — same package wired at D7 for Five Case flows. In production it queries the Graphiti knowledge graph.</p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Graph library options</CardTitle>
              <CardDescription className="text-xs">Three paths — only one is needed for Atlas</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {[
                {
                  name: "@xyflow/react",
                  status: "✅ installed",
                  bundle: "~180 kB",
                  bestFor: "DAGs, Five Case flows, structured pipelines",
                  verdict: "Use this. Manual layout, full React control. Ideal when graph structure is known.",
                  color: "text-violet-400",
                },
                {
                  name: "AntV G6",
                  status: "❌ not installed",
                  bundle: "~400 kB",
                  bestFor: "Force-directed auto-layout, large unknown graphs, clustering",
                  verdict: "Install if corpus has >50 nodes with unknown structure. Overkill until then.",
                  color: "text-muted-foreground",
                },
                {
                  name: "Neo4j NVL",
                  status: "❌ not installed",
                  bundle: "~250 kB",
                  bestFor: "Rendering Neo4j Cypher query results directly",
                  verdict: "Only justified if querying Neo4j directly for vis. FalkorDB/Graphiti → use G6 or @xyflow instead.",
                  color: "text-muted-foreground",
                },
              ].map((opt) => (
                <div key={opt.name} className="border rounded p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-semibold ${opt.color}`}>{opt.name}</span>
                    <span className="text-xs text-muted-foreground">{opt.status} · {opt.bundle}</span>
                  </div>
                  <p className="text-xs text-muted-foreground"><strong className="text-foreground">Best for:</strong> {opt.bestFor}</p>
                  <p className="text-xs text-muted-foreground italic">{opt.verdict}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Vocabulary tab
// ─────────────────────────────────────────────────────────────────────────────

interface VocabItem {
  type: ChartType;
  name: string;
  whenToUse: string;
  dataShape: string;
  vlMark: string;
  spec: ChartSpec;
  data: ChartDataRecord[];
}

const VOCAB_RECHARTS: VocabItem[] = [
  { type: "bar", name: "Bar", whenToUse: "Compare discrete categories. Try this first.", dataShape: "x: categorical · y: quantitative", vlMark: "bar", spec: { type: "bar", title: "Bar", x: "label", y: "value" }, data: [{ label: "Policy", value: 34 }, { label: "Research", value: 28 }, { label: "Guidance", value: 19 }, { label: "Case study", value: 13 }, { label: "Other", value: 5 }] },
  { type: "line", name: "Line", whenToUse: "Trend over ordered data when point values matter.", dataShape: "x: ordinal/temporal · y: quantitative", vlMark: "line", spec: { type: "line", title: "Line", x: "year", y: "count" }, data: [{ year: "2019", count: 15 }, { year: "2020", count: 23 }, { year: "2021", count: 18 }, { year: "2022", count: 31 }, { year: "2023", count: 27 }, { year: "2024", count: 38 }] },
  { type: "area", name: "Area", whenToUse: "Cumulative trend or volume over time.", dataShape: "x: temporal · y: quantitative", vlMark: "area", spec: { type: "area", title: "Area", x: "year", y: "count" }, data: [{ year: "2019", count: 15 }, { year: "2020", count: 23 }, { year: "2021", count: 18 }, { year: "2022", count: 31 }, { year: "2023", count: 27 }, { year: "2024", count: 38 }] },
  { type: "pie", name: "Pie / Donut", whenToUse: "Part-to-whole with ≤6 slices.", dataShape: "category + value · ≤ 6 items", vlMark: "arc", spec: { type: "pie", title: "Pie", x: "label", y: "value" }, data: [{ label: "EV", value: 30 }, { label: "Rail", value: 22 }, { label: "Active travel", value: 18 }, { label: "Freight", value: 15 }, { label: "Other", value: 15 }] },
  { type: "scatter", name: "Scatter", whenToUse: "Two numerics — reveals clusters and outliers.", dataShape: "x: quantitative · y: quantitative", vlMark: "point", spec: { type: "scatter", title: "Scatter", x: "x", y: "y" }, data: Array.from({ length: 25 }, (_, i) => ({ x: Math.round((Math.sin(i * 0.9) * 40 + 50) * 10) / 10, y: Math.round((Math.cos(i * 0.6) * 30 + 50) * 10) / 10 })) },
  { type: "radial-bar", name: "Radial Bar", whenToUse: "Ranked categories as arcs — more visual than bar.", dataShape: "label + value · ≤ 8 items · ranked", vlMark: "arc + radius scale", spec: { type: "radial-bar", title: "Radial Bar", x: "label", y: "value" }, data: [{ label: "EV", value: 47 }, { label: "Travel", value: 39 }, { label: "Freight", value: 31 }, { label: "AV", value: 24 }, { label: "MaaS", value: 19 }, { label: "Rail", value: 15 }] },
  { type: "stacked-bar", name: "Stacked Bar", whenToUse: "Totals AND composition — needs a series field.", dataShape: "x: categorical · y: quant · series: categorical", vlMark: "bar + color encoding", spec: { type: "stacked-bar", title: "Stacked Bar", x: "funder", y: "count", series: "status" }, data: [{ funder: "Innovate UK", status: "open", count: 18 }, { funder: "Innovate UK", status: "closed", count: 24 }, { funder: "UKRI", status: "open", count: 12 }, { funder: "UKRI", status: "closed", count: 19 }, { funder: "OZEV", status: "open", count: 8 }, { funder: "OZEV", status: "closed", count: 10 }] },
];

const VOCAB_ECHARTS_EXCLUSIVE = [
  { name: "Sankey", whenToUse: "Flow from source → destination. Funder → project → theme.", dataShape: "nodes[] + links[] (source/target/value)", option: buildSankeyOption([{ funder: "Innovate UK", status: "open", count: 18 }, { funder: "Innovate UK", status: "closed", count: 24 }, { funder: "UKRI", status: "open", count: 12 }, { funder: "UKRI", status: "closed", count: 19 }, { funder: "OZEV", status: "open", count: 8 }, { funder: "OZEV", status: "closed", count: 10 }]) },
  { name: "Radar", whenToUse: "Multi-axis scores. Five Case completeness, evidence coverage.", dataShape: "axes[] + per-axis values (0–100)", option: buildRadarOption({ Strategic: 82, Economic: 67, Commercial: 54, Financial: 71, Management: 45 }) },
  { name: "Heatmap", whenToUse: "Matrix density — where is coverage thin?", dataShape: "x: categorical · y: categorical · value: quant", option: buildHeatmapOption([{ source_type: "policy", tier: "primary", count: 22 }, { source_type: "policy", tier: "secondary", count: 8 }, { source_type: "research", tier: "primary", count: 14 }, { source_type: "research", tier: "secondary", count: 18 }, { source_type: "guidance", tier: "primary", count: 6 }, { source_type: "guidance", tier: "secondary", count: 12 }]) },
  { name: "Gauge", whenToUse: "Single confidence / coverage / probability score.", dataShape: "value: 0–100 + label string", option: buildGaugeOption(73, "Coverage") },
];

function VocabularyTab() {
  return (
    <div className="space-y-8">
      {/* Recharts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Recharts</h2>
          <Badge variant="secondary" className="text-xs">7 types · ~180 kB · installed</Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {VOCAB_RECHARTS.map((item) => (
            <Card key={item.type} className="flex flex-col">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold">{item.name}</CardTitle>
                <CardDescription className="text-xs">{item.whenToUse}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <ChartRenderer spec={item.spec} data={item.data} />
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-mono text-muted-foreground truncate" title={item.dataShape}>{item.dataShape}</p>
                  <p className="text-xs text-sky-400/70">VL: <span className="font-mono">{item.vlMark}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ECharts exclusive */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">ECharts</h2>
          <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">exclusive chart types · ~300 kB · installed</Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {VOCAB_ECHARTS_EXCLUSIVE.map((item) => (
            <Card key={item.name} className={`flex flex-col border ${FW.echarts.border}`}>
              <CardHeader className="pb-1">
                <CardTitle className={`text-xs font-semibold ${FW.echarts.color}`}>{item.name}</CardTitle>
                <CardDescription className="text-xs">{item.whenToUse}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <EChartsChart option={item.option} style={{ height: "220px", width: "100%" }} />
                <p className="text-xs font-mono text-muted-foreground mt-2 truncate" title={item.dataShape}>{item.dataShape}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* @xyflow network graph */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">@xyflow/react</h2>
          <Badge variant="secondary" className="text-xs">network/DAG · ~180 kB · installed</Badge>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Knowledge Graph: Themes → Projects → Funders</CardTitle>
            <CardDescription className="text-xs">Sample graph · pan · zoom · click — live @xyflow/react</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <KnowledgeGraph className="h-[320px] w-full rounded border border-border" />
            <p className="text-xs text-muted-foreground mt-2">In production: nodes from atlas.projects + graphiti knowledge graph. Edges show cross-sector transfer relationships and funder links.</p>
          </CardContent>
        </Card>
      </section>

      {/* Decision guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Render stack decision — when to use each</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                { name: FW.recharts.name, bundle: FW.recharts.bundle, color: FW.recharts.color, border: FW.recharts.border, when: "Dashboard widgets, artifact panel charts, agent chart_spec output. Default renderer — keep it for all standard charts.", action: "Default — no action needed" },
                { name: FW.vegaLite.name, bundle: FW.vegaLite.bundle, color: FW.vegaLite.color, border: FW.vegaLite.border, when: "Agent needs to generate chart configs from scratch in JSON. More LLM-reliable than writing JSX.", action: "Use for agent-generative charts" },
                { name: FW.echarts.name, bundle: FW.echarts.bundle, color: FW.echarts.color, border: FW.echarts.border, when: "Corpus data needs Sankey (funder flow), Radar (Five Case coverage), Heatmap (evidence matrix), or Gauge.", action: "Wire specific chart types at D7/D8" },
                { name: "@xyflow/react", bundle: "~180 kB", color: "text-violet-400", border: "border-violet-500/25", when: "Five Case flow diagrams, knowledge graph edges, process DAGs. Install complete.", action: "Wire at D7" },
              ] as Array<{ name: string; bundle: string; color: string; border: string; when: string; action: string }>
            ).map((item) => (
              <div key={item.name} className={`border rounded p-3 space-y-1 ${item.border}`}>
                <p className={`font-semibold ${item.color}`}>{item.name} <span className="text-muted-foreground font-normal">({item.bundle})</span></p>
                <p>{item.when}</p>
                <Badge variant="outline" className="text-xs">{item.action}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Graph tab
// Force-directed corpus knowledge graph via ECharts graph series.
// Fixture: CPC corpus subgraph (themes → projects → funders)
// Production path: agent queries Graphiti MCP → returns nodes/edges → renders here
// ─────────────────────────────────────────────────────────────────────────────

// ── Fixture corpus subgraph ──────────────────────────────────────────────────
// Mirrors what a Graphiti MCP response looks like for a semantic search
// "Show me projects related to EV charging and active travel"

const CORPUS_NODES: GraphNode[] = [
  // Themes
  { id: "t-ev",      name: "EV Charging",        category: "theme",   value: 8 },
  { id: "t-travel",  name: "Active Travel",       category: "theme",   value: 6 },
  { id: "t-freight", name: "Freight Decarb.",     category: "theme",   value: 5 },
  { id: "t-av",      name: "Autonomous Vehicles", category: "theme",   value: 4 },
  { id: "t-maas",    name: "MaaS",                category: "theme",   value: 3 },
  // Projects
  { id: "p-1",  name: "EV Corridor Pilot",     category: "project", value: 5 },
  { id: "p-2",  name: "Urban Cycling AI",      category: "project", value: 4 },
  { id: "p-3",  name: "Smart Freight Hub",     category: "project", value: 5 },
  { id: "p-4",  name: "Green Logistics Net",   category: "project", value: 3 },
  { id: "p-5",  name: "EV Grid Integration",   category: "project", value: 4 },
  { id: "p-6",  name: "Cycle-to-Rail Link",    category: "project", value: 3 },
  { id: "p-7",  name: "CAV Safety Trials",     category: "project", value: 4 },
  { id: "p-8",  name: "MaaS Platform North",   category: "project", value: 3 },
  { id: "p-9",  name: "Charging Desert Map",   category: "project", value: 2 },
  { id: "p-10", name: "Electric Bus Corridors",category: "project", value: 3 },
  // Funders
  { id: "f-iuk",  name: "Innovate UK", category: "funder", value: 7 },
  { id: "f-ukri", name: "UKRI",        category: "funder", value: 6 },
  { id: "f-ozev", name: "OZEV",        category: "funder", value: 4 },
  { id: "f-dft",  name: "DfT",         category: "funder", value: 5 },
  // Knowledge docs
  { id: "d-1", name: "Green Book 2022",          category: "document", value: 3 },
  { id: "d-2", name: "EV Infrastructure Strategy", category: "document", value: 3 },
  { id: "d-3", name: "Freight Carbon Review",    category: "document", value: 2 },
];

const CORPUS_EDGES: GraphEdge[] = [
  // Theme → Project
  { source: "t-ev",      target: "p-1",  label: "funded_by" },
  { source: "t-ev",      target: "p-5",  label: "relates_to" },
  { source: "t-ev",      target: "p-9",  label: "relates_to" },
  { source: "t-ev",      target: "p-10", label: "relates_to" },
  { source: "t-travel",  target: "p-2",  label: "relates_to" },
  { source: "t-travel",  target: "p-6",  label: "relates_to" },
  { source: "t-freight", target: "p-3",  label: "relates_to" },
  { source: "t-freight", target: "p-4",  label: "relates_to" },
  { source: "t-av",      target: "p-7",  label: "relates_to" },
  { source: "t-maas",    target: "p-8",  label: "relates_to" },
  { source: "t-maas",    target: "p-6",  label: "relates_to" },
  // Project → Funder
  { source: "p-1",  target: "f-iuk",  label: "funded_by" },
  { source: "p-2",  target: "f-iuk",  label: "funded_by" },
  { source: "p-3",  target: "f-iuk",  label: "funded_by" },
  { source: "p-4",  target: "f-ukri", label: "funded_by" },
  { source: "p-5",  target: "f-ozev", label: "funded_by" },
  { source: "p-6",  target: "f-dft",  label: "funded_by" },
  { source: "p-7",  target: "f-iuk",  label: "funded_by" },
  { source: "p-8",  target: "f-ukri", label: "funded_by" },
  { source: "p-9",  target: "f-ozev", label: "funded_by" },
  { source: "p-10", target: "f-dft",  label: "funded_by" },
  // Theme cross-links (shared concepts)
  { source: "t-ev",      target: "t-av",   label: "shares_tech" },
  { source: "t-travel",  target: "t-maas", label: "complements" },
  // Docs → Themes
  { source: "d-1", target: "t-ev",      label: "informs" },
  { source: "d-1", target: "t-freight", label: "informs" },
  { source: "d-2", target: "t-ev",      label: "primary_source" },
  { source: "d-3", target: "t-freight", label: "primary_source" },
];

// ── Query presets (simulates what an agent would return) ────────────────────

interface QueryPreset {
  id: string;
  question: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  story: string;
}

const QUERY_PRESETS: QueryPreset[] = [
  {
    id: "full",
    question: "Show full corpus subgraph",
    nodes: CORPUS_NODES,
    edges: CORPUS_EDGES,
    story: `${CORPUS_NODES.length} nodes · ${CORPUS_EDGES.length} edges — full fixture corpus`,
  },
  {
    id: "ev-path",
    question: "What funds EV charging?",
    nodes: CORPUS_NODES.filter((n) =>
      ["t-ev", "p-1", "p-5", "p-9", "p-10", "f-iuk", "f-ozev", "f-dft", "d-2"].includes(n.id),
    ),
    edges: CORPUS_EDGES.filter((e) =>
      ["t-ev", "p-1", "p-5", "p-9", "p-10", "f-iuk", "f-ozev", "f-dft", "d-2"].includes(e.source) &&
      ["t-ev", "p-1", "p-5", "p-9", "p-10", "f-iuk", "f-ozev", "f-dft", "d-2"].includes(e.target),
    ),
    story: "Subgraph: EV theme → 4 projects → funders. Innovate UK and OZEV are the primary funding routes.",
  },
  {
    id: "freight-path",
    question: "Freight decarbonisation funding path",
    nodes: CORPUS_NODES.filter((n) =>
      ["t-freight", "p-3", "p-4", "f-iuk", "f-ukri", "d-3", "d-1"].includes(n.id),
    ),
    edges: CORPUS_EDGES.filter((e) =>
      ["t-freight", "p-3", "p-4", "f-iuk", "f-ukri", "d-3", "d-1"].includes(e.source) &&
      ["t-freight", "p-3", "p-4", "f-iuk", "f-ukri", "d-3", "d-1"].includes(e.target),
    ),
    story: "Subgraph: Freight theme → 2 projects → UKRI and Innovate UK. Green Book + Freight Carbon Review as evidence base.",
  },
  {
    id: "funder-iuk",
    question: "What does Innovate UK fund?",
    nodes: CORPUS_NODES.filter((n) => {
      const funded = CORPUS_EDGES.filter((e) => e.target === "f-iuk").map((e) => e.source);
      const themes = CORPUS_EDGES.filter((e) => funded.includes(e.target) && e.source.startsWith("t-")).map((e) => e.source);
      return n.id === "f-iuk" || funded.includes(n.id) || themes.includes(n.id);
    }),
    edges: CORPUS_EDGES.filter((e) => {
      const funded = CORPUS_EDGES.filter((x) => x.target === "f-iuk").map((x) => x.source);
      return e.target === "f-iuk" || (funded.includes(e.target) && e.source.startsWith("t-"));
    }),
    story: "Innovate UK funds 4 projects spanning EV, active travel, freight, and AV themes.",
  },
];

function NetworkGraphTab() {
  const [selectedPreset, setSelectedPreset] = useState(QUERY_PRESETS[0].id);
  const preset = QUERY_PRESETS.find((p) => p.id === selectedPreset) ?? QUERY_PRESETS[0];

  const graphOption = useMemo(
    () => buildEChartGraphOption(preset.nodes, preset.edges, { repulsion: 150, gravity: 0.06 }),
    [preset],
  );

  return (
    <div className="space-y-5">

      {/* Concept explainer */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            The killer use case: ask a question → see the knowledge subgraph
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In artifact mode, the Atlas agent queries FalkorDB via the Graphiti MCP, retrieves
            a relevant subgraph (nodes + edges), and renders it here as an interactive force graph.
            The user can see <em>why</em> the recommendation makes sense — not just the answer,
            but the relational path behind it. Click the query presets below to simulate this.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">✓ ECharts graph — already installed</span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">↳ Graphiti MCP query at D8</span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">↳ chart_spec.type = &quot;graph&quot; in artifact panel</span>
          </div>
        </CardContent>
      </Card>

      {/* Query preset picker — simulates agent queries */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Simulated agent query
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUERY_PRESETS.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedPreset(q.id)}
              className={[
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border text-left",
                selectedPreset === q.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
              ].join(" ")}
            >
              &ldquo;{q.question}&rdquo;
            </button>
          ))}
        </div>
        <p className="text-xs text-emerald-400 mt-1">{preset.story}</p>
      </div>

      {/* Main graph */}
      <Card className="border-emerald-500/25 border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-emerald-400">Knowledge Graph</CardTitle>
              <CardDescription className="text-xs">
                {preset.nodes.length} nodes · {preset.edges.length} edges · drag · zoom · pan
              </CardDescription>
            </div>
            <div className="flex gap-2 text-xs">
              {(["theme", "project", "funder", "document"] as const).map((cat) => (
                <span key={cat} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: { theme: "#6366f1", project: "#10b981", funder: "#f59e0b", document: "#06b6d4" }[cat] }} />
                  <span className="text-muted-foreground">{cat}</span>
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <EChartsChart
            option={graphOption}
            style={{ height: "480px", width: "100%" }}
          />
        </CardContent>
      </Card>

      {/* Library comparison for network graphs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            name: "ECharts graph",
            status: "✅ installed",
            color: "text-emerald-400",
            border: "border-emerald-500/25",
            best: "Force-directed, 20–300 nodes, agent-generative spec",
            tradeoff: "Not ideal for 500+ nodes or complex graph algorithms",
            verdict: "Use now. Handles Atlas corpus subgraphs well.",
          },
          {
            name: "AntV G6",
            status: "❌ not installed  (~npm install @antv/g6)",
            color: "text-muted-foreground",
            border: "border-border",
            best: "Advanced layouts (dagre, radial, concentric), 500+ nodes, clustering algorithms",
            tradeoff: "~400 kB, more complex API, React wrapper needed",
            verdict: "Upgrade path when corpus graphs exceed 300 nodes or need hierarchical layout.",
          },
          {
            name: "Neo4j NVL / FalkorDB browser",
            status: "❌ external tools",
            color: "text-muted-foreground",
            border: "border-border",
            best: "Native database browser — zero setup, full graph",
            tradeoff: "Can't embed in artifact panel; separate tool not in the Atlas UI",
            verdict: "Use FalkorDB browser for debugging/exploration. Not for end-user product.",
          },
        ].map((opt) => (
          <Card key={opt.name} className={`border ${opt.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold ${opt.color}`}>{opt.name}</CardTitle>
              <CardDescription className="text-xs">{opt.status}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Best for:</strong> {opt.best}</p>
              <p><strong className="text-foreground">Trade-off:</strong> {opt.tradeoff}</p>
              <p className={`italic ${opt.color}`}>{opt.verdict}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What the agent spec looks like */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">What the agent emits → what the artifact panel renders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto leading-relaxed text-foreground">{`// Agent (Python) queries Graphiti MCP, then emits:
chart_spec = {
  "type": "graph",
  "title": "EV Charging funding path",
  "nodes": [
    { "id": "t-ev",  "name": "EV Charging",    "category": "theme",   "value": 8 },
    { "id": "p-1",   "name": "EV Corridor Pilot","category": "project", "value": 5 },
    { "id": "f-iuk", "name": "Innovate UK",     "category": "funder",  "value": 7 },
  ],
  "links": [
    { "source": "t-ev",  "target": "p-1",  "label": "relates_to" },
    { "source": "p-1",   "target": "f-iuk","label": "funded_by"  },
  ]
}
// ChartRenderer dispatches to buildEChartGraphOption(nodes, links)
// → interactive force graph appears in the artifact panel`}</pre>
          <p className="text-xs text-muted-foreground">
            This is the D8 wiring task: add <code>type: &quot;graph&quot;</code> to <code>ChartSpec</code>, update
            <code>ChartRenderer</code> to dispatch to <code>EChartsChart</code>, and have the ATLAS/JARVIS
            agent include a Graphiti subgraph query in its response flow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function VisualisationLabPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Visualisation Lab</h1>
          <Badge variant="secondary" className="text-xs">Lab · Prototype</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          <strong>Network Graph</strong> — force-directed knowledge graph (query presets simulate agent → Graphiti subgraph → render).{" "}
          <strong>Bake-off</strong> — Recharts vs Vega-Lite vs ECharts + exclusive types.{" "}
          <strong>Vocabulary</strong> — every chart type live.{" "}
          <strong>Corpus Tests</strong> — fixture vs live DB.
        </p>
      </div>

      <Tabs defaultValue="network">
        <TabsList>
          <TabsTrigger value="network">Network Graph</TabsTrigger>
          <TabsTrigger value="bakeoff">Framework Bake-off</TabsTrigger>
          <TabsTrigger value="vocabulary">Chart Vocabulary</TabsTrigger>
          <TabsTrigger value="corpus">Corpus Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="network" className="mt-4"><NetworkGraphTab /></TabsContent>
        <TabsContent value="bakeoff" className="mt-4"><BakeoffTab /></TabsContent>
        <TabsContent value="vocabulary" className="mt-4"><VocabularyTab /></TabsContent>
        <TabsContent value="corpus" className="mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3" data-testid="visualisation-lab-cards">
            {TEST_CASES.map((tc) => <LabCard key={tc.id} tc={tc} />)}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
