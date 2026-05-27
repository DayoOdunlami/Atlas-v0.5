"use client";

import { cn } from "@/lib/utils";
import type { Chart, ConfidenceTier, CpcGap, RecommendationAction } from "@/lib/types";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import type { AnalyticalIntent, VisualFamily, VisualSelection } from "@/lib/atlas/visual-recipe-director";

// ── Confidence tier badge ─────────────────────────────────────────────────────

export const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative: "bg-amber-50 text-amber-700 border-amber-200",
  Supported: "bg-blue-50 text-blue-700 border-blue-200",
  Robust: "bg-green-50 text-green-700 border-green-200",
};

export function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
        TIER_BADGE[tier],
      )}
    >
      {tier}
    </span>
  );
}

// ── Compact metric pill ───────────────────────────────────────────────────────

export function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-muted/40 min-w-[60px]">
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
        {label}
      </span>
    </div>
  );
}

// ── Recommendation action banner ──────────────────────────────────────────────

const ACTION_CONFIG: Record<
  RecommendationAction,
  { label: string; cls: string }
> = {
  bid: {
    label: "Recommended action: BID",
    cls: "bg-green-50 border-green-200 text-green-800",
  },
  partner: {
    label: "Recommended action: PARTNER",
    cls: "bg-blue-50 border-blue-200 text-blue-800",
  },
  monitor: {
    label: "Recommended action: MONITOR",
    cls: "bg-amber-50 border-amber-200 text-amber-800",
  },
  reject: {
    label: "Recommended action: REJECT",
    cls: "bg-red-50 border-red-200 text-red-800",
  },
};

export function RecommendationBanner({
  action,
  rationale,
}: {
  action: RecommendationAction;
  rationale?: string;
}) {
  const config = ACTION_CONFIG[action];
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 space-y-0.5", config.cls)}>
      <p className="text-xs font-semibold tracking-wide">{config.label}</p>
      {rationale && (
        <p className="text-xs leading-snug opacity-90">{rationale}</p>
      )}
    </div>
  );
}

// ── Gap / caveat panel ────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  CpcGap["severity"],
  { label: string; cls: string; dotCls: string }
> = {
  low: {
    label: "LOW",
    cls: "text-muted-foreground bg-muted",
    dotCls: "bg-muted-foreground",
  },
  medium: {
    label: "MED",
    cls: "text-amber-700 bg-amber-50",
    dotCls: "bg-amber-500",
  },
  high: {
    label: "HIGH",
    cls: "text-red-700 bg-red-50",
    dotCls: "bg-red-500",
  },
};

