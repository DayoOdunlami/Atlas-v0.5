/**
 * Atlas 5 — Artifact Pane (D7)
 *
 * Right pane — renders structured agent output.
 *
 * Renders one of three views based on artifact_block.type:
 *   'brief'    → Five Case Model (ATLAS): NPV card + 5 sections + citations
 *   'evidence' → Evidence view (JARVIS/CICERONE/HYVE): analysis + citations
 *
 * Populated via useArtifactStore which is updated by useAtlas5Chat when
 * the /api/copilotkit route emits a structured data annotation.
 *
 * data-testid="artifact-pane" — stable selector for Playwright + Tier 1 eval.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";

import {
  type ArtifactBlock,
  type EvidenceGap,
  useArtifactStore,
} from "@/lib/atlas5/artifact-store";
import { ArtifactQAPanel } from "@/components/atlas5/artifact-qa-panel";
import { RunProgress } from "@/components/atlas5/run-progress";
import { cn } from "@/lib/utils";
import {
  kbValidationTierLabel,
  kbValidationTierStyle,
} from "@/lib/atlas5/kb-validation-tier";
import type {
  ConfidenceTier,
  CorpusCitation,
  HiveCitation,
  RecipeType,
} from "@/lib/atlas5/types";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import {
  BriefFiveCaseRecipe,
  EvidencePanelRecipe,
  StatsDashboardRecipe,
  ScenarioStressTestRecipe,
  OrientSurface,
  ConnectSurface,
  DefendSurface,
  DiagnoseSurface,
} from "@/components/atlas5/recipes";
import { TrustRail } from "@/components/atlas5/trust-rail";
import { DecisionSpineCard } from "@/components/atlas5/decision-spine";
import { BlocksView } from "@/components/atlas5/block-renderer";
import { SurfaceHeadline, InsightCard } from "@/components/atlas5/recipes/surface-primitives";
import type { VisualBlock } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  Speculative:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Indicative:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Supported:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Robust:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const GAP_COLORS: Record<string, string> = {
  HAVE: "text-emerald-600 dark:text-emerald-400",
  PARTIAL: "text-amber-600 dark:text-amber-400",
  MISSING: "text-red-600 dark:text-red-400",
};

const GAP_ICONS: Record<string, string> = {
  HAVE: "✓",
  PARTIAL: "~",
  MISSING: "✗",
};

function CitationGuardBadge({
  guard,
}: {
  guard: NonNullable<ArtifactBlock["citation_guard"]>;
}) {
  if (guard.status === "pass") return null;
  return (
    <span
      data-testid="citation-guard-badge"
      title={guard.reason}
      className={cn(
        "inline-flex max-w-[200px] truncate items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        guard.status === "fail"
          ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
      )}
    >
      Evidence: {guard.citation_count ?? 0} · {guard.final_tier ?? guard.original_tier}
    </span>
  );
}

function ConfidenceBadge({ tier }: { tier: string }) {
  return (
    <span
      data-testid="confidence-tier-badge"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[tier] ?? TIER_COLORS.Speculative}`}
    >
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section accordion item
// ---------------------------------------------------------------------------

function SectionItem({
  title,
  content,
  defaultOpen = false,
}: {
  title: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-muted/40 hover:bg-muted/70 transition-colors"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {title}
        </span>
        <span
          className="text-muted-foreground text-sm transition-transform duration-150"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-3 py-2.5 bg-background">
          {content ? (
            <div className="text-sm text-foreground leading-relaxed prose prose-sm prose-slate max-w-none dark:prose-invert">
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              No content provided for this section.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NPV card (ATLAS brief)
// ---------------------------------------------------------------------------

function NpvCard({
  npvValue,
  discountRate,
  optimismBias,
}: {
  npvValue: number | null | undefined;
  discountRate: number | undefined;
  optimismBias: number | null | undefined;
}) {
  if (npvValue == null) return null;

  const isPositive = npvValue >= 0;
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(npvValue));

  return (
    <div
      data-testid="npv-card"
      className="rounded-xl border border-border bg-muted/30 p-4 mb-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
            Net Present Value
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isPositive ? "+" : "−"}
            {formatted}
          </p>
        </div>
        <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
          {discountRate != null && (
            <p>
              Discount rate:{" "}
              <span className="font-semibold text-foreground">
                {(discountRate * 100).toFixed(1)}%
              </span>{" "}
              <span className="text-[9px]">(HMT STPR)</span>
            </p>
          )}
          {optimismBias != null && (
            <p>
              Optimism bias:{" "}
              <span className="font-semibold text-foreground">
                {(optimismBias * 100).toFixed(0)}%
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corpus citations list
// ---------------------------------------------------------------------------

function CorpusCitationsList({
  citations,
}: {
  citations: CorpusCitation[];
}) {
  if (!citations.length) return null;

  const SOURCE_LABEL: Record<string, string> = {
    project: "Project",
    live_call: "Call",
    knowledge_doc: "Policy doc",
    knowledge_chunk: "Policy",
  };

  return (
    <div data-testid="corpus-citations-list" className="mt-4">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Corpus Citations ({citations.length})
      </h3>
      <ol className="space-y-2">
        {citations.map((c, i) => {
          const st = c.source_type ?? "project";
          const tierLabel = kbValidationTierLabel(c.validation_tier);
          return (
          <li
            key={`${c.id}-${i}`}
            className="flex gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border"
          >
            <span className="text-muted-foreground shrink-0 font-mono">
              [{i + 1}]
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-background text-muted-foreground">
                  {SOURCE_LABEL[st] ?? st}
                </span>
                {tierLabel && (
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border",
                      kbValidationTierStyle(c.validation_tier),
                    )}
                  >
                    {tierLabel}
                  </span>
                )}
                {c.score != null && (
                  <span className="text-[9px] text-muted-foreground">
                    {(c.score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="font-medium text-foreground truncate">{c.title}</p>
              {(c.organisation || c.publisher) && (
                <p className="text-muted-foreground text-[10px]">
                  {c.organisation || c.publisher}
                </p>
              )}
              {c.relevance_note && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2">
                  {c.relevance_note}
                </p>
              )}
            </div>
          </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HIVE citations list
// ---------------------------------------------------------------------------

function HiveCitationsList({ citations }: { citations: HiveCitation[] }) {
  if (!citations.length) return null;

  return (
    <div data-testid="hive-citations-list" className="mt-4">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        HIVE Articles ({citations.length})
      </h3>
      <ol className="space-y-2">
        {citations.map((c, i) => (
          <li
            key={c.article_id}
            className="flex gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border"
          >
            <span className="text-muted-foreground shrink-0 font-mono">
              [{i + 1}]
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{c.title}</p>
              {c.score != null && (
                <p className="text-muted-foreground text-[10px]">
                  Relevance: {(c.score * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence gaps (CICERONE)
// ---------------------------------------------------------------------------

function EvidenceGapsList({ gaps }: { gaps: EvidenceGap[] }) {
  if (!gaps.length) return null;

  return (
    <div data-testid="evidence-gaps-list" className="mt-4">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Evidence Gaps
      </h3>
      <div className="space-y-1.5">
        {gaps.map((g, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs rounded px-2 py-1.5 bg-muted/30 border border-border"
          >
            <span
              className={`font-bold shrink-0 ${GAP_COLORS[g.status] ?? ""}`}
              title={g.status}
            >
              {GAP_ICONS[g.status]}
            </span>
            <div className="min-w-0">
              <span className="font-medium text-foreground">{g.area}</span>
              {g.note && (
                <span className="text-muted-foreground ml-1">— {g.note}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transferability score (CICERONE)
// ---------------------------------------------------------------------------

function TransferabilityScore({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-500"
      : score >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div
      data-testid="transferability-score"
      className="mb-4 rounded-xl border border-border bg-muted/30 p-4"
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Transferability Score
      </p>
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {score}
        </span>
        <span className="text-sm text-muted-foreground">/100</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipe router (D7 — explicit recipe field preferred over inference)
// ---------------------------------------------------------------------------

const FIVE_CASE_KEYS = new Set([
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
]);

const NEW_RECIPES = new Set<RecipeType>(["orient", "connect", "diagnose", "act", "defend"]);

function detectRecipe(artifact: ArtifactBlock): RecipeType | null {
  // Agent sets recipe explicitly — always prefer it.
  if (artifact.recipe) return artifact.recipe as RecipeType;
  // Infer from type + section keys for backward compat.
  if (artifact.type === "scenario") return "scenario_stress_test";
  if (artifact.type === "chart") return "stats_dashboard";
  if (artifact.type === "evidence") return "evidence_panel";
  // Brief: check for Title Case Five Case sections.
  const keys = Object.keys(artifact.sections ?? {});
  if (keys.some((k) => FIVE_CASE_KEYS.has(k))) return "brief_five_case";
  // Legacy lowercase sections — fall through to BriefView.
  return null;
}

function RecipeView({
  artifact,
  decisionSpine,
  showcase = false,
}: {
  artifact: ArtifactBlock;
  decisionSpine: import("@/lib/atlas5/types").DecisionSpine | null;
  showcase?: boolean;
}) {
  const recipe = detectRecipe(artifact);
  if (!recipe) return null; // caller falls back to legacy views

  const displayBlocks = artifact.visual_blocks ?? [];
  const hasVisualBlocks = displayBlocks.length > 0;
  const compact = showcase && hasVisualBlocks;

  // Route recipe ID → surface component
  const surface = (() => {
    switch (recipe) {
      // Five Case brief (ATLAS outward-facing investment appraisal only)
      case "brief_five_case":
      case "act":
        return <BriefFiveCaseRecipe artifact={artifact} />;
      // Evidence panel (JARVIS / CICERONE / HYVE)
      case "evidence_panel":
        return <EvidencePanelRecipe artifact={artifact} />;
      // DIAGNOSE — gap analysis
      case "diagnose":
      case "cpc_evidence_gaps":
        return <DiagnoseSurface artifact={artifact} compact={compact} />;
      // Stats / scenario
      case "stats_dashboard":
        return <StatsDashboardRecipe artifact={artifact} />;
      case "scenario_stress_test":
        return <ScenarioStressTestRecipe artifact={artifact} />;
      // ORIENT — landscape exploration, capability assessment, market alignment
      case "orient":
      case "cpc_capability_assessment":
      case "cpc_market_alignment":
        return <OrientSurface artifact={artifact} compact={compact} />;
      // CONNECT — opportunity fit / portfolio comparison / funding flow
      case "connect":
      case "cpc_opportunity_fit":
      case "cpc_portfolio_comparison":
      case "cpc_funding_flow":
        return <ConnectSurface artifact={artifact} compact={compact} />;
      // DEFEND
      case "defend":
      case "cpc_defend":
        return <DefendSurface artifact={artifact} />;
      default:
        return null;
    }
  })();

  if (!surface) return null;

  const headlineText =
    artifact.headline ||
    decisionSpine?.decision ||
    undefined;

  const insightText =
    artifact.insight_card ||
    (artifact.analysis && artifact.analysis.length > 30 ? artifact.analysis : undefined);

  const confidenceStyles = getConfidenceStyles(artifact.confidence_tier);

  // Showcase: full-width visuals, hide redundant surface body when blocks present
  const hideSurfaceBody = compact;

  return (
    <div
      className={cn(
        showcase ? "space-y-6 p-2" : "space-y-4 rounded-xl border border-border p-1",
        confidenceStyles.container,
        !showcase && confidenceStyles.border,
      )}
      data-testid={showcase ? "recipe-view-showcase" : "recipe-view"}
    >
      {/* Principle 1 — headline first, always */}
      {headlineText && (
        <SurfaceHeadline
          text={headlineText}
          tier={artifact.confidence_tier}
          label={recipe.replace(/_/g, " ")}
          className={showcase ? "text-lg" : undefined}
        />
      )}

      {/* Insight card — why the headline is true */}
      {insightText && (
        <InsightCard
          text={insightText}
          tier={artifact.confidence_tier}
          showcase={showcase}
        />
      )}

      {/* Decision spine — only when no dedicated headline field */}
      {decisionSpine && !artifact.headline && !insightText && (
        <DecisionSpineCard spine={decisionSpine} />
      )}

      {/* Dominant visuals — before surface body (Principle 1 waterfall) */}
      {hasVisualBlocks && (
        <BlocksView blocks={displayBlocks} showcase={showcase} />
      )}

      {/* Mode surface — collapsed in showcase when blocks carry the exhibit */}
      {!hideSurfaceBody && (
      <div className={hasVisualBlocks ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 lg:grid-cols-3 gap-4"}>
        <div className={hasVisualBlocks ? "rounded-xl border border-border bg-card overflow-hidden" : "lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden"}>
          {surface}
        </div>
        {!hasVisualBlocks && !showcase && (
          <div className="lg:col-span-1">
            <TrustRail artifact={artifact} />
          </div>
        )}
      </div>
      )}

      {/* Showcase: actions-only strip when surface body hidden */}
      {hideSurfaceBody && (
        <div className="flex justify-end pt-2" data-testid="showcase-actions">
          {surface}
        </div>
      )}

      {/* Inline citations — collapsed strip last (Principle 1) */}
      {artifact.corpus_citations && artifact.corpus_citations.length > 0 && !showcase && (
        <details className="rounded-xl border border-border bg-card overflow-hidden group">
          <summary className="px-3 py-2 border-b border-border bg-muted/20 cursor-pointer list-none flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {artifact.corpus_citations.length} verified sources
            </span>
            <span className="text-[10px] text-muted-foreground group-open:hidden">Show →</span>
          </summary>
          <div className="divide-y divide-border/60">
            {artifact.corpus_citations.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 px-3 py-2">
                {c.score != null && (
                  <span className="text-[10px] font-mono text-muted-foreground w-8 shrink-0 tabular-nums pt-0.5">
                    {Math.round(c.score * 100)}%
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-1">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">{c.organisation ?? c.publisher ?? ""}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brief view (ATLAS) — legacy fallback for lowercase section keys
// ---------------------------------------------------------------------------

function BriefView({ artifact }: { artifact: ArtifactBlock }) {
  const sections = artifact.sections ?? {};
  const sectionOrder = [
    "strategic",
    "economic",
    "commercial",
    "financial",
    "management",
  ];
  const sectionLabels: Record<string, string> = {
    strategic: "Strategic Case",
    economic: "Economic Case",
    commercial: "Commercial Case",
    financial: "Financial Case",
    management: "Management Case",
  };

  return (
    <div data-testid="brief-view">
      <NpvCard
        npvValue={artifact.npv_value}
        discountRate={artifact.discount_rate}
        optimismBias={artifact.optimism_bias}
      />

      <div className="space-y-2">
        {sectionOrder.map((key, i) => (
          <SectionItem
            key={key}
            title={sectionLabels[key]}
            content={sections[key] ?? ""}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      {artifact.corpus_citations && artifact.corpus_citations.length > 0 && (
        <CorpusCitationsList citations={artifact.corpus_citations} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence view (JARVIS, CICERONE, HYVE)
// ---------------------------------------------------------------------------

function EvidenceView({ artifact }: { artifact: ArtifactBlock }) {
  return (
    <div data-testid="evidence-view">
      {/* Transferability score (CICERONE only) */}
      {artifact.transferability_score != null && (
        <TransferabilityScore score={artifact.transferability_score} />
      )}

      {/* Transport mode (HYVE only) */}
      {artifact.transport_mode && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground bg-muted/40">
          <span className="text-muted-foreground">Mode:</span>
          {artifact.transport_mode}
        </div>
      )}

      {/* Sector analogues (CICERONE only) */}
      {artifact.sector_analogues && artifact.sector_analogues.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Sector Analogues
          </h3>
          <ul className="space-y-1">
            {artifact.sector_analogues.map((a, i) => (
              <li
                key={i}
                className="text-xs text-foreground bg-muted/30 rounded px-2.5 py-1.5 border border-border"
              >
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analysis */}
      {artifact.analysis && (
        <div className="mb-4">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Analysis
          </h3>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {artifact.analysis}
          </p>
        </div>
      )}

      {/* Evidence gaps (CICERONE only) */}
      {artifact.evidence_gaps && (
        <EvidenceGapsList gaps={artifact.evidence_gaps} />
      )}

      {/* Corpus citations */}
      {artifact.corpus_citations && artifact.corpus_citations.length > 0 && (
        <CorpusCitationsList citations={artifact.corpus_citations} />
      )}

      {/* HIVE citations (HYVE only) */}
      {artifact.hive_citations && artifact.hive_citations.length > 0 && (
        <HiveCitationsList citations={artifact.hive_citations} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton({ statusText }: { statusText?: string }) {
  return (
    <div data-testid="artifact-loading" className="space-y-3 animate-pulse">
      <div className="h-20 rounded-xl bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-24 rounded-lg bg-muted" />
      {statusText && (
        <p className="text-[11px] text-muted-foreground text-center pt-1 not-animate-pulse">{statusText}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ activeAgent }: { activeAgent: string }) {
  return (
    <div
      data-testid="artifact-empty"
      className="text-sm text-muted-foreground text-center mt-12"
    >
      <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p className="font-medium mb-1">No artifact yet</p>
      <p className="text-xs max-w-xs mx-auto">
        Send a message to{" "}
        <strong className="text-foreground">{activeAgent}</strong> — the
        structured output will appear here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Save brief button
// ---------------------------------------------------------------------------

function SaveBriefButton({
  artifact,
  decisionSpine,
  surface,
}: {
  artifact: ArtifactBlock | null;
  decisionSpine: import("@/lib/atlas5/types").DecisionSpine | null;
  surface: { active_agent: string; active_lens: string; thread_id: string | null };
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!artifact) return null;

  const handleSave = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/atlas5/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          decision_spine: decisionSpine ?? undefined,
          thread_id: surface.thread_id ?? undefined,
          agent: surface.active_agent,
          lens: surface.active_lens,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={status === "saving"}
      className={[
        "h-7 rounded-md px-3 text-xs font-medium transition-colors",
        status === "saved"
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : status === "error"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-primary/10 text-primary hover:bg-primary/20",
        status === "saving" ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      title="Save this brief to atlas.briefs"
    >
      {status === "saving"
        ? "Saving…"
        : status === "saved"
          ? "✓ Saved"
          : status === "error"
            ? "✗ Error"
            : "Save brief"}
    </button>
  );
}

export function ArtifactPane() {
  const { surface, setMode } = useSurfaceGateway();
  const isShowcase = surface.mode === "showcase";
  const { artifact, decisionSpine, isLoading, statusText, reasoningTrace, setArtifact, setDecisionSpine } = useArtifactStore();

  // ── Brief persistence ───────────────────────────────────────────────────
  // Auto-load: when a thread_id is set and the pane is empty, fetch the most
  // recent saved brief for that thread and hydrate the store.
  const loadedThreadRef = useRef<string | null>(null);
  useEffect(() => {
    const tid = surface.thread_id;
    if (!tid || artifact || loadedThreadRef.current === tid) return;
    loadedThreadRef.current = tid;
    fetch(`/api/atlas5/brief?thread_id=${encodeURIComponent(tid)}&limit=1`)
      .then((r) => r.json())
      .then((data: { ok: boolean; briefs?: Array<{ id: string; artifact_json: ArtifactBlock; decision_spine?: import("@/lib/atlas5/types").DecisionSpine; confidence_tier?: ConfidenceTier }> }) => {
        if (!data.ok || !data.briefs?.length) return;
        const saved = data.briefs[0];
        if (saved.artifact_json) setArtifact(saved.artifact_json);
        if (saved.decision_spine) setDecisionSpine(saved.decision_spine);
      })
      .catch(() => {});
  }, [surface.thread_id, artifact, setArtifact, setDecisionSpine]);

  // Auto-save: debounced 3 s after a new artifact lands (agent response complete).
  // Skips if artifact is already null or thread_id is unset.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedArtifactRef = useRef<ArtifactBlock | null>(null);
  useEffect(() => {
    if (!artifact || !surface.thread_id) return;
    if (artifact === lastSavedArtifactRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      lastSavedArtifactRef.current = artifact;
      fetch("/api/atlas5/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          decision_spine: decisionSpine ?? undefined,
          thread_id: surface.thread_id,
          agent: surface.active_agent,
          lens: surface.active_lens,
        }),
      }).catch(() => {});
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [artifact, decisionSpine, surface]);

  const agentLabel = artifact?.agent ?? surface.active_agent;

  const RECIPE_LABELS: Record<string, string> = {
    brief_five_case:           "Investment Brief",
    act:                       "Investment Brief",
    evidence_panel:            "Evidence",
    diagnose:                  "Evidence Gaps",
    stats_dashboard:           "Data Analysis",
    scenario_stress_test:      "Scenario",
    orient:                    "Innovation Landscape",
    cpc_capability_assessment: "Capability Assessment",
    cpc_market_alignment:      "Market Alignment",
    connect:                   "Opportunity Fit",
    cpc_opportunity_fit:       "Opportunity Fit",
    cpc_portfolio_comparison:  "Portfolio Comparison",
    cpc_funding_flow:          "Funding Flow",
    cpc_evidence_gaps:         "Evidence Gaps",
    defend:                    "Defend",
    cpc_defend:                "Defend",
  };

  const typeLabel = artifact?.recipe
    ? (RECIPE_LABELS[artifact.recipe] ?? artifact.recipe)
    : artifact?.type === "brief"
      ? "Brief"
      : artifact?.type === "evidence"
        ? "Evidence"
        : "Artifact";

  return (
    <section
      data-testid="artifact-pane"
      aria-label="Artifact"
      className="flex flex-col h-full bg-background"
    >
      {/* ----------------------------------------------------------------
          Header
      ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground shrink-0">
            {typeLabel}
          </span>
          {artifact && (
            <span className="text-xs text-muted-foreground shrink-0">
              {agentLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {artifact?.citation_guard && (
            <CitationGuardBadge guard={artifact.citation_guard} />
          )}
          {artifact && <ConfidenceBadge tier={artifact.confidence_tier} />}
          <span className="text-xs text-muted-foreground">
            {surface.active_lens} lens
          </span>
          <SaveBriefButton
            artifact={artifact}
            decisionSpine={decisionSpine}
            surface={surface}
          />
          <button
            type="button"
            onClick={() => setMode(isShowcase ? "chat" : "showcase")}
            data-testid="showcase-mode-toggle"
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-colors",
              isShowcase
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
            title="Toggle demo showcase layout"
          >
            {isShowcase ? "Workspace" : "Showcase"}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------
          Content
      ---------------------------------------------------------------- */}
      {/* Live run progress + progressive build banner */}
      {(isLoading || reasoningTrace.length > 0) && (
        <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/10 space-y-2">
          <RunProgress steps={reasoningTrace} active={isLoading} />
          {isLoading && artifact?.runStage && artifact.runStage !== "complete" && (
            <p className="text-[10px] text-muted-foreground">
              Building artifact
              {artifact.runStage === "search" && artifact.corpus_citations?.length
                ? ` · ${artifact.corpus_citations.length} sources found`
                : ""}
              {artifact.runStage === "build" && artifact.headline
                ? " · headline ready"
                : ""}
              …
            </p>
          )}
        </div>
      )}

      {/* Verifying banner — legacy status line when loading without RunProgress steps */}
      {isLoading && artifact && reasoningTrace.length === 0 && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40">
          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
            {statusText ?? "Verifying citations…"}
          </p>
        </div>
      )}

      {artifact?.artifact_qa && !isLoading && (
        <ArtifactQAPanel artifact={artifact} />
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && !artifact ? (
          <div className="space-y-3">
            <RunProgress steps={reasoningTrace} active />
            <LoadingSkeleton statusText={statusText} />
          </div>
        ) : !artifact ? (
          <EmptyState activeAgent={surface.active_agent} />
        ) : detectRecipe(artifact) !== null ? (
          // Recipe router: explicit recipe or inferred from Title Case sections / type
          <RecipeView artifact={artifact} decisionSpine={decisionSpine} showcase={isShowcase} />
        ) : artifact.type === "brief" ? (
          // Legacy fallback: lowercase section keys from pre-recipe agents
          <BriefView artifact={artifact} />
        ) : (
          <EvidenceView artifact={artifact} />
        )}
      </div>
    </section>
  );
}
