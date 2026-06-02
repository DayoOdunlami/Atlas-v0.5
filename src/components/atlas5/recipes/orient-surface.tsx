"use client";

/**
 * OrientSurface — ORIENT recipe
 *
 * 1. HeadlineCard — terrain summary
 * 2. Domain heatmap (ECharts, ≥ 3 domains) — empty domains as hollow cells
 * 3. Top evidence — 3-5 results with claim state badge + similarity score
 * 4. CPC position indicator when lens=CPC
 * 5. Escalation: "Find opportunities →" → CONNECT [FRONTEND]
 * 6. Confidence tier visual weight
 */

import { useState } from "react";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import {
  SurfaceHeadline,
  EvidenceCountStrip,
  TIER_BADGE,
} from "./surface-primitives";
import { EChartsChart } from "@/components/lab/echarts-chart";
import { ArrowRight, MapPin } from "lucide-react";
import type { EChartsOption } from "echarts";

// ---------------------------------------------------------------------------
// Domain heatmap builder
// ---------------------------------------------------------------------------

interface DomainData {
  domain: string;
  evidence_count: number;
  cpc_projects?: number;
  open_calls?: number;
  maturity?: "low" | "medium" | "high";
}

function buildDomainHeatmapOption(domains: DomainData[]): EChartsOption {
  const maturityOrder = ["low", "medium", "high"];
  const sortedDomains = [...domains].sort((a, b) => (b.evidence_count ?? 0) - (a.evidence_count ?? 0));
  const domainNames = sortedDomains.map((d) => d.domain);

  // Two y-axis categories: Evidence Count and CPC Projects
  const yCategories = ["CPC Projects", "Open Calls", "Evidence Items"];
  const cells: [number, number, number][] = [];

  sortedDomains.forEach((d, xi) => {
    cells.push([xi, 0, d.cpc_projects ?? 0]);
    cells.push([xi, 1, d.open_calls ?? 0]);
    cells.push([xi, 2, d.evidence_count ?? 0]);
  });

  const maxVal = Math.max(...cells.map((c) => c[2]), 1);

  return {
    backgroundColor: "transparent",
    grid: { left: "14%", right: "5%", top: "5%", bottom: "22%", containLabel: false },
    xAxis: {
      type: "category",
      data: domainNames,
      axisLabel: { color: "#94a3b8", fontSize: 9, rotate: -20, interval: 0 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: yCategories,
      axisLabel: { color: "#94a3b8", fontSize: 9 },
      axisLine: { lineStyle: { color: "#4b5563" } },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "1%",
      inRange: { color: ["#1e293b", "#4f46e5", "#6366f1"] },
      textStyle: { color: "#94a3b8", fontSize: 9 },
      itemHeight: 80,
      itemWidth: 10,
    },
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] };
        const domain = domainNames[p.value[0]] ?? "";
        const metric = yCategories[p.value[1]] ?? "";
        return `${domain}<br/>${metric}: <b>${p.value[2]}</b>`;
      },
    },
    series: [
      {
        type: "heatmap",
        data: cells,
        label: {
          show: true,
          formatter: (params: unknown) => {
            const p = params as { value: [number, number, number] };
            return p.value[2] === 0 ? "" : String(p.value[2]);
          },
          color: "#f8fafc",
          fontSize: 9,
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.4)" } },
        itemStyle: {
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.05)",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// CPC Position indicator
// ---------------------------------------------------------------------------

function CpcPositionCard({
  position,
  styles,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  position: any;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  if (!position) return null;

  return (
    <div
      data-testid="orient-cpc-position"
      className={cn("rounded-lg border p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20", "border-indigo-200 dark:border-indigo-800")}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin className="size-3.5 text-indigo-600 dark:text-indigo-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          CPC Position
        </p>
      </div>
      <p className={cn("text-xs leading-relaxed", styles.body)}>
        {position.summary}
      </p>
      {(position.strongest_domain || position.whitespace_domain) && (
        <div className="flex gap-4 mt-2">
          {position.strongest_domain && (
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Strongest</p>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {position.strongest_domain}
              </p>
            </div>
          )}
          {position.whitespace_domain && (
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Whitespace</p>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {position.whitespace_domain}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top evidence list
// ---------------------------------------------------------------------------

function TopEvidence({
  citations,
  styles,
}: {
  citations: NonNullable<ArtifactBlock["corpus_citations"]>;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const top = citations.slice(0, 5);
  if (top.length === 0) return null;

  return (
    <div data-testid="orient-top-evidence" className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Top Evidence ({top.length})
      </p>
      {top.map((c) => (
        <div
          key={c.id}
          className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-2.5 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-medium leading-snug line-clamp-2", styles.body)}>
              {c.title}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {c.organisation ?? c.publisher ?? c.funder ?? ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {c.claim_state && (
              <ClaimStateBadge
                state={c.claim_state}
                rationale={c.claim_rationale}
                showLabel={false}
              />
            )}
            {c.score != null && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {Math.round(c.score * 100)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  artifact: ArtifactBlock;
}

export function OrientSurface({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const citations = artifact.corpus_citations ?? [];
  const styles = getConfidenceStyles(artifact.confidence_tier);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra = artifact as any;
  const domains: DomainData[] = extra.orient_domains ?? [];
  const cpcPosition = extra.cpc_position;

  const headlineText = sections["Headline"] ?? sections[Object.keys(sections)[0]];

  const showHeatmap = domains.length >= 3;

  const handleFindOpportunities = () => {
    // [FRONTEND] — switch recipe to 'connect', passing current terrain as context
    console.info("[FRONTEND] Find opportunities — switch to CONNECT surface");
    window.alert("[Demo] Connect surface navigation wired at surface gateway level.");
  };

  return (
    <div
      className={cn("space-y-1", styles.container)}
      data-testid="recipe-orient"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Orient
        </span>
        <div className="flex items-center gap-2">
          <EvidenceCountStrip citations={citations} />
          <span
            data-testid="confidence-tier-badge"
            className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", TIER_BADGE[artifact.confidence_tier])}
          >
            {artifact.confidence_tier}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. Headline — answer first */}
        <SurfaceHeadline
          text={headlineText ?? "Innovation landscape overview in progress."}
          tier={artifact.confidence_tier}
          label="terrain summary"
        />

        {/* 2. Domain heatmap */}
        {showHeatmap && (
          <div data-testid="orient-domain-heatmap" className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Domain Coverage Matrix
            </p>
            <div className={cn("rounded-lg border p-3", styles.border, "bg-muted/10")}>
              <EChartsChart
                option={buildDomainHeatmapOption(domains)}
                style={{ height: "160px", width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* 3. Top evidence */}
        <TopEvidence citations={citations} styles={styles} />

        {/* 4. CPC position */}
        <CpcPositionCard position={cpcPosition} styles={styles} />

        {/* 5. Escalation */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleFindOpportunities}
            data-testid="orient-find-opportunities"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
          >
            Find opportunities
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
