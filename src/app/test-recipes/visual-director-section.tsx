"use client";

/**
 * Atlas Visual Recipe Director — interactive test section.
 *
 * Shows the director's intent classification and visual selection in real time.
 * Type any query; the director classifies its intent, inspects the example data
 * shape, and explains which visual it would choose and why.
 *
 * Purpose: validate the grammar table; use as a reference when briefing the
 * Python agent to mirror this logic in chart_specs generation.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  classifyIntent,
  inspectData,
  selectVisuals,
  RECIPE_CONTEXTS,
  QUADRANT_CONFIG,
  classifyQuadrant,
  type AnalyticalIntent,
  type VisualFamily,
  type VisualSelection,
  type RecipeContext,
} from "@/lib/atlas/visual-recipe-director";

// ── Example query chips ───────────────────────────────────────────────────────

interface ExampleQuery {
  label: string;
  query: string;
  recipeId: string;
}

const EXAMPLE_QUERIES: ExampleQuery[] = [
  {
    label: "Which areas overlap?",
    query: "Which CPC business units overlap with climate adaptation and transport themes?",
    recipeId: "cpc_portfolio_comparison",
  },
  {
    label: "How bid-ready?",
    query: "How bid-ready is Future Mobility for the UKRI Smart Mobility Challenge?",
    recipeId: "cpc_capability_assessment",
  },
  {
    label: "Where is evidence thin?",
    query: "Where are the biggest evidence gaps in the CPC corpus?",
    recipeId: "cpc_evidence_gaps",
  },
  {
    label: "High fit, weak evidence?",
    query: "Which calls have high fit but weak evidence — not worth bidding without enrichment?",
    recipeId: "cpc_opportunity_fit",
  },
  {
    label: "Where does funding flow?",
    query: "Where does Innovate UK funding flow through CPC's portfolio?",
    recipeId: "cpc_funding_flow",
  },
  {
    label: "Which calls match?",
    query: "Which live calls best match CPC's current evidence base?",
    recipeId: "cpc_market_alignment",
  },
  {
    label: "How reliable?",
    query: "How reliable is the evidence? What proportion can be cited in a bid?",
    recipeId: "cpc_evidence_gaps",
  },
  {
    label: "Compare units",
    query: "Compare all CPC business units by project count and claims depth.",
    recipeId: "cpc_portfolio_comparison",
  },
];

// Example data shapes for each recipe context
const EXAMPLE_DATA: Record<string, Record<string, unknown>[]> = {
  cpc_capability_assessment: [
    { level: 1, confidence_tier: "Robust", score: 0.91 },
    { level: 2, confidence_tier: "Supported", score: 0.87 },
    { level: 3, confidence_tier: "Indicative", score: 0.76 },
    { level: 1, confidence_tier: "Supported", score: 0.82 },
    { level: 2, confidence_tier: "Supported", score: 0.79 },
  ],
  cpc_portfolio_comparison: [
    { bu: "Future Mobility", l1: 12, l2: 22, l3: 8, projects: 31 },
    { bu: "Digital Infrastructure", l1: 9, l2: 15, l3: 4, projects: 18 },
    { bu: "Places & Growth", l1: 6, l2: 7, l3: 1, projects: 11 },
    { bu: "Active Travel", l1: 5, l2: 3, l3: 0, projects: 7 },
    { bu: "Rural Connectivity", l1: 4, l2: 0, l3: 0, projects: 4 },
  ],
  cpc_market_alignment: [
    { score: 0.91, fit_pct: 91, source_type: "live_call" },
    { score: 0.84, fit_pct: 84, source_type: "live_call" },
    { score: 0.76, fit_pct: 76, source_type: "live_call" },
    { level: 2, confidence_tier: "Supported" },
    { level: 2, confidence_tier: "Robust" },
  ],
  cpc_evidence_gaps: [
    { area: "Rural Connectivity", severity: "high" },
    { area: "Active Travel", severity: "high" },
    { area: "Freight", severity: "high" },
    { area: "Places & Growth", severity: "medium" },
    { level: 1, confidence_tier: "Robust" },
  ],
  cpc_opportunity_fit: [
    { score: 0.91, fit_pct: 91, evidence_strength: 4 },
    { score: 0.84, fit_pct: 84, evidence_strength: 2 },
    { score: 0.71, fit_pct: 71, evidence_strength: 5 },
  ],
  cpc_funding_flow: [
    { source: "UKRI", target: "Future Mobility", value: 8 },
    { source: "Innovate UK", target: "Future Mobility", value: 5 },
    { source: "DfT", target: "Places & Growth", value: 3 },
    { source: "Future Mobility", target: "L2 Programme", value: 12 },
    { source: "Future Mobility", target: "L3 Strategic", value: 6 },
  ],
};

// ── Intent badge styles ────────────────────────────────────────────────────────

const INTENT_COLORS: Record<AnalyticalIntent, string> = {
  overlap_intersection: "bg-purple-50 text-purple-700 border-purple-200",
  comparison_ranking: "bg-slate-50 text-slate-700 border-slate-200",
  evidence_coverage: "bg-red-50 text-red-700 border-red-200",
  readiness_maturity: "bg-green-50 text-green-700 border-green-200",
  flow_pathway: "bg-blue-50 text-blue-700 border-blue-200",
  trade_off_quadrant: "bg-amber-50 text-amber-700 border-amber-200",
  timeline_change: "bg-cyan-50 text-cyan-700 border-cyan-200",
  portfolio_audit: "bg-indigo-50 text-indigo-700 border-indigo-200",
  market_alignment: "bg-emerald-50 text-emerald-700 border-emerald-200",
  evidence_quality: "bg-pink-50 text-pink-700 border-pink-200",
  unknown: "bg-muted text-muted-foreground border-border",
};

const INTENT_LABELS: Record<AnalyticalIntent, string> = {
  overlap_intersection: "Overlap / Intersection",
  comparison_ranking: "Comparison / Ranking",
  evidence_coverage: "Evidence Coverage",
  readiness_maturity: "Readiness / Maturity",
  flow_pathway: "Flow / Pathway",
  trade_off_quadrant: "Trade-off / Quadrant",
  timeline_change: "Timeline / Change",
  portfolio_audit: "Portfolio Audit",
  market_alignment: "Market Alignment",
  evidence_quality: "Evidence Quality",
  unknown: "Unknown / General",
};

const FAMILY_LABELS: Record<VisualFamily, string> = {
  venn: "Venn diagram",
  heatmap: "Heatmap",
  radar: "Radar / spider",
  gauge: "Gauge",
  scatter: "Scatter / quadrant",
  sankey: "Sankey flow",
  bar: "Bar chart",
  "stacked-bar": "Stacked bar",
  pie: "Pie / donut",
  "radial-bar": "Radial bar",
  line: "Line chart",
  area: "Area chart",
  graph: "Knowledge graph",
  table: "Data table",
  cards: "Evidence cards",
};

// ── Selection card ────────────────────────────────────────────────────────────

function SelectionCard({
  selection,
  recipeContext,
}: {
  selection: VisualSelection;
  recipeContext: RecipeContext;
}) {
  return (
    <div className="space-y-4">
      {/* Intent + primary */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Detected intent
          </p>
          <span
            className={cn(
              "text-xs font-semibold px-2 py-1 rounded border",
              INTENT_COLORS[selection.intent],
            )}
          >
            {INTENT_LABELS[selection.intent]}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Primary visual
          </p>
          <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded">
            ▶ {FAMILY_LABELS[selection.primaryFamily]}
          </span>
        </div>

        {selection.supportingFamilies.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Supporting
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {selection.supportingFamilies.map((f) => (
                <span
                  key={f}
                  className="text-xs text-muted-foreground bg-muted border border-border px-2 py-1 rounded"
                >
                  + {FAMILY_LABELS[f]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fallback
          </p>
          <span className="text-xs text-muted-foreground/60 bg-muted/40 border border-border px-2 py-1 rounded">
            {FAMILY_LABELS[selection.fallbackFamily]}
          </span>
        </div>
      </div>

      {/* Rationale */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rationale
        </p>
        <p className="text-xs text-foreground/80 leading-relaxed">{selection.rationale}</p>
      </div>

      {/* Interpretation */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Chart interpretation question
        </p>
        <p className="text-sm font-medium text-foreground italic">&ldquo;{selection.interpretation}&rdquo;</p>
      </div>

      {/* Caveats */}
      {selection.caveats.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Caveats</p>
          {selection.caveats.map((c, i) => (
            <p key={i} className="text-xs text-amber-800 leading-snug">⚠ {c}</p>
          ))}
        </div>
      )}

      {/* Rejected visuals */}
      {selection.rejected.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rejected
          </p>
          <div className="space-y-1">
            {selection.rejected.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="font-mono line-through opacity-50">{FAMILY_LABELS[r.family]}</span>
                <span>— {r.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allowed families for this recipe */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recipe allowed families ({recipeContext.recipeId})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {recipeContext.allowedFamilies.map((f) => (
            <span
              key={f}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border",
                f === selection.primaryFamily
                  ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                  : "bg-muted text-muted-foreground border-border",
              )}
            >
              {FAMILY_LABELS[f]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Quadrant demo ─────────────────────────────────────────────────────────────

function QuadrantDemo() {
  const examples = [
    { title: "UKRI Smart Mobility", fitPct: 91, strength: 4 },
    { title: "Innovate UK Connected Places", fitPct: 84, strength: 2 },
    { title: "DfT Future of Freight", fitPct: 71, strength: 5 },
    { title: "Active Travel England Round 3", fitPct: 62, strength: 1 },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quadrant action classifier (trade_off_quadrant → scatter)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {examples.map((ex) => {
          const action = classifyQuadrant(ex.fitPct, ex.strength);
          const config = QUADRANT_CONFIG[action];
          return (
            <div
              key={ex.title}
              className={cn(
                "rounded-lg border p-2.5 space-y-1",
                config.bgCls,
                config.borderCls,
              )}
            >
              <p className={cn("text-xs font-medium", config.textCls)}>{ex.title}</p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className={config.textCls}>Fit: {ex.fitPct}%</span>
                <span className={config.textCls}>Evidence: {ex.strength}</span>
                <span className={cn("font-semibold ml-auto", config.textCls)}>{config.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Thresholds: fit ≥ 75% = high fit · evidence ≥ 3 L2/L3 claims = strong evidence
      </p>
    </div>
  );
}

// ── Grammar reference table ───────────────────────────────────────────────────

const GRAMMAR_ROWS = [
  { question: "Where do these areas overlap?", intent: "overlap_intersection" as AnalyticalIntent, primary: "venn" as VisualFamily, condition: "if sets[] data available" },
  { question: "How bid-ready is this?", intent: "readiness_maturity" as AnalyticalIntent, primary: "radar" as VisualFamily, condition: "if ≥ 3 records" },
  { question: "Where is evidence thin?", intent: "evidence_coverage" as AnalyticalIntent, primary: "heatmap" as VisualFamily, condition: "if 2D data available" },
  { question: "High fit but weak evidence?", intent: "trade_off_quadrant" as AnalyticalIntent, primary: "scatter" as VisualFamily, condition: "if 2 score fields" },
  { question: "Where does funding flow?", intent: "flow_pathway" as AnalyticalIntent, primary: "sankey" as VisualFamily, condition: "if ≥ 3 flow records" },
  { question: "Which calls match CPC?", intent: "market_alignment" as AnalyticalIntent, primary: "radial-bar" as VisualFamily, condition: "if ≥ 3 calls" },
  { question: "How reliable is evidence?", intent: "evidence_quality" as AnalyticalIntent, primary: "pie" as VisualFamily, condition: "if ≥ 2 tiers" },
  { question: "Compare all BUs", intent: "portfolio_audit" as AnalyticalIntent, primary: "stacked-bar" as VisualFamily, condition: "default" },
  { question: "How has this changed?", intent: "timeline_change" as AnalyticalIntent, primary: "line" as VisualFamily, condition: "if time field present" },
  { question: "Which is highest?", intent: "comparison_ranking" as AnalyticalIntent, primary: "bar" as VisualFamily, condition: "default" },
];

function GrammarTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs min-w-[540px]">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-muted-foreground">
            <th className="py-2 pl-3 pr-2 text-left font-semibold">Question pattern</th>
            <th className="py-2 px-2 text-left font-semibold">Intent</th>
            <th className="py-2 px-2 text-left font-semibold">Primary visual</th>
            <th className="py-2 pr-3 pl-2 text-left font-semibold">Condition</th>
          </tr>
        </thead>
        <tbody>
          {GRAMMAR_ROWS.map((row, i) => (
            <tr
              key={i}
              className={cn("text-xs", i < GRAMMAR_ROWS.length - 1 && "border-b border-border")}
            >
              <td className="py-2 pl-3 pr-2 text-foreground/80 italic">&ldquo;{row.question}&rdquo;</td>
              <td className="py-2 px-2">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                    INTENT_COLORS[row.intent],
                  )}
                >
                  {INTENT_LABELS[row.intent]}
                </span>
              </td>
              <td className="py-2 px-2 font-medium text-foreground/80">
                {FAMILY_LABELS[row.primary]}
              </td>
              <td className="py-2 pr-3 pl-2 text-muted-foreground">{row.condition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VisualDirectorSection() {
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0].query);
  const [selectedRecipe, setSelectedRecipe] = useState(EXAMPLE_QUERIES[0].recipeId);

  const result = useMemo((): { intent: AnalyticalIntent; selection: VisualSelection } | null => {
    if (!query.trim()) return null;
    const context = RECIPE_CONTEXTS[selectedRecipe];
    if (!context) return null;
    const exampleData = EXAMPLE_DATA[selectedRecipe] ?? [];
    const intent = classifyIntent(query);
    const dataShape = inspectData(exampleData);
    const selection = selectVisuals(intent, dataShape, context);
    return { intent, selection };
  }, [query, selectedRecipe]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Atlas Visual Recipe Director</h2>
        <p className="text-xs text-muted-foreground">
          Enter a query to see how the director classifies intent, inspects data shape, and selects
          the right visual — with rationale and rejected alternatives.
          This is the canonical grammar the Python agent mirrors when populating{" "}
          <code className="font-mono text-[11px]">artifact_block.chart_specs</code>.
        </p>
      </div>

      {/* Query input */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a query…"
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={selectedRecipe}
            onChange={(e) => setSelectedRecipe(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.keys(RECIPE_CONTEXTS).map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setQuery(ex.query);
                setSelectedRecipe(ex.recipeId);
              }}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium border transition-colors",
                query === ex.query && selectedRecipe === ex.recipeId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
              )}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Director output */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-4">
          <SelectionCard
            selection={result.selection}
            recipeContext={RECIPE_CONTEXTS[selectedRecipe]}
          />
        </div>
      )}

      {/* Quadrant demo */}
      <div className="rounded-xl border border-border bg-card p-4">
        <QuadrantDemo />
      </div>

      {/* Visual grammar reference */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Visual grammar reference</h3>
          <p className="text-xs text-muted-foreground">
            The full decision table. The director matches query patterns to intent, then selects the
            primary visual subject to data shape constraints and recipe allowed families.
          </p>
        </div>
        <GrammarTable />
      </div>
    </div>
  );
}
