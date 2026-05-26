"use client";

/**
 * /lab/visualisation — Atlas Visualisation Prototype Lab
 *
 * Three tabs:
 *   Corpus Tests  — per-card fixture vs live atlas DB aggregate (original)
 *   Framework Bake-off — same data rendered in Recharts AND Vega-Lite side-by-side
 *                        with commentary: why this chart type, agent reliability,
 *                        bundle cost, and the key Vega-Lite encoding snippet
 *   Chart Vocabulary   — gallery of every renderable chart type (Recharts + planned ECharts)
 *
 * Requires POSTGRES_URL in .env for corpus mode. Zero agent calls. Zero writes.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import { VegaLiteChart } from "@/components/lab/vega-lite-chart";
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
// Test cases (shared across all three tabs)
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
      { label: "freight decarbonisation", count: 31 },
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
    fixtureStory: "Fixture: mock 2D project scatter (viz_x/viz_y proxy)",
    fixtureData: Array.from({ length: 40 }, (_, i) => ({
      x: Math.round((Math.sin(i * 0.7) * 45 + 50) * 10) / 10,
      y: Math.round((Math.cos(i * 0.5) * 35 + 50) * 10) / 10,
      label: `Project ${i + 1}`,
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
// Corpus API type
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
// CorpusTests tab — per-card component
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
            ...s,
            loading: false,
            corpus: json,
            chartType: suggested,
            error: json.ok ? null : (json.detail ?? json.error ?? "API error"),
          }));
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : "Fetch failed",
          }));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tc.corpusCase],
  );

  const { mode, chartType, loading, corpus, error } = state;
  const activeData: ChartDataRecord[] =
    mode === "corpus" && corpus?.ok ? corpus.data : tc.fixtureData;
  const recommended = suggestChartType(activeData);

  function buildSpec(): ChartSpec {
    const xKey =
      mode === "corpus" && corpus?.data.length
        ? Object.keys(corpus.data[0]).find((k) => k !== "count" && k !== "value") ?? tc.fixtureX
        : tc.fixtureX;
    const yKey =
      mode === "corpus" && corpus?.data.length
        ? (Object.keys(corpus.data[0]).find((k) => k === "count" || k === "value") ?? tc.fixtureY)
        : tc.fixtureY;
    const seriesKey = tc.fixtureSeries ?? "series";

    if (chartType === "stacked-bar") {
      return { type: "stacked-bar", title: tc.title, x: xKey, y: yKey, series: seriesKey };
    }
    return { type: chartType as Exclude<ChartType, "stacked-bar">, title: tc.title, x: xKey, y: yKey };
  }

  const story =
    mode === "corpus" && corpus?.story ? corpus.story : tc.fixtureStory;

  function renderChart() {
    if (tc.id === "five_case_flow") return <FiveCaseSvg />;
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground animate-pulse">
          Loading from corpus…
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[220px] gap-2" data-testid={`corpus-error-${tc.id}`}>
          <span className="text-xs text-destructive">{error}</span>
          <span className="text-xs text-muted-foreground">Fixture mode still works ↑</span>
        </div>
      );
    }
    if (mode === "corpus" && !corpus) {
      return (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
          Click Corpus to load live data
        </div>
      );
    }
    if (activeData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
          No data returned
        </div>
      );
    }
    return <ChartRenderer spec={buildSpec()} data={activeData} />;
  }

  return (
    <Card data-testid={`card-${tc.id}`} className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">{tc.title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{tc.description}</CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant={mode === "fixture" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => switchMode("fixture")}
              data-testid={`mode-fixture-${tc.id}`}
            >
              Fixture
            </Button>
            <Button
              variant={mode === "corpus" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => switchMode("corpus")}
              disabled={!tc.corpusCase}
              data-testid={`mode-corpus-${tc.id}`}
            >
              Corpus
            </Button>
          </div>
        </div>
        {story && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{story}</p>}
        {mode === "corpus" && corpus?.data_source && (
          <p className="text-xs font-mono text-indigo-500 dark:text-indigo-400">
            ↳ {corpus.data_source} · {corpus.row_count} rows
          </p>
        )}
        {mode === "corpus" && corpus?.caveats?.length ? (
          <ul className="mt-0.5 space-y-0.5">
            {corpus.caveats.map((c, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {c}</li>
            ))}
          </ul>
        ) : null}
        {tc.id !== "five_case_flow" && (
          <ChartTypePicker
            value={chartType}
            onChange={(t) => setState((s) => ({ ...s, chartType: t }))}
            recommended={recommended}
          />
        )}
      </CardHeader>
      <CardContent className="pt-0 flex-1" data-testid={`chart-${tc.id}`}>
        {renderChart()}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework Bake-off tab
// ─────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_META = {
  recharts: {
    name: "Recharts",
    bundle: "~180 kB",
    approach: "JSX components",
    description: "You write React JSX; it compiles to SVG. Full control over every prop but the LLM must produce valid JSX — easy to get attribute names wrong.",
    strengths: ["Native React, no extra runtime", "Smooth animations", "Custom tooltip content", "7 types working now"],
    tradeoffs: ["LLM writes JSX, not JSON — higher error rate", "Each chart type is a different component API"],
    reliabilityStars: 3,
    color: "text-violet-500",
    borderColor: "border-violet-500/30",
  },
  vegaLite: {
    name: "Vega-Lite",
    bundle: "~620 kB (vega + vega-lite + vega-embed)",
    approach: "JSON grammar",
    description: "You describe what you want (mark type + field encodings); the engine figures out how to draw it. LLMs write this grammar very reliably — it's well-represented in training data.",
    strengths: ["LLM writes JSON spec directly — fewer hallucinations", "30+ chart types, composable layers", "Built-in transforms (aggregate, filter, fold)", "Agent just outputs spec — no JSX needed"],
    tradeoffs: ["3× larger bundle than Recharts", "Less React-idiomatic — needs useEffect mount", "Limited custom theming vs Recharts"],
    reliabilityStars: 5,
    color: "text-sky-500",
    borderColor: "border-sky-500/30",
  },
};

/** Build a Vega-Lite v5 spec from the test case data */
function buildVegaSpec(
  tc: TestCase,
  data: ChartDataRecord[],
  chartType: ChartType,
): object {
  const xKey = tc.fixtureX;
  const yKey = tc.fixtureY;
  const seriesKey = tc.fixtureSeries;

  // VL chart type mapping — where VL differs from Recharts names
  const vegaMark: Record<ChartType, string> = {
    bar: "bar",
    line: "line",
    area: "area",
    pie: "arc",
    scatter: "point",
    "radial-bar": "arc", // VL has no radial-bar; use donut
    "stacked-bar": "bar",
  };

  const mark = vegaMark[chartType] ?? "bar";

  const base = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container" as const,
    height: 210,
    background: "transparent",
    data: { values: data },
    config: {
      view: { stroke: "transparent" },
      axis: {
        domainColor: "#475569",
        gridColor: "#1e293b",
        labelColor: "#94a3b8",
        titleColor: "#94a3b8",
        labelFontSize: 11,
      },
      legend: { labelColor: "#94a3b8", titleColor: "#94a3b8", labelFontSize: 11 },
    },
  };

  // Arc / donut (pie + radial-bar)
  if (mark === "arc") {
    return {
      ...base,
      mark: { type: "arc", innerRadius: chartType === "radial-bar" ? 20 : 40, outerRadius: 95 },
      encoding: {
        theta: { field: yKey, type: "quantitative" },
        color: { field: xKey, type: "nominal", scale: { scheme: "category10" } },
        tooltip: [
          { field: xKey, type: "nominal" },
          { field: yKey, type: "quantitative" },
        ],
      },
    };
  }

  // Scatter
  if (mark === "point") {
    return {
      ...base,
      mark: { type: "point", filled: true, size: 60, opacity: 0.75 },
      encoding: {
        x: { field: xKey, type: "quantitative", axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#0ea5e9" },
        tooltip: [
          { field: xKey, type: "quantitative" },
          { field: yKey, type: "quantitative" },
        ],
      },
    };
  }

  // Stacked bar — color encoding on series creates stacking automatically
  if (chartType === "stacked-bar" && seriesKey) {
    return {
      ...base,
      mark: { type: "bar", cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 },
      encoding: {
        x: { field: xKey, type: "nominal", axis: { labelAngle: -30 } },
        y: { field: yKey, type: "quantitative" },
        color: { field: seriesKey, type: "nominal", scale: { scheme: "category10" } },
        tooltip: [
          { field: xKey, type: "nominal" },
          { field: seriesKey, type: "nominal" },
          { field: yKey, type: "quantitative" },
        ],
      },
    };
  }

  // Area / Line — treat x as ordinal (year, month strings) or quantitative
  const xIsNumeric = data.length > 0 && typeof data[0][xKey] === "number";
  const xType = xIsNumeric ? "quantitative" : "ordinal";

  if (mark === "area") {
    return {
      ...base,
      mark: { type: "area", interpolate: "monotone", fillOpacity: 0.3, strokeWidth: 2, line: true },
      encoding: {
        x: { field: xKey, type: xType, axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#6366f1" },
        tooltip: [{ field: xKey, type: xType }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  if (mark === "line") {
    return {
      ...base,
      mark: { type: "line", interpolate: "monotone", strokeWidth: 2, point: true },
      encoding: {
        x: { field: xKey, type: xType, axis: { labelAngle: 0 } },
        y: { field: yKey, type: "quantitative" },
        color: { value: "#6366f1" },
        tooltip: [{ field: xKey, type: xType }, { field: yKey, type: "quantitative" }],
      },
    };
  }

  // Default: bar
  return {
    ...base,
    mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    encoding: {
      x: { field: xKey, type: "nominal", axis: { labelAngle: -30 } },
      y: { field: yKey, type: "quantitative" },
      color: { field: xKey, type: "nominal", scale: { scheme: "category10" }, legend: null },
      tooltip: [
        { field: xKey, type: "nominal" },
        { field: yKey, type: "quantitative" },
      ],
    },
  };
}

/** Short excerpt of the key VL encoding for the "agent would write" snippet */
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

const BAKEOFF_COMMENTARY: Record<string, { whyChart: string; vegaInsight: string }> = {
  project_timeline: {
    whyChart: "Time-ordered data with a single metric. Area mark shows the shape of growth while preserving temporal flow — the filled region emphasises accumulation, not just point values.",
    vegaInsight: "VL detects ordinal year → quantitative count → area mark. An LLM writes this 6-line spec reliably because the year/count pattern is extremely common in training data.",
  },
  live_calls_landscape: {
    whyChart: "Three-dimensional data: funder (category) × status (group) × count (value). Stacked bars compare totals while revealing internal composition — you see both 'who has the most calls' and 'what share are open'.",
    vegaInsight: "Color encoding on the status field creates stacked bars automatically. No client-side pivot needed — VL handles aggregation natively. LLMs write this pattern very reliably.",
  },
  knowledge_authority: {
    whyChart: "Simple categorical ranking. Bar chart is the most honest encoding — no distortion, no ambiguity, easy to compare across categories.",
    vegaInsight: "The shortest VL spec: mark:bar + x:nominal + y:quantitative. Every LLM writes this correctly on the first attempt. The baseline proof that the agent-to-chart pipeline works.",
  },
  semantic_clusters: {
    whyChart: "Part-to-whole relationship with 6 named categories. Donut/arc shows proportion at a glance; the hole prevents the 'area perception' distortion of a solid pie.",
    vegaInsight: "VL arc mark with theta encoding maps directly to a donut chart. Recharts radial-bar is more distinctive and shows ranking more clearly — a case where Recharts wins aesthetically.",
  },
  innovation_map: {
    whyChart: "Two independent numeric axes with no natural ordering. Scatter plot is the only honest 2D encoding — it reveals clusters, outliers, and correlations that any 1D chart would hide.",
    vegaInsight: "Point mark with x/y quantitative fields. One of VL's cleanest specs: 5 lines total. When viz_x/viz_y are populated from UMAP, this becomes the most valuable chart in the corpus.",
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

function BakeoffTab() {
  const caseOptions = TEST_CASES.filter((tc) => tc.id !== "five_case_flow");
  const [selectedId, setSelectedId] = useState(caseOptions[0].id);
  const [showSnippet, setShowSnippet] = useState(false);

  const tc = caseOptions.find((c) => c.id === selectedId) ?? caseOptions[0];
  const data = tc.fixtureData;
  const chartType = tc.defaultChartType;
  const commentary = BAKEOFF_COMMENTARY[tc.id];
  const snippet = VL_SNIPPETS[tc.id];

  const rechartsSpec: ChartSpec = useMemo(() => {
    if (chartType === "stacked-bar" && tc.fixtureSeries) {
      return { type: "stacked-bar", title: tc.title, x: tc.fixtureX, y: tc.fixtureY, series: tc.fixtureSeries };
    }
    return { type: chartType as Exclude<ChartType, "stacked-bar">, title: tc.title, x: tc.fixtureX, y: tc.fixtureY };
  }, [tc, chartType]);

  const vegaSpec = useMemo(
    () => buildVegaSpec(tc, data, chartType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tc.id, chartType],
  );

  return (
    <div className="space-y-4">
      {/* Dataset picker */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dataset</p>
        <div className="flex flex-wrap gap-1.5">
          {caseOptions.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedId(c.id); setShowSnippet(false); }}
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
          <CardContent className="pt-4 pb-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">Why {TYPE_LABELS[chartType]} for this data?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{commentary.whyChart}</p>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recharts panel */}
        <Card className={`border ${FRAMEWORK_META.recharts.borderColor}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className={`text-sm font-semibold ${FRAMEWORK_META.recharts.color}`}>
                  Recharts
                </CardTitle>
                <CardDescription className="text-xs">{FRAMEWORK_META.recharts.approach}</CardDescription>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs text-muted-foreground">{FRAMEWORK_META.recharts.bundle}</p>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs text-muted-foreground">LLM reliability</span>
                  <ReliabilityStars n={FRAMEWORK_META.recharts.reliabilityStars} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartRenderer spec={rechartsSpec} data={data} />
            <div className="mt-3 pt-3 border-t space-y-1">
              <p className="text-xs text-muted-foreground">{FRAMEWORK_META.recharts.description}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {FRAMEWORK_META.recharts.strengths.map((s) => (
                  <span key={s} className="text-xs px-1.5 py-0.5 bg-violet-500/10 text-violet-400 rounded">+ {s}</span>
                ))}
                {FRAMEWORK_META.recharts.tradeoffs.map((s) => (
                  <span key={s} className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">− {s}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vega-Lite panel */}
        <Card className={`border ${FRAMEWORK_META.vegaLite.borderColor}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className={`text-sm font-semibold ${FRAMEWORK_META.vegaLite.color}`}>
                  Vega-Lite
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">v5</span>
                </CardTitle>
                <CardDescription className="text-xs">{FRAMEWORK_META.vegaLite.approach}</CardDescription>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs text-muted-foreground">{FRAMEWORK_META.vegaLite.bundle}</p>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs text-muted-foreground">LLM reliability</span>
                  <ReliabilityStars n={FRAMEWORK_META.vegaLite.reliabilityStars} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <VegaLiteChart spec={vegaSpec} className="w-full h-[210px]" />
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-xs text-muted-foreground">{FRAMEWORK_META.vegaLite.description}</p>
              {commentary && (
                <p className="text-xs text-sky-400/80 italic">{commentary.vegaInsight}</p>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                {FRAMEWORK_META.vegaLite.strengths.map((s) => (
                  <span key={s} className="text-xs px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded">+ {s}</span>
                ))}
                {FRAMEWORK_META.vegaLite.tradeoffs.map((s) => (
                  <span key={s} className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">− {s}</span>
                ))}
              </div>
              {snippet && (
                <div>
                  <button
                    onClick={() => setShowSnippet((v) => !v)}
                    className="text-xs text-sky-500 hover:text-sky-400 font-mono"
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
      </div>

      {/* ECharts coming soon */}
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-muted-foreground">ECharts <Badge variant="outline" className="text-xs ml-1">Not installed</Badge></CardTitle>
              <CardDescription className="text-xs">~300 kB tree-shaken · JSON option object API</CardDescription>
            </div>
            <ReliabilityStars n={4} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] rounded border border-dashed flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-muted-foreground">Unlocks: Sankey (funding flows), Radar (Five Case coverage), Heatmap, Tree map</p>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">npm install echarts echarts-for-react</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ~ 2-4 h to wire up. Worth it when corpus data supports funding flow (funder → project → theme Sankey)
            or Five Case coverage radar.
          </p>
        </CardContent>
      </Card>
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

const VOCAB_ITEMS: VocabItem[] = [
  {
    type: "bar",
    name: "Bar",
    whenToUse: "Compare discrete categories. The baseline — always try this first.",
    dataShape: "x: categorical · y: quantitative",
    vlMark: "bar",
    spec: { type: "bar", title: "Bar", x: "label", y: "value" },
    data: [
      { label: "Policy", value: 34 }, { label: "Research", value: 28 },
      { label: "Guidance", value: 19 }, { label: "Case study", value: 13 }, { label: "Other", value: 5 },
    ],
  },
  {
    type: "line",
    name: "Line",
    whenToUse: "Continuous trend over ordered data. Good when precise point values matter.",
    dataShape: "x: ordinal/temporal · y: quantitative",
    vlMark: "line",
    spec: { type: "line", title: "Line", x: "year", y: "count" },
    data: [
      { year: "2019", count: 15 }, { year: "2020", count: 23 }, { year: "2021", count: 18 },
      { year: "2022", count: 31 }, { year: "2023", count: 27 }, { year: "2024", count: 38 },
    ],
  },
  {
    type: "area",
    name: "Area",
    whenToUse: "Cumulative trend or volume over time. Fill emphasises magnitude.",
    dataShape: "x: temporal · y: quantitative",
    vlMark: "area",
    spec: { type: "area", title: "Area", x: "year", y: "count" },
    data: [
      { year: "2019", count: 15 }, { year: "2020", count: 23 }, { year: "2021", count: 18 },
      { year: "2022", count: 31 }, { year: "2023", count: 27 }, { year: "2024", count: 38 },
    ],
  },
  {
    type: "pie",
    name: "Pie / Donut",
    whenToUse: "Part-to-whole with ≤ 6 slices. Use when proportion matters more than exact value.",
    dataShape: "category + value · ≤ 6 items",
    vlMark: "arc",
    spec: { type: "pie", title: "Pie", x: "label", y: "value" },
    data: [
      { label: "EV", value: 30 }, { label: "Rail", value: 22 },
      { label: "Active travel", value: 18 }, { label: "Freight", value: 15 }, { label: "Other", value: 15 },
    ],
  },
  {
    type: "scatter",
    name: "Scatter",
    whenToUse: "Two numeric variables. Reveals clusters, outliers, and correlations.",
    dataShape: "x: quantitative · y: quantitative",
    vlMark: "point",
    spec: { type: "scatter", title: "Scatter", x: "x", y: "y" },
    data: Array.from({ length: 25 }, (_, i) => ({
      x: Math.round((Math.sin(i * 0.9) * 40 + 50) * 10) / 10,
      y: Math.round((Math.cos(i * 0.6) * 30 + 50) * 10) / 10,
    })),
  },
  {
    type: "radial-bar",
    name: "Radial Bar",
    whenToUse: "Ranked categories as arcs. More visual impact than bar for ≤ 8 items.",
    dataShape: "label + value · ≤ 8 items · ranked",
    vlMark: "arc (+ radius scale)",
    spec: { type: "radial-bar", title: "Radial Bar", x: "label", y: "value" },
    data: [
      { label: "EV charging", value: 47 }, { label: "Active travel", value: 39 },
      { label: "Freight", value: 31 }, { label: "AV", value: 24 },
      { label: "MaaS", value: 19 }, { label: "Rail", value: 15 },
    ],
  },
  {
    type: "stacked-bar",
    name: "Stacked Bar",
    whenToUse: "Compare category totals AND composition. Needs a series dimension.",
    dataShape: "x: categorical · y: quantitative · series: categorical",
    vlMark: "bar + color encoding",
    spec: { type: "stacked-bar", title: "Stacked Bar", x: "funder", y: "count", series: "status" },
    data: [
      { funder: "Innovate UK", status: "open", count: 18 },
      { funder: "Innovate UK", status: "closed", count: 24 },
      { funder: "UKRI", status: "open", count: 12 },
      { funder: "UKRI", status: "closed", count: 19 },
      { funder: "OZEV", status: "open", count: 8 },
      { funder: "OZEV", status: "closed", count: 10 },
    ],
  },
];

const ECHARTS_COMING_SOON = [
  {
    name: "Sankey",
    whenToUse: "Flow from source → destination. Perfect for funder → project → theme flow.",
    dataShape: "nodes[] + links[] with source/target/value",
    unlock: "npm install echarts echarts-for-react",
  },
  {
    name: "Radar",
    whenToUse: "Multi-axis coverage score. Five Case Model completeness, evidence coverage.",
    dataShape: "axes[] + series[] with per-axis values",
    unlock: "npm install echarts echarts-for-react",
  },
  {
    name: "Heatmap",
    whenToUse: "Matrix density. Funder × theme × activity intensity.",
    dataShape: "x: categorical · y: categorical · value: quantitative",
    unlock: "npm install echarts echarts-for-react",
  },
  {
    name: "Tree / Sunburst",
    whenToUse: "Hierarchical breakdown. Sector → sub-sector → project.",
    dataShape: "Nested { name, children[] } tree",
    unlock: "npm install echarts echarts-for-react",
  },
];

function VocabularyTab() {
  return (
    <div className="space-y-8">
      {/* Recharts — installed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Recharts</h2>
          <Badge variant="secondary" className="text-xs">7 types · installed</Badge>
          <span className="text-xs text-muted-foreground font-mono">~180 kB</span>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {VOCAB_ITEMS.map((item) => (
            <Card key={item.type} className="flex flex-col">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold">{item.name}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{item.whenToUse}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <ChartRenderer spec={item.spec} data={item.data} />
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-mono text-muted-foreground truncate" title={item.dataShape}>
                    {item.dataShape}
                  </p>
                  <p className="text-xs text-sky-400/70">
                    VL: <span className="font-mono">{item.vlMark}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ECharts — coming soon */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">ECharts</h2>
          <Badge variant="outline" className="text-xs">Not installed · ~300 kB tree-shaken</Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {ECHARTS_COMING_SOON.map((item) => (
            <Card key={item.name} className="flex flex-col opacity-60 border-dashed">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold">{item.name}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{item.whenToUse}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[100px] rounded border border-dashed flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Not rendered</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-2 truncate" title={item.dataShape}>
                  {item.dataShape}
                </p>
                <code className="text-xs text-amber-500 block mt-1 truncate">{item.unlock}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* @xyflow/react — installed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">@xyflow/react</h2>
          <Badge variant="secondary" className="text-xs">installed · D7 work</Badge>
        </div>
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="h-[100px] rounded border border-dashed flex flex-col items-center justify-center gap-2">
              <p className="text-xs text-muted-foreground">Five Case Model dependency flow · Knowledge graph viz · DAG workflows</p>
              <p className="text-xs text-muted-foreground">Wire up at D7 — package is ready</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategy note */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Render stack decision</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">Recharts (default)</p>
              <p>Use for dashboard widgets, artifact panel charts, and any chart the agent generates via <code>chart_spec</code>. Full React control. 7 types live now.</p>
            </div>
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">Vega-Lite (bake-off)</p>
              <p>Use when the agent needs to generate complex chart configs directly from JSON. Better LLM reliability for novel encodings. Composable multi-view. Already installed.</p>
            </div>
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">ECharts (deferred)</p>
              <p>Install when corpus data supports Sankey (funder flow), Radar (Five Case coverage), or Heatmap. ~2-4 h. Unlock on evidence, not on speculation.</p>
            </div>
          </div>
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
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Visualisation Lab</h1>
          <Badge variant="secondary" className="text-xs">Lab · Prototype</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Prove the render stack before wiring the agent.{" "}
          <strong>Corpus Tests</strong> — fixture vs live DB.{" "}
          <strong>Bake-off</strong> — Recharts vs Vega-Lite side-by-side.{" "}
          <strong>Vocabulary</strong> — every chart type the agent can use.
        </p>
      </div>

      <Tabs defaultValue="corpus">
        <TabsList>
          <TabsTrigger value="corpus">Corpus Tests</TabsTrigger>
          <TabsTrigger value="bakeoff">Framework Bake-off</TabsTrigger>
          <TabsTrigger value="vocabulary">Chart Vocabulary</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Corpus Tests ───────────────────────────────────────────── */}
        <TabsContent value="corpus" className="mt-4">
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            data-testid="visualisation-lab-cards"
          >
            {TEST_CASES.map((tc) => (
              <LabCard key={tc.id} tc={tc} />
            ))}
          </div>
        </TabsContent>

        {/* ── Tab 2: Framework Bake-off ────────────────────────────────────── */}
        <TabsContent value="bakeoff" className="mt-4">
          <BakeoffTab />
        </TabsContent>

        {/* ── Tab 3: Chart Vocabulary ──────────────────────────────────────── */}
        <TabsContent value="vocabulary" className="mt-4">
          <VocabularyTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
