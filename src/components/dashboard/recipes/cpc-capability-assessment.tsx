"use client";

import type { ArtifactBlock, CorpusCitation, CpcClaim, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import {
  ConfidenceBadge,
  GapCaveatPanel,
  MetricPill,
  RecommendationBanner,
  TIER_BADGE,
} from "./cpc-shared";

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

        {/* Charts */}
        {showCharts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
            {claimLevelData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Claims by Level
                </h3>
                <p className="text-xs text-muted-foreground">
                  {l3 === 0
                    ? "No strategic outcome claims verified — evidence is delivery-heavy."
                    : l3 < l1
                    ? "Delivery claims dominate; strategic claims are thin."
                    : "Good spread across claim levels."}
                </p>
                <ChartRenderer
                  spec={{ type: "bar", title: "Claims by Level", x: "level", y: "count" }}
                  data={claimLevelData}
                />
              </div>
            )}
            {tierData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Confidence Distribution
                </h3>
                <p className="text-xs text-muted-foreground">
                  Evidence quality spread across {tierData.length} confidence tier
                  {tierData.length !== 1 ? "s" : ""}.
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

        {/* Gaps */}
        {gaps.length > 0 && (
          <div className="border-t border-border pt-4">
            <GapCaveatPanel gaps={gaps} />
          </div>
        )}

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