const SEVERITY_ORDER: Record<CpcGap["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// ── "What this does not prove" caveat panel ──────────────────────────────────
// Explicitly bounds what conclusions the corpus evidence supports.
// Reduces the risk of over-claiming in funding bids or internal reviews.
// Each CPC recipe passes its own caveats; defaults cover the shared corpus limits.

const DEFAULT_CPC_CAVEATS = [
  "Team productivity or FTE performance — no resource data exists in the corpus",
  "Project-level commercial outcomes where no independently validated evidence is present",
  "L3 strategic positioning unless explicitly evidenced at Supported tier or above",
  "Comparisons with other organisations — this corpus is CPC-internal only",
];

export function WhatThisDoesNotProve({
  caveats = DEFAULT_CPC_CAVEATS,
  extra,
}: {
  /** Override the default caveats entirely */
  caveats?: string[];
  /** Append extra recipe-specific caveats to the defaults */
  extra?: string[];
}) {
  const all = [...caveats, ...(extra ?? [])];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        What this does not prove
      </p>
      <ul className="space-y-1">
        {all.map((caveat, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800 leading-snug">
            <span className="shrink-0 font-bold text-amber-400 mt-px">✕</span>
            {caveat}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Agent-injected chart_specs passthrough ────────────────────────────────────
// Any chart_specs on the artifact are rendered here after the recipe's own charts.
// This lets the Python agent emit supplementary gauge/radar/heatmap/graph visuals
// without the recipe needing to know about them at build-time.

export function ChartSpecsPassthrough({ chartSpecs }: { chartSpecs?: Chart[] }) {
  if (!chartSpecs || chartSpecs.length === 0) return null;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Agent-Generated Charts
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {chartSpecs.map((chart, i) => (
          <div key={i} className="space-y-1">
            {chart.title && (
              <p className="text-xs font-medium text-foreground/80">{chart.title}</p>
            )}
            <ChartRenderer spec={chart} data={chart.data} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visual Recipe Director rationale panel ───────────────────────────────────
// Renders the director's selection reasoning inline in a recipe.
// Compact by default — shows intent + primary + supporting families.
// Rejected visuals are shown in a collapsed detail line.

const INTENT_LABEL: Record<AnalyticalIntent, string> = {
  overlap_intersection: "Overlap / intersection",
  comparison_ranking: "Comparison / ranking",
  evidence_coverage: "Evidence coverage",
  readiness_maturity: "Readiness / maturity",
  flow_pathway: "Flow / pathway",
  trade_off_quadrant: "Trade-off / quadrant",
  timeline_change: "Timeline / change",
  portfolio_audit: "Portfolio audit",
  market_alignment: "Market alignment",
  evidence_quality: "Evidence quality",
  unknown: "General query",
};

const FAMILY_LABEL: Record<VisualFamily, string> = {
  venn: "Venn",
  heatmap: "Heatmap",
  radar: "Radar",
  gauge: "Gauge",
  scatter: "Scatter",
  sankey: "Sankey",
  bar: "Bar",
  "stacked-bar": "Stacked bar",
  pie: "Pie",
  "radial-bar": "Radial bar",
  line: "Line",
  area: "Area",
  graph: "Graph",
  table: "Table",
  cards: "Cards",
};

export function DirectorRationalePanel({ selection }: { selection: VisualSelection }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Visual Director
        </span>
        {/* Intent badge */}
        <span className="text-[10px] font-medium bg-background border border-border text-foreground/80 px-1.5 py-0.5 rounded">
          {INTENT_LABEL[selection.intent]}
        </span>
        {/* Primary visual */}
        <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
          ▶ {FAMILY_LABEL[selection.primaryFamily]}
        </span>
        {/* Supporting visuals */}
        {selection.supportingFamilies.map((f) => (
          <span
            key={f}
            className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded"
          >
            + {FAMILY_LABEL[f]}
          </span>
        ))}
      </div>
      {/* Rationale */}
      <p className="text-[10px] text-muted-foreground leading-snug">{selection.rationale}</p>
      {/* Caveats */}
      {selection.caveats.length > 0 && (
        <ul className="space-y-0.5">
          {selection.caveats.map((c, i) => (
            <li key={i} className="text-[10px] text-amber-700 leading-snug">
              ⚠ {c}
            </li>
          ))}
        </ul>
      )}
      {/* Rejected (collapsed to single line) */}
      {selection.rejected.length > 0 && (
        <p className="text-[10px] text-muted-foreground/50 leading-snug">
          Rejected:{" "}
          {selection.rejected
            .map((r) => `${FAMILY_LABEL[r.family]} (${r.reason})`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

// ── Gap / caveat panel ────────────────────────────────────────────────────────

export function GapCaveatPanel({ gaps }: { gaps: CpcGap[] }) {
  if (gaps.length === 0) return null;
  const sorted = [...gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Gaps &amp; Caveats
      </p>
      {sorted.map((gap, i) => {
        const s = SEVERITY_STYLE[gap.severity];
        return (
          <div
            key={i}
            className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-px",
                    s.dotCls,
                  )}
                />
                <p className="text-xs font-medium leading-snug">{gap.area}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  s.cls,
                )}
              >
                {s.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug pl-3">
              {gap.description}
            </p>
            {(gap.project_count !== undefined ||
              gap.claim_count !== undefined) && (
              <div className="flex gap-3 text-[10px] text-muted-foreground/60 pl-3">
                {gap.project_count !== undefined && (
                  <span>
                    {gap.project_count} project
                    {gap.project_count !== 1 ? "s" : ""}
                  </span>
                )}
                {gap.claim_count !== undefined && (
                  <span>
                    {gap.claim_count} claim
                    {gap.claim_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
