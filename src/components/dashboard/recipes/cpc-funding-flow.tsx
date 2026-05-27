"use client";

/**
 * CPC Funding Flow Recipe
 *
 * Sankey diagram: funder → CPC business unit → evidence level
 *
 * Shows how funding themes and opportunities connect to CPC's portfolio and
 * what level of evidence backs each pathway. Agent populates chart_specs with
 * a pre-computed Sankey; recipe derives a fallback from corpus_citations +
 * cpc_portfolio if chart_specs is absent.
 *
 * The Visual Recipe Director selects Sankey as primary for flow_pathway intent.
 */

import { useMemo } from "react";
import type { ArtifactBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import {
  ChartSpecsPassthrough,
  ConfidenceBadge,
  GapCaveatPanel,
  MetricPill,
  WhatThisDoesNotProve,
} from "./cpc-shared";

// ── Flow data derivation ──────────────────────────────────────────────────────

interface FlowRow {
  source: string;
  target: string;
  value: number;
}

function deriveFlowData(artifact: ArtifactBlock): FlowRow[] {
  const liveCalls = (artifact.corpus_citations ?? []).filter(
    (c) => c.source_type === "live_call",
  );
  const portfolio = artifact.cpc_portfolio ?? [];

  if (portfolio.length === 0) return [];

  const rows: FlowRow[] = [];

  // Layer 1: funder → BU (proxy via score distribution)
  // If no live calls, derive from portfolio totals
  if (liveCalls.length > 0) {
    // Group funders and spread to BUs proportionally by BU project count
    const funders = Array.from(
      new Set(liveCalls.map((c) => c.funder ?? "Unknown funder").filter(Boolean)),
    );
    const totalProjects = portfolio.reduce((s, b) => s + b.project_count, 0);
    if (totalProjects > 0) {
      for (const funder of funders.slice(0, 5)) {
        const callsForFunder = liveCalls.filter((c) => (c.funder ?? "Unknown funder") === funder);
        const funderWeight = callsForFunder.length;
        for (const bu of portfolio.slice(0, 6)) {
          const buShare = Math.round((bu.project_count / totalProjects) * funderWeight * 3);
          if (buShare > 0) rows.push({ source: funder, target: bu.name, value: buShare });
        }
      }
    }
  } else {
    // No live calls: use portfolio totals with a generic "CPC Funding" source
    for (const bu of portfolio.slice(0, 6)) {
      if (bu.project_count > 0) {
        rows.push({ source: "CPC Portfolio", target: bu.name, value: bu.project_count });
      }
    }
  }

  // Layer 2: BU → evidence level
  for (const bu of portfolio.slice(0, 6)) {
    if (bu.l3_claims > 0) rows.push({ source: bu.name, target: "L3 Strategic", value: bu.l3_claims });
    if (bu.l2_claims > 0) rows.push({ source: bu.name, target: "L2 Programme", value: bu.l2_claims });
    if (bu.l1_claims > 0) rows.push({ source: bu.name, target: "L1 Delivery", value: bu.l1_claims });
  }

  return rows.filter((r) => r.value > 0);
}

// ── Flow path summary table ───────────────────────────────────────────────────

function FlowSummaryTable({ rows }: { rows: FlowRow[] }) {
  const topFlows = rows
    .filter((r) => !["L1 Delivery", "L2 Programme", "L3 Strategic"].includes(r.source))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (topFlows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs min-w-[360px]">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-muted-foreground">
            <th className="py-2 pl-3 pr-2 text-left font-semibold">Source</th>
            <th className="py-2 px-2 text-left font-semibold">→ Target</th>
            <th className="py-2 pr-3 pl-2 text-right font-semibold">Weight</th>
          </tr>
        </thead>
        <tbody>
          {topFlows.map((row, i) => (
            <tr
              key={i}
              className={cn("text-xs", i < topFlows.length - 1 && "border-b border-border")}
            >
              <td className="py-2 pl-3 pr-2 font-medium text-foreground/90 truncate max-w-[120px]">
                {row.source}
              </td>
              <td className="py-2 px-2 text-muted-foreground truncate max-w-[120px]">
                {row.target}
              </td>
              <td className="py-2 pr-3 pl-2 text-right tabular-nums font-mono text-muted-foreground">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Evidence level legend ─────────────────────────────────────────────────────

const LEVEL_STYLE = {
  "L3 Strategic": { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "L2 Programme": { cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "L1 Delivery": { cls: "bg-slate-50 text-slate-700 border-slate-200" },
} as const;

function EvidenceLevelLegend({ rows }: { rows: FlowRow[] }) {
  const levels = Object.keys(LEVEL_STYLE) as Array<keyof typeof LEVEL_STYLE>;
  const totals: Record<string, number> = {};
  for (const level of levels) {
    totals[level] = rows
      .filter((r) => r.target === level)
      .reduce((s, r) => s + r.value, 0);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((level) => {
        const style = LEVEL_STYLE[level];
        const count = totals[level] ?? 0;
        return (
          <div
            key={level}
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border",
              style.cls,
            )}
          >
            {level}
            <span className="font-mono tabular-nums">({count})</span>
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

export function CpcFundingFlowRecipe({ artifact }: Props) {
  const portfolio = artifact.cpc_portfolio ?? [];
  const gaps = artifact.cpc_gaps ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Prefer agent-provided Sankey chart_spec; fall back to derived flow data
  const agentSankey = (artifact.chart_specs ?? []).find((s) => s.type === "sankey");
  const derivedRows = useMemo(() => deriveFlowData(artifact), [artifact]);

  const flowData = agentSankey ? (agentSankey.data ?? []) : derivedRows;
  const hasSankeyData = flowData.length >= 3;

  // Metrics
  const totalL3 = portfolio.reduce((s, b) => s + b.l3_claims, 0);
  const totalL2 = portfolio.reduce((s, b) => s + b.l2_claims, 0);
  const totalL1 = portfolio.reduce((s, b) => s + b.l1_claims, 0);
  const liveCalls = (artifact.corpus_citations ?? []).filter(
    (c) => c.source_type === "live_call",
  );

  // Supplementary chart_specs excluding the main Sankey (rendered separately)
  const supplementarySpecs = (artifact.chart_specs ?? []).filter((s) => s.type !== "sankey");

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CPC Funding Flow
        </span>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      <div className="p-4 space-y-5">
        {/* Summary */}
        {summary && (
          <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
        )}

        {/* Metrics */}
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Business Units" value={portfolio.length} />
          {liveCalls.length > 0 && (
            <MetricPill label="Live Calls" value={liveCalls.length} />
          )}
          <MetricPill label="L3 Strategic" value={totalL3} />
          <MetricPill label="L2 Programme" value={totalL2} />
          <MetricPill label="L1 Delivery" value={totalL1} />
        </div>

        {/* Sankey flow chart */}
        {hasSankeyData ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How does funding connect to CPC capability evidence?
            </h3>
            <p className="text-xs text-muted-foreground">
              Left = funding sources or CPC portfolio.
              Middle = CPC business units.
              Right = evidence level reached.
              Flow width = relative strength (project or claim count).
              {agentSankey
                ? " Agent-computed flow."
                : " Derived from corpus citations and portfolio data — approximate."}
            </p>
            <ChartRenderer
              spec={{
                type: "sankey",
                title: "CPC Funding Flow",
                source: "source",
                target: "target",
                value: "value",
              }}
              data={flowData as Array<Record<string, string | number>>}
            />
            <EvidenceLevelLegend rows={agentSankey ? [] : (derivedRows as FlowRow[])} />
          </div>
        ) : portfolio.length > 0 ? (
          /* Fallback: bar chart of evidence by BU */
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence level distribution by business unit
            </h3>
            <p className="text-xs text-muted-foreground">
              Sankey requires at least 3 flow records. Showing evidence breakdown instead.
            </p>
            <ChartRenderer
              spec={{
                type: "stacked-bar",
                title: "Evidence by BU",
                x: "bu",
                y: "count",
                series: "level",
              }}
              data={portfolio.flatMap((bu) => [
                { bu: bu.name, level: "L1", count: bu.l1_claims },
                { bu: bu.name, level: "L2", count: bu.l2_claims },
                { bu: bu.name, level: "L3", count: bu.l3_claims },
              ])}
            />
          </div>
        ) : null}

        {/* Flow summary table */}
        {!agentSankey && derivedRows.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Strongest flow pathways
            </h3>
            <FlowSummaryTable rows={derivedRows as FlowRow[]} />
            <p className="text-[10px] text-muted-foreground">
              Derived from portfolio project counts and call alignment scores — not validated
              funder-to-unit mapping.
            </p>
          </div>
        )}

        {/* BU evidence summary */}
        {portfolio.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where does the evidence pyramid terminate per unit?
            </h3>
            <p className="text-xs text-muted-foreground">
              L3 = strategic outcome. L2 = programme. L1 = delivery only.
              Units stuck at L1 cannot support a strategic investment case.
            </p>
            <div className="space-y-1.5">
              {[...portfolio]
                .sort((a, b) => b.l3_claims - a.l3_claims)
                .map((bu) => {
                  const top =
                    bu.l3_claims > 0 ? "L3" : bu.l2_claims > 0 ? "L2" : "L1";
                  const topStyle =
                    top === "L3"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : top === "L2"
                      ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                      : "text-slate-600 bg-slate-50 border-slate-200";
                  return (
                    <div
                      key={bu.name}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/10 border border-border"
                    >
                      <span className="text-xs font-medium flex-1">{bu.name}</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                          topStyle,
                        )}
                      >
                        {top}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {bu.l3_claims}/{bu.l2_claims}/{bu.l1_claims}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <div className="border-t border-border pt-4">
            <GapCaveatPanel gaps={gaps} />
          </div>
        )}

        {/* What this does not prove */}
        <WhatThisDoesNotProve
          extra={[
            "Actual funding allocated or received — flow weights are based on project counts and similarity scores",
            "Funder-to-unit mapping accuracy — derived flows are approximate without explicit funder tagging in the corpus",
            "That strategic (L3) claims meet specific funder eligibility criteria — each claim requires individual review",
          ]}
        />

        {/* Supplementary agent charts (excluding the Sankey already rendered) */}
        <ChartSpecsPassthrough chartSpecs={supplementarySpecs} />

        {portfolio.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No portfolio or citation data available. Ask the agent to run a
            portfolio analysis and match against live funding calls.
          </p>
        )}
      </div>
    </div>
  );
}
