"use client";

import { useMemo } from "react";
import type { ArtifactBlock, CpcBusinessUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import { ChartSpecsPassthrough, ConfidenceBadge, DirectorRationalePanel, GapCaveatPanel, MetricPill, WhatThisDoesNotProve } from "./cpc-shared";
import { inspectData, selectVisuals, RECIPE_CONTEXTS } from "@/lib/atlas/visual-recipe-director";
import { G2VennChart } from "@/components/lab/g2-venn-chart";
import type { VennSet } from "@/components/lab/venn-diagram";

// ── Portfolio table row ───────────────────────────────────────────────────────

function PortfolioTableRow({
  bu,
  isLast,
}: {
  bu: CpcBusinessUnit;
  isLast: boolean;
}) {
  const hasL3 = bu.l3_claims > 0;
  const claimDepth =
    bu.l3_claims > 0 ? "text-green-700" : bu.l2_claims > 0 ? "text-blue-700" : "text-muted-foreground";

  return (
    <tr className={cn("text-xs", !isLast && "border-b border-border")}>
      <td className="py-2 pr-3 font-medium text-foreground/90">{bu.name}</td>
      <td className="py-2 px-2 text-center tabular-nums">{bu.project_count}</td>
      <td className="py-2 px-2 text-center tabular-nums">{bu.claim_count}</td>
      <td className="py-2 px-2 text-center tabular-nums text-slate-600">
        {bu.l1_claims}
      </td>
      <td className="py-2 px-2 text-center tabular-nums text-indigo-600">
        {bu.l2_claims}
      </td>
      <td
        className={cn(
          "py-2 px-2 text-center tabular-nums font-semibold",
          claimDepth,
        )}
      >
        {bu.l3_claims}
      </td>
      <td className="py-2 pl-2 text-center tabular-nums text-muted-foreground">
        {bu.evidence_links}
      </td>
      <td className="py-2 pl-3">
        {!hasL3 && (
          <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            no L3
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function CpcPortfolioComparisonRecipe({ artifact }: Props) {
  const portfolio = artifact.cpc_portfolio ?? [];
  const gaps = artifact.cpc_gaps ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Totals
  const totalProjects = portfolio.reduce((s, bu) => s + bu.project_count, 0);
  const totalClaims = portfolio.reduce((s, bu) => s + bu.claim_count, 0);
  const totalL3 = portfolio.reduce((s, bu) => s + bu.l3_claims, 0);
  const totalLinks = portfolio.reduce((s, bu) => s + bu.evidence_links, 0);

  // Chart: project count by BU
  const projectsByBuData = portfolio.map((bu) => ({
    bu: bu.name,
    projects: bu.project_count,
  }));

  // Chart: stacked claims by level per BU
  const stackedClaimsData = portfolio.flatMap((bu) => [
    { bu: bu.name, level: "L1", count: bu.l1_claims },
    { bu: bu.name, level: "L2", count: bu.l2_claims },
    { bu: bu.name, level: "L3", count: bu.l3_claims },
  ]);

  // Venn: BU bid-readiness coverage (3-set, real counts — no estimation)
  //   A = "Has Projects"          BUs with project_count > 0
  //   B = "Has Programme Claims"  BUs with l2_claims > 0
  //   C = "Has Strategic Claims"  BUs with l3_claims > 0
  // Intersection sizes are derived directly from portfolio — honest, not estimated.
  // l3 > 0 implies l2 > 0 implies project_count > 0 in practice, so C ⊆ B ⊆ A.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const buVennData = useMemo((): VennSet[] => {
    if (portfolio.length === 0) return [];
    const a  = portfolio.filter((bu) => bu.project_count > 0).length;
    const b  = portfolio.filter((bu) => bu.l2_claims > 0).length;
    const c  = portfolio.filter((bu) => bu.l3_claims > 0).length;
    const ab = portfolio.filter((bu) => bu.project_count > 0 && bu.l2_claims > 0).length;
    const ac = portfolio.filter((bu) => bu.project_count > 0 && bu.l3_claims > 0).length;
    const bc = portfolio.filter((bu) => bu.l2_claims > 0 && bu.l3_claims > 0).length;
    const abc = portfolio.filter(
      (bu) => bu.project_count > 0 && bu.l2_claims > 0 && bu.l3_claims > 0,
    ).length;
    // Skip rendering if sets are identical (no distinguishable overlap)
    if (a === b && b === c) return [];
    return [
      { sets: ["Has Projects"],          size: a,   label: `Has Projects (${a})` },
      { sets: ["Has L2 Claims"],         size: b,   label: `L2 Programme (${b})` },
      { sets: ["Has L3 Claims"],         size: c,   label: `L3 Strategic (${c})` },
      { sets: ["Has Projects", "Has L2 Claims"],         size: ab },
      { sets: ["Has Projects", "Has L3 Claims"],         size: ac },
      { sets: ["Has L2 Claims", "Has L3 Claims"],        size: bc },
      { sets: ["Has Projects", "Has L2 Claims", "Has L3 Claims"], size: abc },
    ].filter((d) => d.size > 0);
  }, [portfolio]);

  // Heatmap: claim density per BU × level
  // Truncate long BU names so they fit on the y-axis
  const heatmapData = portfolio.flatMap((bu) => {
    const name = bu.name.length > 22 ? bu.name.slice(0, 22) + "…" : bu.name;
    return [
      { bu: name, level: "L1", count: bu.l1_claims },
      { bu: name, level: "L2", count: bu.l2_claims },
      { bu: name, level: "L3", count: bu.l3_claims },
    ];
  });

  // Sort portfolio by project count desc
  const sorted = [...portfolio].sort((a, b) => b.project_count - a.project_count);

  // Visual Director — portfolio_audit intent
  const directorSelection = selectVisuals(
    "portfolio_audit",
    inspectData(
      portfolio.map((bu) => ({
        bu: bu.name,
        l1: bu.l1_claims,
        l2: bu.l2_claims,
        l3: bu.l3_claims,
        projects: bu.project_count,
      })),
    ),
    RECIPE_CONTEXTS.cpc_portfolio_comparison,
  );

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CPC Portfolio Comparison
        </span>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      <div className="p-4 space-y-5">
        {/* Summary */}
        {summary && (
          <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
        )}

        {/* Visual Director rationale */}
        {portfolio.length > 0 && (
          <DirectorRationalePanel selection={directorSelection} />
        )}

        {/* Key metrics */}
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Total Projects" value={totalProjects} />
          <MetricPill label="Total Claims" value={totalClaims} />
          <MetricPill label="L3 Strategic" value={totalL3} />
          <MetricPill label="Evidence Links" value={totalLinks} />
          <MetricPill label="Business Units" value={portfolio.length} />
        </div>

        {/* Bar chart: projects by BU */}
        {projectsByBuData.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where is CPC project volume concentrated?
            </h3>
            <p className="text-xs text-muted-foreground">
              Project count by unit. High volume does not mean stronger evidence — a unit with fewer but well-evidenced projects may be more bid-ready.
            </p>
            <ChartRenderer
              spec={{
                type: "bar",
                title: "Projects by Business Unit",
                x: "bu",
                y: "projects",
              }}
              data={projectsByBuData}
            />
          </div>
        )}

        {/* Stacked bar: claims by level per BU */}
        {stackedClaimsData.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Which units have programme and strategic-level evidence?
            </h3>
            <p className="text-xs text-muted-foreground">
              L3 (strategic outcome) claims are the bid-readiness threshold. Units with L1-only evidence cannot support a Green Book strategic case.
            </p>
            <ChartRenderer
              spec={{
                type: "stacked-bar",
                title: "Claims by Level per BU",
                x: "bu",
                y: "count",
                series: "level",
              }}
              data={stackedClaimsData}
            />
          </div>
        )}

        {/* Comparison table */}
        {sorted.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Portfolio Detail
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs min-w-[540px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">
                      Business Unit
                    </th>
                    <th className="py-2 px-2 text-center font-semibold">
                      Projects
                    </th>
                    <th className="py-2 px-2 text-center font-semibold">
                      Claims
                    </th>
                    <th className="py-2 px-2 text-center font-semibold text-slate-600">
                      L1
                    </th>
                    <th className="py-2 px-2 text-center font-semibold text-indigo-600">
                      L2
                    </th>
                    <th className="py-2 px-2 text-center font-semibold text-emerald-600">
                      L3
                    </th>
                    <th className="py-2 pl-2 text-center font-semibold">
                      Ev. Links
                    </th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody className="px-2">
                  {sorted.map((bu, i) => (
                    <PortfolioTableRow
                      key={bu.name}
                      bu={bu}
                      isLast={i === sorted.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Corpus compares project volume and evidence coverage only. Cannot
              compare productivity or FTE performance without validated resource
              data.
            </p>
          </div>
        )}

        {/* Venn: BU bid-readiness — Has Projects ∩ Has L2 Claims ∩ Has L3 Claims */}
        {buVennData.length >= 2 && (
          <div className="space-y-1 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Which units are fully evidenced for a bid?
            </h3>
            <p className="text-xs text-muted-foreground">
              Centre intersection = units with projects + L2 programme claims + L3 strategic claims (bid-ready).
              Outer crescent of "Has Projects" = active units with no programme-level evidence yet.
            </p>
            <G2VennChart data={buVennData} height={240} variant="filled" theme="light" />
          </div>
        )}

        {/* Heatmap: claim density by BU × level */}
        {heatmapData.length > 0 && (
          <div className="space-y-1 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Which units are evidence-thin at strategic level?
            </h3>
            <p className="text-xs text-muted-foreground">
              Darker cells = more claims at that level. Empty L3 cells are the critical gap — those units cannot support a strategic case today.
            </p>
            <ChartRenderer
              spec={{
                type: "heatmap",
                title: "Claim Density by BU × Level",
                x: "level",
                y: "bu",
                value: "count",
              }}
              data={heatmapData}
            />
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
            "Which unit is performing best — project count is not a performance metric",
            "Resource efficiency or cost-per-outcome — no FTE or budget data is in the corpus",
            "Whether any unit is investment-ready without reviewing individual claim quality",
          ]}
        />

        {/* Agent-injected supplementary charts */}
        <ChartSpecsPassthrough chartSpecs={artifact.chart_specs} />

        {portfolio.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No portfolio data available. Ask the agent to run a portfolio
            comparison across business units.
          </p>
        )}
      </div>
    </div>
  );
}
