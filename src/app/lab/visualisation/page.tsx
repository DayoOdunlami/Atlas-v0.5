"use client";

/**
 * /lab/visualisation — Atlas Visualisation Prototype Lab
 *
 * Purpose: Test every recharts renderer against both static fixtures AND
 * live atlas DB aggregates. Working visuals get promoted to main pages.
 *
 * Two modes per card:
 *   Fixture  — static mock, proves renderer can handle the data shape
 *   Corpus   — live read-only aggregation via /api/atlas5/visualisation-data
 *
 * Per-card chart type override lets you try any renderer on any dataset.
 *
 * Requires POSTGRES_URL in .env for corpus mode.
 * Zero agent calls. Zero writes.
 */

import { useCallback, useRef, useState } from "react";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHART_TYPES, type ChartType, type ChartDataRecord, type ChartSpec } from "@/lib/types";

// ---------------------------------------------------------------------------
// Map API renderer hint → best ChartType
// ---------------------------------------------------------------------------

function inferChartType(rendererHint: string, data: ChartDataRecord[]): ChartType {
  if (rendererHint.includes("line")) return "line";
  if (rendererHint.includes("scatter")) return "scatter";
  if (rendererHint.includes("stacked")) {
    // If data has a series-like field, use stacked-bar
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    if (keys.length >= 3) return "stacked-bar";
  }
  return "bar";
}

// ---------------------------------------------------------------------------
// Auto-suggest the most compelling chart type for a given data shape
// ---------------------------------------------------------------------------

function suggestChartType(data: ChartDataRecord[]): ChartType {
  if (data.length === 0) return "bar";
  const keys = Object.keys(data[0]);
  const hasXY = keys.includes("x") && keys.includes("y");
  const hasSeries = keys.length >= 3 && keys.some(k => k !== "count" && k !== "value");
  const isTimeSeries = keys.some(k => k === "year" || k === "date" || k === "month");
  const isProportional = data.length <= 6;

  if (hasXY) return "scatter";
  if (hasSeries) return "stacked-bar";
  if (isTimeSeries) return "area";
  if (isProportional) return "pie";
  return "bar";
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

interface TestCase {
  id: string;
  title: string;
  description: string;
  corpusCase?: string;
  defaultChartType: ChartType;
  fixtureData: ChartDataRecord[];
  fixtureX: string;
  fixtureY: string;
  fixtureSeries?: string; // for stacked-bar
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
    description: "Approved documents by source type × tier",
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
    description: "Top themes / clusters in the knowledge base",
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
    description: "Project distribution in innovation space",
    corpusCase: "innovation_map",
    defaultChartType: "scatter",
    fixtureX: "x",
    fixtureY: "y",
    fixtureStory: "Fixture: mock 2D project scatter (viz_x/viz_y proxy)",
    fixtureData: Array.from({ length: 40 }, (_, i) => ({
      x: Math.round((Math.random() * 100) * 10) / 10,
      y: Math.round((Math.random() * 100) * 10) / 10,
      label: `Project ${i + 1}`,
    })),
  },
  {
    id: "five_case_flow",
    title: "Five Case Model",
    description: "HM Treasury Five Case Model dependency flow",
    defaultChartType: "bar", // placeholder — flow-svg overrides
    fixtureX: "",
    fixtureY: "",
    fixtureStory: "Fixture: Five Case Model — SVG (React Flow at D7)",
    fixtureData: [],
  },
];

// ---------------------------------------------------------------------------
// Corpus API response contract
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Five Case Model SVG fixture
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Chart type pill selector
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ChartType, string> = {
  "bar": "Bar",
  "line": "Line",
  "area": "Area",
  "pie": "Pie",
  "scatter": "Scatter",
  "radial-bar": "Radial",
  "stacked-bar": "Stacked",
};

