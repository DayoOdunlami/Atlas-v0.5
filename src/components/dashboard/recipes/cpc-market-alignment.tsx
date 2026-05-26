"use client";

import type {
  ArtifactBlock,
  CorpusCitation,
  CpcClaim,
  SourceType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import {
  ConfidenceBadge,
  GapCaveatPanel,
  MetricPill,
  RecommendationBanner,
  TIER_BADGE,
} from "./cpc-shared";

// ── Sub-components ────────────────────────────────────────────────────────────

const SOURCE_DOT: Record<SourceType, string> = {
  project: "bg-indigo-500",
  live_call: "bg-green-500",
  knowledge_doc: "bg-blue-500",
  knowledge_chunk: "bg-blue-500",
  hive_chunk: "bg-purple-500",
  hive_article: "bg-purple-500",
};

const SOURCE_BADGE_STYLE: Partial<Record<SourceType, string>> = {
  live_call: "bg-green-50 text-green-700 border-green-200",
  project: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const SOURCE_BADGE_LABEL: Partial<Record<SourceType, string>> = {
  live_call: "Open Call",
  project: "R&D Project",
};

function LiveCallCard({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const fitLabel =
    pct >= 85 ? "Strong fit" : pct >= 70 ? "Partial fit" : "Weak fit";
  const fitCls =
    pct >= 85
      ? "text-green-700 bg-green-50 border-green-200"
      : pct >= 70
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
          {c.title}
        </p>
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            fitCls,
          )}
        >
          {fitLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground truncate">
            {c.funder ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {c.deadline && (
            <span className="text-[10px] text-amber-700">
              Closes {c.deadline}
            </span>
          )}
          <span className="text-xs font-mono text-indigo-600">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const barColor =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";
  const badgeStyle = c.source_type ? SOURCE_BADGE_STYLE[c.source_type] : null;
  const badgeLabel = c.source_type ? SOURCE_BADGE_LABEL[c.source_type] : null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
          {c.title}
        </p>
        {badgeStyle && badgeLabel && (
          <span
            className={cn(
              "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border",
              badgeStyle,
            )}
          >
            {badgeLabel}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[55%]">
          {c.organisation ?? c.funder ?? c.publisher ?? ""}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

const CLAIM_LEVEL_CONFIG = {
  1: { label: "L1", cls: "bg-slate-50 text-slate-700 border-slate-200" },
  2: { label: "L2", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  3: { label: "L3", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

function ClaimCard({ claim }: { claim: CpcClaim }) {
  const level = CLAIM_LEVEL_CONFIG[claim.level];
  const tier = TIER_BADGE[claim.confidence_tier];

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
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
    </div>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function CpcMarketAlignmentRecipe({ artifact }: Props) {
  const allCitations = artifact.corpus_citations ?? [];
  const liveCalls = allCitations.filter((c) => c.source_type === "live_call");
  const projects = allCitations.filter(
    (c) => c.source_type === "project" || !c.source_type,
  );
  const claims = artifact.cpc_claims ?? [];
  const gaps = artifact.cpc_gaps ?? [];
  const summary = artifact.sections?.["Summary"] ?? "";

  // Chart: fit score by live call
  const fitScoreData = liveCalls.map((c) => ({
    call: c.title.length > 30 ? c.title.slice(0, 30) + "…" : c.title,
    fit_pct: Math.round((c.score ?? 0) * 100),
  }));

  // Chart: CPC evidence coverage by source type
  const coverageData = [
    { area: "R&D Projects", count: projects.length },
    { area: "Matched Claims", count: claims.length },
    { area: "Open Calls", count: liveCalls.length },
  ].filter((d) => d.count > 0);

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CPC Market Alignment
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

        {/* Key metrics */}
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Live Calls" value={liveCalls.length} />
          <MetricPill label="Matched Projects" value={projects.length} />
          <MetricPill label="Matched Claims" value={claims.length} />
          {gaps.length > 0 && (
            <MetricPill label="Evidence Gaps" value={gaps.length} />
          )}
        </div>

        {/* Live calls */}
        {liveCalls.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live Funding Calls
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {liveCalls.map((c) => (
                <LiveCallCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        )}

        {/* Matched projects */}
        {projects.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Matched CPC Projects
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {projects.map((c) => (
                <ProjectCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        )}

        {/* Matched claims */}
        {claims.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Matched CPC Claims
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {claims.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {(fitScoreData.length > 0 || coverageData.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
            {fitScoreData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fit Score by Live Call
                </h3>
                <p className="text-xs text-muted-foreground">
                  Semantic similarity of CPC evidence to each call scope.{" "}
                  <span className="text-green-700 font-medium">85%+ = strong fit</span>;{" "}
                  below 70% = weak fit.
                </p>
                <ChartRenderer
                  spec={{
                    type: "radial-bar",
                    title: "Fit Score by Live Call",
                    x: "call",
                    y: "fit_pct",
                  }}
                  data={fitScoreData}
                />
              </div>
            )}
            {coverageData.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  CPC Evidence Coverage
                </h3>
                <p className="text-xs text-muted-foreground">
                  Matched items per evidence type. Portfolio breadth across
                  projects, claims and live calls.
                </p>
                <ChartRenderer
                  spec={{
                    type: "pie",
                    title: "Evidence Coverage Mix",
                    x: "area",
                    y: "count",
                  }}
                  data={coverageData}
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

        {allCitations.length === 0 && claims.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No market alignment data available. Ask the agent to search live
            calls and match against the CPC corpus.
          </p>
        )}
      </div>
    </div>
  );
}
