"use client";

import type { ArtifactBlock, CorpusCitation, CpcClaim, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import {
  ChartSpecsPassthrough,
  ConfidenceBadge,
  DirectorRationalePanel,
  GapCaveatPanel,
  MetricPill,
  RecommendationBanner,
  TIER_BADGE,
  WhatThisDoesNotProve,
} from "./cpc-shared";
import {
  inspectData,
  selectVisuals,
  RECIPE_CONTEXTS,
} from "@/lib/atlas/visual-recipe-director";

// ── Source dot / label (mirrored from evidence-panel) ────────────────────────

const SOURCE_DOT: Record<SourceType, string> = {
  project: "bg-indigo-500",
  live_call: "bg-green-500",
  knowledge_doc: "bg-blue-500",
  knowledge_chunk: "bg-blue-500",
  hive_chunk: "bg-purple-500",
  hive_article: "bg-purple-500",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  project: "R&D",
  live_call: "Call",
  knowledge_doc: "Policy",
  knowledge_chunk: "Policy",
  hive_chunk: "HIVE",
  hive_article: "HIVE",
};

// ── Claim level badge config ──────────────────────────────────────────────────

const CLAIM_LEVEL_CONFIG = {
  1: { label: "L1 Delivery", cls: "bg-slate-50 text-slate-700 border-slate-200" },
  2: { label: "L2 Programme", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  3: { label: "L3 Strategic", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function ProjectCard({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const barColor =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";
  const dot = c.source_type ? SOURCE_DOT[c.source_type] : "bg-muted-foreground";
  const label = c.source_type ? SOURCE_LABEL[c.source_type] : null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:bg-muted/20 transition-colors">
      <p className="text-sm font-medium leading-snug line-clamp-2">{c.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {label && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
              {label}
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {c.organisation ?? c.funder ?? c.publisher ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function ClaimCard({ claim }: { claim: CpcClaim }) {
  const level = CLAIM_LEVEL_CONFIG[claim.level];
  const tier = TIER_BADGE[claim.confidence_tier];

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug flex-1">{claim.text}</p>
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            level.cls,
          )}
        >
          {level.label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[55%]">
          {claim.source_project ?? ""}
        </span>
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            tier,
          )}
        >
          {claim.confidence_tier}
        </span>
      </div>
      {claim.source_excerpt && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 leading-snug">
          {claim.source_excerpt}
        </p>
      )}
    </div>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function CpcCapabilityAssessmentRecipe({ artifact }: Props) {
  const claims = artifact.cpc_claims ?? [];
  const projects = (artifact.corpus_citations ?? []).filter(
    (c) => !c.source_type || c.source_type === "project",
  );
  const gaps = artifact.cpc_gaps ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Metric counts
  const l1 = claims.filter((c) => c.level === 1).length;
  const l2 = claims.filter((c) => c.level === 2).length;
  const l3 = claims.filter((c) => c.level === 3).length;
  const buCount = new Set(
    claims.filter((c) => c.business_unit).map((c) => c.business_unit!),
  ).size;

  // Gauge: corpus confidence score (% of claims that are Supported or Robust)
  const supportedCount = claims.filter((c) => c.confidence_tier === "Supported").length;
  const robustCount = claims.filter((c) => c.confidence_tier === "Robust").length;
  const gaugeValue = claims.length > 0
    ? Math.round(((supportedCount + robustCount) / claims.length) * 100)
    : 0;

  // Visual Director — readiness_maturity intent for capability assessment
  const directorSelection = selectVisuals(
    "readiness_maturity",
    inspectData([
      ...claims.map((c) => ({ level: c.level, confidence_tier: c.confidence_tier })),
      ...projects.map((p) => ({ score: p.score, source_type: p.source_type })),
    ]),
    RECIPE_CONTEXTS.cpc_capability_assessment,
  );

  // Chart: claim level distribution
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
          CPC Capability Assessment
        </span>
        <ConfidenceBadge tier={artifact.confidence_tier} />
      </div>

      <div className="p-4 space-y-5">
        {/* Summary prose */}
        {summary && (
          <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
        )}

        {/* Visual Director rationale */}
        {(claims.length > 0 || projects.length > 0) && (
          <DirectorRationalePanel selection={directorSelection} />
        )}

        {/* Recommendation */}
        {artifact.recommendation_action && (
          <RecommendationBanner
            action={artifact.recommendation_action}
            rationale={artifact.recommendation_rationale}
          />
        )}

        {/* Key metrics row */}
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Projects" value={projects.length} />
          <MetricPill label="Claims" value={claims.length} />
          <MetricPill label="L1 Delivery" value={l1} />
          <MetricPill label="L2 Programme" value={l2} />
          <MetricPill label="L3 Strategic" value={l3} />
          {buCount > 0 && <MetricPill label="Business Units" value={buCount} />}
          {gaps.length > 0 && <MetricPill label="Evidence Gaps" value={gaps.length} />}
        </div>

        {/* CPC Projects */}
        {projects.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CPC Projects
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {projects.map((c) => (
                <ProjectCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        )}

        {/* CPC Claims */}
        {claims.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CPC Claims
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {claims.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          </div>
        )}

        {/* Gauge: corpus confidence score */}
        {claims.length > 0 && (
          <div className="border-t border-border pt-4 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Corpus Confidence Score
            </h3>
            <p className="text-xs text-muted-foreground">
              {gaugeValue >= 70
                ? "Strong corpus — majority of claims are Supported or Robust."
                : gaugeValue >= 40
                ? "Partial confidence — mix of verified and indicative claims."
                : "Thin corpus — most claims lack corroborating evidence links."}
            </p>
            <ChartRenderer
              spec={{ type: "gauge", title: "Corpus Confidence %", value: gaugeValue }}
              data={[]}
            />
          </div>
        )}

        {/* Charts: claim level distribution + confidence pie */}
        {showCharts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
            {claimLevelData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How deep does the evidence go?
                </h3>
                <p className="text-xs text-muted-foreground">
                  {l3 === 0
                    ? "No strategic outcome claims (L3) verified — evidence is delivery-heavy. Cannot support a strategic investment case."
                    : l3 < l1
                    ? "Delivery claims dominate. Strategic claims exist but are outnumbered — thin for a Robust case."
                    : "Good spread across all three levels — sufficient depth for a programme-level case."}
                </p>
                <ChartRenderer
                  spec={{ type: "bar", title: "How deep does the evidence go?", x: "level", y: "count" }}
                  data={claimLevelData}
                />
              </div>
            )}
            {tierData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How reliable is the evidence?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Speculative and Indicative claims cannot be cited in funding bids without further validation.
                </p>
                <ChartRenderer
                  spec={{
                    type: "pie",
                    title: "How reliable is the evidence?",
                    x: "tier",
                    y: "count",
                  }}
                  data={tierData}
                />
              </div>
            )}
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
            "Whether the claimed capabilities are currently active — projects may be complete",
            "Capability strength relative to other organisations — no external benchmarking in this corpus",
          ]}
        />

        {/* Agent-injected supplementary charts */}
        <ChartSpecsPassthrough chartSpecs={artifact.chart_specs} />

        {projects.length === 0 && claims.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No capability evidence found in current corpus. Ask the agent to
            search for CPC projects and claims.
          </p>
        )}
      </div>
    </div>
  );
}
