"use client";

import type { ArtifactBlock, CpcBusinessUnit, CpcGap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import { ChartSpecsPassthrough, ConfidenceBadge, DirectorRationalePanel, MetricPill, WhatThisDoesNotProve } from "./cpc-shared";
import { inspectData, selectVisuals, RECIPE_CONTEXTS } from "@/lib/atlas/visual-recipe-director";

// ── Gap severity display ──────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  CpcGap["severity"],
  { label: string; cls: string; dotCls: string; cardCls: string }
> = {
  low: {
    label: "LOW",
    cls: "text-muted-foreground bg-muted",
    dotCls: "bg-muted-foreground",
    cardCls: "border-border bg-muted/10",
  },
  medium: {
    label: "MED",
    cls: "text-amber-700 bg-amber-50",
    dotCls: "bg-amber-500",
    cardCls: "border-amber-200 bg-amber-50/30",
  },
  high: {
    label: "HIGH",
    cls: "text-red-700 bg-red-50",
    dotCls: "bg-red-500",
    cardCls: "border-red-200 bg-red-50/30",
  },
};

const SEVERITY_ORDER: Record<CpcGap["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function GapCard({ gap }: { gap: CpcGap }) {
  const s = SEVERITY_STYLE[gap.severity];
  return (
    <div className={cn("rounded-lg border p-3 space-y-1.5", s.cardCls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-px", s.dotCls)} />
          <p className="text-xs font-semibold leading-snug">{gap.area}</p>
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
      {(gap.project_count !== undefined || gap.claim_count !== undefined) && (
        <div className="flex gap-3 text-[10px] text-muted-foreground/60 pl-3">
          {gap.project_count !== undefined && (
            <span>
              {gap.project_count} project{gap.project_count !== 1 ? "s" : ""}
            </span>
          )}
          {gap.claim_count !== undefined && (
            <span>
              {gap.claim_count} claim{gap.claim_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Thin evidence table ───────────────────────────────────────────────────────

function ThinEvidenceTable({ portfolio }: { portfolio: CpcBusinessUnit[] }) {
  const thin = portfolio.filter(
    (bu) => bu.l3_claims === 0 || bu.claim_count < 5,
  );
  if (thin.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Thin Evidence Areas
      </h3>
      <p className="text-xs text-muted-foreground">
        Business units with projects but weak or missing claim coverage.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs min-w-[400px]">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground">
              <th className="py-2 pr-3 text-left font-semibold pl-3">
                Business Unit
              </th>
              <th className="py-2 px-2 text-center font-semibold">Projects</th>
              <th className="py-2 px-2 text-center font-semibold">Claims</th>
              <th className="py-2 px-2 text-center font-semibold text-emerald-600">
                L3
              </th>
              <th className="py-2 pl-2 text-left font-semibold">Gap</th>
            </tr>
          </thead>
          <tbody>
            {thin.map((bu, i) => {
              const gapLabel =
                bu.l3_claims === 0 && bu.l2_claims === 0
                  ? "No L2/L3 claims"
                  : bu.l3_claims === 0
                  ? "No L3 strategic claims"
                  : "Thin evidence (<5 claims)";
              return (
                <tr
                  key={bu.name}
                  className={cn(
                    "text-xs",
                    i < thin.length - 1 && "border-b border-border",
                  )}
                >
                  <td className="py-2 pr-3 font-medium pl-3">{bu.name}</td>
                  <td className="py-2 px-2 text-center tabular-nums">
                    {bu.project_count}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums">
                    {bu.claim_count}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums font-semibold text-red-600">
                    {bu.l3_claims}
                  </td>
                  <td className="py-2 pl-2 text-muted-foreground">{gapLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Enrichment actions panel ──────────────────────────────────────────────────

function EnrichmentActions({ gaps }: { gaps: CpcGap[] }) {
  const highGaps = gaps.filter((g) => g.severity === "high");
  const medGaps = gaps.filter((g) => g.severity === "medium");
  if (highGaps.length === 0 && medGaps.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recommended Enrichment Actions
      </h3>
      <div className="space-y-1.5">
        {highGaps.map((gap, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-red-50 border border-red-100"
          >
            <span className="shrink-0 font-semibold text-red-600 mt-px">
              {i + 1}.
            </span>
            <div>
              <span className="font-medium text-red-800">{gap.area}</span>
              <span className="text-red-700"> — commission outcome study or ingest unpublished evaluation.</span>
            </div>
          </div>
        ))}
        {medGaps.map((gap, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-amber-50 border border-amber-100"
          >
            <span className="shrink-0 font-semibold text-amber-600 mt-px">
              {highGaps.length + i + 1}.
            </span>
            <div>
              <span className="font-medium text-amber-800">{gap.area}</span>
              <span className="text-amber-700"> — review corpus ingestion backlog for relevant documents.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function CpcEvidenceGapsRecipe({ artifact }: Props) {
  const gaps = artifact.cpc_gaps ?? [];
  const claims = artifact.cpc_claims ?? [];
  const portfolio = artifact.cpc_portfolio ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Gap severity counts
  const highCount = gaps.filter((g) => g.severity === "high").length;
  const medCount = gaps.filter((g) => g.severity === "medium").length;
  const lowCount = gaps.filter((g) => g.severity === "low").length;

  // Gauge: corpus readiness (inverse of gap severity pressure)
  // Each HIGH gap = −25, MED = −10, LOW = −3; floor at 0
  const readinessScore = Math.max(
    0,
    Math.round(100 - highCount * 25 - medCount * 10 - lowCount * 3),
  );

  // Sort gaps: high first
  const sortedGaps = [...gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  // Visual Director — evidence_coverage intent
  const directorSelection = selectVisuals(
    "evidence_coverage",
    inspectData([
      ...gaps.map((g) => ({ area: g.area, severity: g.severity })),
      ...claims.map((c) => ({ level: c.level, confidence_tier: c.confidence_tier })),
    ]),
    RECIPE_CONTEXTS.cpc_evidence_gaps,
  );

  // Chart: claims by level
  const l1 = claims.filter((c) => c.level === 1).length;
  const l2 = claims.filter((c) => c.level === 2).length;
  const l3 = claims.filter((c) => c.level === 3).length;
  const claimLevelData = [
    { level: "L1 Delivery", count: l1 },
    { level: "L2 Programme", count: l2 },
    { level: "L3 Strategic", count: l3 },
  ].filter((d) => d.count > 0);

  // Chart: confidence tier distribution from claims
  const tierCounts: Record<string, number> = {};
  claims.forEach((c) => {
    tierCounts[c.confidence_tier] = (tierCounts[c.confidence_tier] ?? 0) + 1;
  });
  const tierData = Object.entries(tierCounts).map(([tier, count]) => ({
    tier,
    count,
  }));

  const showCharts = claimLevelData.length > 0 || tierData.length > 0;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CPC Evidence Gaps
        </span>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      <div className="p-4 space-y-5">
        {/* Summary */}
        {summary && (
          <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
        )}

        {/* Visual Director rationale */}
        {(gaps.length > 0 || claims.length > 0) && (
          <DirectorRationalePanel selection={directorSelection} />
        )}

        {/* Gap severity metrics */}
        <div className="flex flex-wrap gap-2">
          {highCount > 0 && (
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-red-50 border border-red-200 min-w-[60px]">
              <span className="text-sm font-bold text-red-700 tabular-nums">
                {highCount}
              </span>
              <span className="text-[10px] text-red-600 text-center leading-tight mt-0.5">
                High gaps
              </span>
            </div>
          )}
          {medCount > 0 && (
            <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 min-w-[60px]">
              <span className="text-sm font-bold text-amber-700 tabular-nums">
                {medCount}
              </span>
              <span className="text-[10px] text-amber-600 text-center leading-tight mt-0.5">
                Med gaps
              </span>
            </div>
          )}
          {lowCount > 0 && (
            <MetricPill label="Low gaps" value={lowCount} />
          )}
          <MetricPill label="Total gaps" value={gaps.length} />
          {claims.length > 0 && (
            <MetricPill label="Claims reviewed" value={claims.length} />
          )}
          {portfolio.length > 0 && (
            <MetricPill label="Business Units" value={portfolio.length} />
          )}
        </div>

        {/* Gap cards */}
        {sortedGaps.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence Gaps
            </h3>
            <div className="space-y-2">
              {sortedGaps.map((gap, i) => (
                <GapCard key={i} gap={gap} />
              ))}
            </div>
          </div>
        )}

        {/* Thin evidence table */}
        {portfolio.length > 0 && <ThinEvidenceTable portfolio={portfolio} />}

        {/* Gauge: corpus readiness */}
        {(gaps.length > 0 || claims.length > 0) && (
          <div className="border-t border-border pt-4 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Corpus Readiness Score
            </h3>
            <p className="text-xs text-muted-foreground">
              {readinessScore >= 75
                ? "Corpus is investment-ready — gaps are manageable."
                : readinessScore >= 50
                ? "Partial readiness — address HIGH severity gaps before submitting bids."
                : "Low readiness — significant evidence gaps require urgent enrichment."}
            </p>
            <ChartRenderer
              spec={{ type: "gauge", title: "Corpus Readiness %", value: readinessScore }}
              data={[]}
            />
          </div>
        )}

        {/* Charts: claim level + confidence distribution */}
        {showCharts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
            {claimLevelData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Where is the evidence pyramid incomplete?
                </h3>
                <p className="text-xs text-muted-foreground">
                  {l3 === 0
                    ? "No L3 strategic outcome claims verified — the pyramid has no top. Cannot support a strategic case for any bid."
                    : `${l3} strategic claim${l3 !== 1 ? "s" : ""} verified. Review each for funding eligibility before citing.`}
                </p>
                <ChartRenderer
                  spec={{
                    type: "bar",
                    title: "Claims by Level",
                    x: "level",
                    y: "count",
                  }}
                  data={claimLevelData}
                />
              </div>
            )}
            {tierData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How much evidence is citable in a funding bid?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Only Supported and Robust claims can be cited in a bid. Speculative and Indicative claims require validation before use.
                </p>
                <ChartRenderer
                  spec={{
                    type: "pie",
                    title: "Confidence Tier Distribution",
                    x: "tier",
                    y: "count",
                  }}
                  data={tierData}
                />
              </div>
            )}
          </div>
        )}

        {/* Enrichment actions */}
        {gaps.length > 0 && (
          <div className="border-t border-border pt-4">
            <EnrichmentActions gaps={gaps} />
          </div>
        )}

        {/* What this does not prove */}
        <WhatThisDoesNotProve
          extra={[
            "That identified gaps are the only gaps — areas not queried may have undiscovered gaps",
            "That closing gaps will guarantee bid success — funder criteria may extend beyond the corpus scope",
            "The time or cost required to close each gap — this requires a separate enrichment scoping exercise",
          ]}
        />

        {/* Agent-injected supplementary charts */}
        <ChartSpecsPassthrough chartSpecs={artifact.chart_specs} />

        {gaps.length === 0 && claims.length === 0 && portfolio.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No gap analysis data available. Ask the agent to run an evidence gap
            analysis across the CPC corpus.
          </p>
        )}
      </div>
    </div>
  );
}
