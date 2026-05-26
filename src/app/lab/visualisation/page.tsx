"use client";

/**
 * /lab/visualisation — Atlas Visualisation Prototype Lab
 *
 * Two-mode per card:
 *   Fixture  — static mock data, proves the renderer can handle the shape
 *   Corpus   — live read-only aggregation from the atlas DB via
 *              GET /api/atlas5/visualisation-data?case=...
 *
 * Requires POSTGRES_URL (or DATABASE_URL) in .env for corpus mode.
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
import type { ChartDataRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RendererType = "bar" | "line" | "pie" | "stacked-bar" | "flow-svg";

interface TestCase {
  id: string;
  title: string;
  description: string;
  corpusCase?: string; // ?case= param for the API
  // Fixture data
  fixtureRenderer: RendererType;
  fixtureData: ChartDataRecord[];
  fixtureX: string;
  fixtureY: string;
  fixtureStory: string;
}

// ---------------------------------------------------------------------------
// Fixture data — static mocks, no DB required
// ---------------------------------------------------------------------------

const TEST_CASES: TestCase[] = [
  {
    id: "project_timeline",
    title: "Project Timeline",
    description: "CPC-funded innovation projects by year",
    corpusCase: "project_timeline",
    fixtureRenderer: "bar",
    fixtureX: "year",
    fixtureY: "count",
    fixtureStory: "Fixture: 10 years of mock CPC project activity",
    fixtureData: [
      { year: "2015", count: 4 },
      { year: "2016", count: 7 },
      { year: "2017", count: 11 },
      { year: "2018", count: 18 },
      { year: "2019", count: 23 },
      { year: "2020", count: 15 },
      { year: "2021", count: 29 },
      { year: "2022", count: 34 },
      { year: "2023", count: 41 },
      { year: "2024", count: 22 },
    ],
  },
  {
    id: "live_calls_landscape",
    title: "Live Calls Landscape",
    description: "Funding calls by funder — total volume",
    corpusCase: "live_calls_landscape",
    fixtureRenderer: "bar",
    fixtureX: "funder",
    fixtureY: "count",
    fixtureStory: "Fixture: mock funder call volumes",
    fixtureData: [
      { funder: "Innovate UK", count: 42 },
      { funder: "UKRI", count: 31 },
      { funder: "OZEV", count: 18 },
      { funder: "DfT", count: 14 },
      { funder: "Horizon EU", count: 9 },
      { funder: "Unknown", count: 6 },
    ],
  },
  {
    id: "knowledge_authority",
    title: "Knowledge Authority",
    description: "Approved documents by source type",
    corpusCase: "knowledge_authority",
    fixtureRenderer: "bar",
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
    fixtureRenderer: "bar",
    fixtureX: "label",
    fixtureY: "count",
    fixtureStory: "Fixture: mock theme distribution across corpus",
    fixtureData: [
      { label: "EV charging", count: 47 },
      { label: "active travel", count: 39 },
      { label: "freight decarbonisation", count: 31 },
      { label: "autonomous vehicles", count: 24 },
      { label: "MaaS", count: 19 },
      { label: "rail innovation", count: 15 },
      { label: "urban mobility", count: 12 },
    ],
  },
  {
    id: "innovation_map",
    title: "Innovation Map",
    description: "Transport relevance distribution across projects",
    corpusCase: "innovation_map",
    fixtureRenderer: "bar",
    fixtureX: "label",
    fixtureY: "count",
    fixtureStory: "Fixture: mock relevance score buckets",
    fixtureData: [
      { label: "0.8–1.0 (High)", count: 38 },
      { label: "0.6–0.8 (Good)", count: 61 },
      { label: "0.4–0.6 (Moderate)", count: 44 },
      { label: "0.2–0.4 (Low)", count: 22 },
      { label: "0.0–0.2 (Minimal)", count: 9 },
    ],
  },
  {
    id: "five_case_flow",
    title: "Five Case Model Flow",
    description: "HM Treasury Five Case Model dependency flow",
    // No corpus case — flow diagrams come from agent, not DB aggregate
    fixtureRenderer: "flow-svg",
    fixtureX: "",
    fixtureY: "",
    fixtureStory: "Fixture: Five Case Model — Static SVG (React Flow at D7)",
    fixtureData: [],
  },
];

// ---------------------------------------------------------------------------
// Corpus API response type (mirrors InnovationAtlas4.0 route contract)
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
}

// ---------------------------------------------------------------------------
// Five Case Model — inline SVG fixture
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
    <svg viewBox="0 0 500 200" className="w-full h-[200px]" aria-label="Five Case Model flow">
      {/* Arrows */}
      <line x1="110" y1="47" x2="180" y2="47" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="270" y1="47" x2="340" y2="47" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="230" y1="80" x2="230" y2="120" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <line x1="390" y1="80" x2="390" y2="120" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arr)" />
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {boxes.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={140} height={56} rx={6} fill={b.color} opacity={0.15} stroke={b.color} strokeWidth={1.5} />
          <text x={b.x + 70} y={b.y + 28} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={b.color} fontWeight="600">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stacked bar — corpus live_calls returns funder × status × count
// Pivot to show grouped bars by funder (sum across statuses)
// ---------------------------------------------------------------------------

function StackedBarFallback({ data }: { data: ChartDataRecord[] }) {
  // Aggregate: sum count by funder for simple display
  const byFunder = new Map<string, number>();
  for (const row of data) {
    const f = String(row.funder ?? "Unknown");
    byFunder.set(f, (byFunder.get(f) ?? 0) + Number(row.count ?? 0));
  }
  const aggregated = Array.from(byFunder.entries())
    .map(([funder, count]) => ({ funder, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return (
    <ChartRenderer
      spec={{ type: "bar", title: "Funder call volume", x: "funder", y: "count" }}
      data={aggregated}
    />
  );
}

// ---------------------------------------------------------------------------
// Per-card component
// ---------------------------------------------------------------------------

interface CardState {
  mode: "fixture" | "corpus";
  loading: boolean;
  corpus: CorpusResponse | null;
  error: string | null;
}

function LabCard({ tc }: { tc: TestCase }) {
  const [state, setState] = useState<CardState>({
    mode: "fixture",
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
        const res = await fetch(
          `/api/atlas5/visualisation-data?case=${tc.corpusCase}`,
          { signal: ctrl.signal },
        );
        const json: CorpusResponse = await res.json();
        if (!ctrl.signal.aborted) {
          setState((s) => ({
            ...s,
            loading: false,
            corpus: json,
            error: json.ok ? null : (json.error ?? "API error"),
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
    [tc.corpusCase],
  );

  const { mode, loading, corpus, error } = state;

  // Decide what to render in the chart area
  function renderChart() {
    if (tc.fixtureRenderer === "flow-svg") {
      return <FiveCaseSvg />;
    }
    if (mode === "fixture") {
      return (
        <ChartRenderer
          spec={{ type: tc.fixtureRenderer as "bar" | "line" | "pie", title: tc.title, x: tc.fixtureX, y: tc.fixtureY }}
          data={tc.fixtureData}
        />
      );
    }
    // Corpus mode
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground animate-pulse">
          Loading from DB…
        </div>
      );
    }
    if (error) {
      return (
        <div
          className="flex items-center justify-center h-[200px] text-sm text-destructive"
          data-testid={`corpus-error-${tc.id}`}
        >
          {error}
        </div>
      );
    }
    if (!corpus) {
      return (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
          Click Corpus to load
        </div>
      );
    }
    // Map corpus renderer hint to ChartRenderer type
    const r = corpus.renderer;
    const isMultiSeries = corpus.data.some((row) => "status" in row && "funder" in row);

    if (isMultiSeries) {
      return <StackedBarFallback data={corpus.data} />;
    }

    // Determine x/y keys from first data row
    const keys = corpus.data.length > 0 ? Object.keys(corpus.data[0]) : [];
    const xKey = keys.find((k) => k !== "count" && k !== "value") ?? keys[0] ?? "x";
    const yKey = keys.find((k) => k === "count" || k === "value") ?? keys[1] ?? "y";
    const chartType = r.includes("line") ? "line" : "bar";

    return (
      <ChartRenderer
        spec={{ type: chartType, title: corpus.story, x: xKey, y: yKey }}
        data={corpus.data}
      />
    );
  }

  const story =
    mode === "corpus" && corpus?.story
      ? corpus.story
      : mode === "corpus" && !corpus
      ? ""
      : tc.fixtureStory;

  return (
    <Card data-testid={`card-${tc.id}`} className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{tc.title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{tc.description}</CardDescription>
          </div>
          {/* Mode toggle */}
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
        {/* Story / source label */}
        {story && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{story}</p>
        )}
        {/* Caveats */}
        {mode === "corpus" && corpus?.caveats && corpus.caveats.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {corpus.caveats.map((c, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ {c}
              </li>
            ))}
          </ul>
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
          <Badge variant="secondary" className="text-xs">Lab · Not for production</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Each card has two modes: <strong>Fixture</strong> (static mock — proves the renderer
          handles the shape) and <strong>Corpus</strong> (live read-only DB aggregate — proves
          real Atlas stories are already visible). Requires{" "}
          <code className="text-xs bg-muted px-1 rounded">POSTGRES_URL</code> in{" "}
          <code className="text-xs bg-muted px-1 rounded">.env</code> for corpus mode.
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

      {/* Renderer stack status */}
      <Card data-testid="renderer-stack-status">
        <CardHeader>
          <CardTitle className="text-sm">Renderer Stack Status</CardTitle>
          <CardDescription className="text-xs">
            What is installed in this project vs InnovationAtlas4.0
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-1 font-medium">Library</th>
                <th className="pb-1 font-medium">Status</th>
                <th className="pb-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { lib: "recharts", status: "✅ Installed", note: "Used for all chart cards above" },
                { lib: "@xyflow/react", status: "❌ Not installed", note: "Add for Five Case flow at D7 — pnpm add @xyflow/react" },
                { lib: "vega / vega-lite / vega-embed", status: "❌ Not installed", note: "Add for CAP-002a — pnpm add vega vega-lite vega-embed" },
                { lib: "pg", status: "✅ Installed", note: "Corpus API uses pg.Pool (atlas schema not via Supabase REST)" },
                { lib: "server-only", status: "✅ Installed", note: "Guards corpus API route from client bundle" },
              ].map((r) => (
                <tr key={r.lib} className="py-1">
                  <td className="py-1.5 font-mono pr-4">{r.lib}</td>
                  <td className="py-1.5 pr-4 whitespace-nowrap">{r.status}</td>
                  <td className="py-1.5 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
