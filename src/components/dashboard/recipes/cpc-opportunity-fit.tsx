"use client";

/**
 * CPC Opportunity Fit Recipe
 *
 * Scatter/quadrant chart: X = corpus fit score (semantic similarity to live call),
 * Y = evidence strength (L2/L3 verified claims available to support a bid).
 *
 * Quadrant actions:
 *   High fit + Strong evidence → Bid now
 *   High fit + Weak evidence   → Enrich evidence first
 *   Low fit + Strong evidence  → Reposition / monitor
 *   Low fit + Weak evidence    → Pass
 *
 * The Visual Recipe Director selects scatter as primary for trade_off_quadrant intent.
 */

import { useMemo } from "react";
import type { ArtifactBlock, CorpusCitation } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  ChartSpecsPassthrough,
  ConfidenceBadge,
  MetricPill,
  RecommendationBanner,
  WhatThisDoesNotProve,
} from "./cpc-shared";
import {
  classifyQuadrant,
  QUADRANT_CONFIG,
  type QuadrantAction,
} from "@/lib/atlas/visual-recipe-director";

// ── Custom scatter dot ────────────────────────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}

function QuadrantDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  const config = QUADRANT_CONFIG[payload.action];
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={config.color}
      fillOpacity={0.8}
      stroke={config.color}
      strokeWidth={1.5}
    />
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}

function QuadrantTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const config = QUADRANT_CONFIG[point.action];
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 shadow-md space-y-1 text-xs max-w-[220px]">
      <p className="font-medium leading-snug">{point.title}</p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Fit:</span>
        <span className="font-mono font-semibold">{point.fit_pct}%</span>
        <span className="text-muted-foreground ml-2">Evidence:</span>
        <span className="font-mono font-semibold">{point.evidence_strength}</span>
      </div>
      <span
        className={cn(
          "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border",
          config.textCls,
          config.bgCls,
          config.borderCls,
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

// ── Scatter point type ────────────────────────────────────────────────────────

interface ScatterPoint {
  title: string;
  funder: string;
  fit_pct: number;
  evidence_strength: number;
  action: QuadrantAction;
}

// ── Quadrant summary cards ────────────────────────────────────────────────────

function QuadrantSummary({ points }: { points: ScatterPoint[] }) {
  const byAction = useMemo(() => {
    const groups: Partial<Record<QuadrantAction, ScatterPoint[]>> = {};
    for (const p of points) {
      (groups[p.action] ??= []).push(p);
    }
    return groups;
  }, [points]);

  const order: QuadrantAction[] = ["bid_now", "enrich_first", "reposition", "pass"];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {order.map((action) => {
        const config = QUADRANT_CONFIG[action];
        const items = byAction[action] ?? [];
        return (
          <div
            key={action}
            className={cn(
              "rounded-lg border p-2.5 space-y-1.5",
              config.bgCls,
              config.borderCls,
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.textCls)}>
              {config.label}
            </span>
            <p className={cn("text-xl font-bold tabular-nums", config.textCls)}>{items.length}</p>
            {items.slice(0, 2).map((p, i) => (
              <p key={i} className={cn("text-[10px] leading-tight", config.textCls)}>
                {p.title.length > 28 ? p.title.slice(0, 28) + "…" : p.title}
              </p>
            ))}
            {items.length > 2 && (
              <p className={cn("text-[10px] opacity-60", config.textCls)}>
                +{items.length - 2} more
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function CpcOpportunityFitRecipe({ artifact }: Props) {
  const liveCalls = (artifact.corpus_citations ?? []).filter(
    (c) => c.source_type === "live_call",
  );
  const claims = artifact.cpc_claims ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Evidence strength: L2/L3 claim count (the agent would compute per-call;
  // here we use total L2/L3 as the proxy for all calls in the same corpus.
  const l2l3Count = claims.filter((c) => c.level >= 2).length;

  // Build scatter points
  const scatterPoints: ScatterPoint[] = useMemo(
    () =>
      liveCalls.map((c) => {
        const fitPct = Math.round((c.score ?? 0) * 100);
        // Agent-provided per-call evidence_strength takes priority; fall back to corpus aggregate
        const evidenceStrength =
          typeof (c as CorpusCitation & { evidence_strength?: number }).evidence_strength ===
          "number"
            ? (c as unknown as { evidence_strength: number }).evidence_strength
            : l2l3Count;
        return {
          title: c.title,
          funder: c.funder ?? "",
          fit_pct: fitPct,
          evidence_strength: evidenceStrength,
          action: classifyQuadrant(fitPct, evidenceStrength),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveCalls, l2l3Count],
  );

  const bidNowCount = scatterPoints.filter((p) => p.action === "bid_now").length;
  const enrichCount = scatterPoints.filter((p) => p.action === "enrich_first").length;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CPC Opportunity Fit
        </span>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      <div className="p-4 space-y-5">
        {/* Summary */}
        {summary && (
          <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
        )}

        {/* Recommendation */}
        {artifact.recommendation_action && (
          <RecommendationBanner
            action={artifact.recommendation_action}
            rationale={artifact.recommendation_rationale}
          />
        )}

        {/* Metrics */}
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Live Calls" value={liveCalls.length} />
          <MetricPill label="L2/L3 Claims" value={l2l3Count} />
          {bidNowCount > 0 && (
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-green-50 border border-green-200 min-w-[60px]">
              <span className="text-sm font-bold text-green-700 tabular-nums">{bidNowCount}</span>
              <span className="text-[10px] text-green-600 text-center leading-tight mt-0.5">
                Bid-ready
              </span>
            </div>
          )}
          {enrichCount > 0 && (
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 min-w-[60px]">
              <span className="text-sm font-bold text-amber-700 tabular-nums">{enrichCount}</span>
              <span className="text-[10px] text-amber-600 text-center leading-tight mt-0.5">
                Needs enrichment
              </span>
            </div>
          )}
        </div>

        {/* Scatter / quadrant chart */}
        {scatterPoints.length >= 2 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Which calls are worth bidding — and which need evidence work first?
            </h3>
            <p className="text-xs text-muted-foreground">
              X axis = corpus fit score (how well CPC evidence matches the call).
              Y axis = available L2/L3 claims.
              <span className="text-green-700 font-medium"> Top-right = bid-ready.</span>{" "}
              Top-left = evidence enrichment needed.
            </p>
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="fit_pct"
                    type="number"
                    domain={[0, 100]}
                    name="Fit score"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    label={{ value: "Fit score (%)", position: "insideBottom", offset: -12, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <YAxis
                    dataKey="evidence_strength"
                    type="number"
                    name="Evidence strength"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    label={{ value: "L2/L3 claims", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  {/* Quadrant reference lines */}
                  <ReferenceLine x={75} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={3} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Tooltip content={<QuadrantTooltip />} />
                  <Scatter
                    data={scatterPoints}
                    shape={(props: DotProps) => <QuadrantDot {...props} />}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Quadrant labels overlay hint */}
            <div className="grid grid-cols-2 text-[10px] text-muted-foreground/60 gap-0 w-full px-8">
              <span className="text-right pr-2">◀ Low fit</span>
              <span className="pl-2">High fit ▶</span>
            </div>
          </div>
        ) : scatterPoints.length === 1 ? (
          /* Single call — show as a card instead */
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opportunity Assessment
            </h3>
            {scatterPoints.map((p) => {
              const config = QUADRANT_CONFIG[p.action];
              return (
                <div
                  key={p.title}
                  className={cn(
                    "rounded-lg border p-3 space-y-1.5",
                    config.bgCls,
                    config.borderCls,
                  )}
                >
                  <p className={cn("text-sm font-medium", config.textCls)}>{p.title}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={config.textCls}>Fit: {p.fit_pct}%</span>
                    <span className={config.textCls}>Evidence: {p.evidence_strength} claims</span>
                    <span className={cn("font-semibold", config.textCls)}>{config.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Quadrant summary */}
        {scatterPoints.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Action breakdown by quadrant
            </h3>
            <QuadrantSummary points={scatterPoints} />
          </div>
        )}

        {/* Call detail list */}
        {liveCalls.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live calls assessed
            </h3>
            <div className="space-y-2">
              {liveCalls.map((c, i) => {
                const point = scatterPoints[i];
                if (!point) return null;
                const config = QUADRANT_CONFIG[point.action];
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-card p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
                        {c.title}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                          config.textCls,
                          config.bgCls,
                          config.borderCls,
                        )}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.funder ?? ""}</span>
                      <div className="flex items-center gap-3">
                        {c.deadline && (
                          <span className="text-amber-700">Closes {c.deadline}</span>
                        )}
                        <span className="font-mono">Fit: {point.fit_pct}%</span>
                        <span className="font-mono">Evidence: {point.evidence_strength}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* What this does not prove */}
        <WhatThisDoesNotProve
          extra={[
            "That fit score reflects funder priorities — it is based on corpus semantic similarity only",
            "That evidence strength counts are complete — only ingested and extracted claims are counted",
            "That the highest-scoring calls are strategically appropriate — portfolio fit requires human review",
          ]}
        />

        {/* Agent-injected supplementary charts */}
        <ChartSpecsPassthrough chartSpecs={artifact.chart_specs} />

        {liveCalls.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No live funding calls available. Ask the agent to search live calls and
            match against the CPC corpus.
          </p>
        )}
      </div>
    </div>
  );
}