function ChartTypePicker({
  value,
  onChange,
  recommended,
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

// ---------------------------------------------------------------------------
// Per-card component
// ---------------------------------------------------------------------------

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
          const suggested = json.ok
            ? inferChartType(json.renderer, json.data)
            : state.chartType;
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

  // Build ChartSpec from current type + data keys
  function buildSpec(): ChartSpec {
    const xKey = mode === "corpus" && corpus?.data.length
      ? Object.keys(corpus.data[0]).find(k => k !== "count" && k !== "value") ?? tc.fixtureX
      : tc.fixtureX;
    const yKey = mode === "corpus" && corpus?.data.length
      ? (Object.keys(corpus.data[0]).find(k => k === "count" || k === "value") ?? tc.fixtureY)
      : tc.fixtureY;
    const seriesKey = tc.fixtureSeries ?? "series";

    if (chartType === "stacked-bar") {
      return { type: "stacked-bar", title: tc.title, x: xKey, y: yKey, series: seriesKey };
    }
    return { type: chartType as Exclude<ChartType, "stacked-bar">, title: tc.title, x: xKey, y: yKey };
  }

  const story =
    mode === "corpus" && corpus?.story
      ? corpus.story
      : tc.fixtureStory;

  function renderChart() {
    // Five Case always shows SVG
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
          {/* Fixture / Corpus toggle */}
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

        {/* Story line */}
        {story && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{story}</p>
        )}

        {/* Data source badge */}
        {mode === "corpus" && corpus?.data_source && (
          <p className="text-xs font-mono text-indigo-500 dark:text-indigo-400">
            ↳ {corpus.data_source} · {corpus.row_count} rows
          </p>
        )}

        {/* Caveats */}
        {mode === "corpus" && corpus?.caveats?.length ? (
          <ul className="mt-0.5 space-y-0.5">
            {corpus.caveats.map((c, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {c}</li>
            ))}
          </ul>
        ) : null}

        {/* Chart type picker — hidden for flow */}
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VisualisationLabPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Visualisation Lab</h1>
          <Badge variant="secondary" className="text-xs">Lab · Prototype</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Each card: <strong>Fixture</strong> (static mock) or <strong>Corpus</strong> (live atlas DB).
          Use the chart type pills to try any renderer on any dataset — ★ = recommended for this data shape.
          Working charts get promoted to the main dashboard or artifact panel.
        </p>
      </div>

      {/* Card grid */}
      <div
        className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        data-testid="visualisation-lab-cards"
      >
        {TEST_CASES.map((tc) => (
          <LabCard key={tc.id} tc={tc} />
        ))}
      </div>

      {/* Strategy note */}
      <Card data-testid="renderer-stack-status">
        <CardHeader>
          <CardTitle className="text-sm">What you&apos;re prototyping toward</CardTitle>
          <CardDescription className="text-xs">
            3 connection paths — try them in order of effort
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">① Direct DB (done)</p>
              <p>pg.Pool → atlas schema → recharts. This page. Best for static corpus summaries and dashboard widgets.</p>
              <Badge variant="outline" className="text-xs">SSL fixed ✓</Badge>
            </div>
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">② Agent-generative (next)</p>
              <p>CopilotKit agent generates a <code>chart_spec</code> object → ChartRenderer renders it. Modelled on <a href="https://github.com/CopilotKit/generative-ui-playground" className="underline text-indigo-500" target="_blank" rel="noreferrer">generative-ui-playground</a>. Agent picks the chart type.</p>
              <Badge variant="outline" className="text-xs">Needs agent wiring</Badge>
            </div>
            <div className="border rounded p-3 space-y-1">
              <p className="font-semibold text-foreground">③ MCP tool → chart</p>
              <p>Python agent calls CPC-corpus MCP (port 7001) → gets ranked projects → generates chart_spec with citations. Full atlas pipeline.</p>
              <Badge variant="outline" className="text-xs">Needs MCP wiring</Badge>
            </div>
          </div>
          <div className="border rounded p-3">
            <p className="font-semibold text-foreground mb-1">Install queue</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { pkg: "@xyflow/react", status: "❌", gets: "Five Case flow, knowledge graph, dependency maps" },
                { pkg: "vega-lite + vega-embed", status: "❌", gets: "Agent-generated complex chart specs (LLM knows this grammar well)" },
                { pkg: "pg + server-only", status: "✅", gets: "Corpus API (this page)" },
                { pkg: "recharts", status: "✅", gets: "Bar, line, area, pie, scatter, radial, stacked (all in use above)" },
              ].map(r => (
                <div key={r.pkg} className="space-y-0.5">
                  <p className="font-mono text-foreground">{r.status} {r.pkg}</p>
                  <p>{r.gets}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
