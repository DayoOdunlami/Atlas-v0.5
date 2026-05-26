"use client";

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type {
  AtlasRoutingGap,
  AvailableTool,
  ConfidenceTier,
  CorpusCitation,
  ExternalCitation,
  RoutingLane,
  RoutingProvider,
  SourceType,
} from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";

const TIER_BAR: Record<ConfidenceTier, { width: string; color: string }> = {
  Speculative: { width: "w-1/4", color: "bg-red-400" },
  Indicative: { width: "w-2/4", color: "bg-amber-400" },
  Supported: { width: "w-3/4", color: "bg-blue-400" },
  Robust: { width: "w-full", color: "bg-green-400" },
};

// ---------------------------------------------------------------------------
// Citation display helpers
// ---------------------------------------------------------------------------

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

function CitationRow({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const dot = c.source_type ? SOURCE_DOT[c.source_type] : "bg-muted-foreground";
  const label = c.source_type ? SOURCE_LABEL[c.source_type] : null;

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20">
      <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {label && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
              <span className="text-muted-foreground">{label}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {c.organisation ?? c.funder ?? c.publisher ?? ""}
          </span>
        </div>
        <span className="text-xs font-mono text-indigo-600 shrink-0">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// External citation row
// ---------------------------------------------------------------------------

const RETRIEVAL_TOOL_LABEL: Record<ExternalCitation["retrieval_tool"], string> =
  {
    govuk_search: "GOV.UK",
    exa_search: "Exa",
  };

function ExternalCitationRow({ c }: { c: ExternalCitation }) {
  return (
    <div
      className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20"
      data-retrieval-tool={c.retrieval_tool}
    >
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium leading-snug line-clamp-2 text-blue-700 hover:underline"
      >
        {c.title}
      </a>
      {c.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {c.snippet}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          <span>{c.recommended_provider}</span>
          <span className="text-muted-foreground/50">
            via {RETRIEVAL_TOOL_LABEL[c.retrieval_tool]}
          </span>
        </div>
        <span className="text-xs text-amber-600 font-mono">review</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence gap row (ATLAS routing gaps — lane/provider/tool shape)
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<
  AtlasRoutingGap["severity"],
  { label: string; cls: string }
> = {
  low: { label: "LOW", cls: "text-muted-foreground bg-muted" },
  medium: { label: "MED", cls: "text-amber-700 bg-amber-50" },
  high: { label: "HIGH", cls: "text-red-700 bg-red-50" },
};

const GAP_TYPE_ICON: Record<AtlasRoutingGap["type"], string> = {
  retrieval_gap: "⟳",
  corpus_gap: "◌",
  landscape_gap: "◇",
};

const LANE_LABEL: Record<RoutingLane, string> = {
  internal_precedent: "Internal",
  official_policy: "Policy",
  funding: "Funding",
  procurement: "Procurement",
  research: "Research",
  market_discovery: "Market",
  ingestion_backlog: "Ingest",
};

const PROVIDER_COLOR: Partial<Record<RoutingProvider, string>> = {
  DfT: "text-blue-700",
  CCAV: "text-indigo-700",
  InnovateUK: "text-violet-700",
  UKRI: "text-purple-700",
  NationalHighways: "text-cyan-700",
  HorizonEurope: "text-sky-700",
  Exa: "text-orange-700",
  CPC_Corpus: "text-indigo-500",
};

const TOOL_LIVE: Set<AvailableTool> = new Set([
  "cpc_corpus",
  "live_calls",
  "govuk_search",
  "exa_search",
]);

function RoutingGapRow({ gap }: { gap: AtlasRoutingGap }) {
  const badge = SEVERITY_BADGE[gap.severity];
  const icon = GAP_TYPE_ICON[gap.type];
  const laneLabel = LANE_LABEL[gap.recommended_source_lane];
  const providerCls =
    PROVIDER_COLOR[gap.recommended_provider] ?? "text-muted-foreground";
  const toolIsLive = TOOL_LIVE.has(gap.available_tool);

  return (
    <div
      className="rounded-lg border border-border/60 p-2.5 space-y-1.5 bg-muted/10"
      data-gap-type={gap.type}
      data-gap-lane={gap.recommended_source_lane}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug line-clamp-2 flex items-center gap-1">
          <span className="text-muted-foreground">{icon}</span>
          {gap.topic}
        </p>
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
            badge.cls,
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* Lane / Provider / Tool row */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {laneLabel}
        </span>
        <span className={cn("font-medium", providerCls)}>
          {gap.recommended_provider}
        </span>
        <span
          className={cn(
            "font-mono px-1.5 py-0.5 rounded",
            toolIsLive
              ? "bg-green-50 text-green-700"
              : "bg-muted text-muted-foreground/60",
          )}
          title={toolIsLive ? "Tool available today" : "Not yet integrated"}
        >
          {gap.available_tool}
        </span>
        {gap.can_lift_confidence && (
          <span className="text-blue-600" title="Can lift confidence tier">
            ↑tier
          </span>
        )}
        <span className="text-muted-foreground/60">{gap.citation_status}</span>
      </div>

      {/* Recommended action (truncated) */}
      <p className="text-[10px] text-muted-foreground line-clamp-2">
        {gap.recommended_action}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrustRail — main component
// ---------------------------------------------------------------------------

interface TrustRailProps {
  artifact: ArtifactBlock;
}

export function TrustRail({ artifact }: TrustRailProps) {
  const tier = artifact.confidence_tier;
  const bar = TIER_BAR[tier];
  const allCitations = artifact.corpus_citations ?? [];
  const hiveCites = artifact.hive_citations ?? [];
  const externalCites = artifact.external_citations ?? [];
  const routingGaps = artifact.routing_gaps ?? [];

  // ── Lane separation for corpus citations ──────────────────────────────
  // Internal CPC: R&D projects + live funding calls
  const internalCitations = allCitations.filter(
    (c) =>
      !c.source_type ||
      c.source_type === "project" ||
      c.source_type === "live_call",
  );
  // Official Policy: knowledge docs/chunks (DfT, CCAV, Innovate UK reports)
  const policyCitations = allCitations.filter(
    (c) =>
      c.source_type === "knowledge_doc" || c.source_type === "knowledge_chunk",
  );

  const totalVerified =
    internalCitations.length + policyCitations.length + hiveCites.length;

  return (
    <div
      data-testid="trust-rail"
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence &amp; Trust
      </p>

      {/* Confidence bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-semibold">{tier}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              bar.width,
              bar.color,
            )}
          />
        </div>
      </div>

      {/* Citation count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Verified citations</span>
        <span className="font-semibold">{totalVerified}</span>
      </div>

      {/* ── LANE 1: Internal CPC ──────────────────────────────────────────── */}
      {internalCitations.length > 0 && (
        <div className="space-y-2" data-lane="internal-cpc">
          <p className="text-xs font-medium text-muted-foreground">
            Internal CPC
          </p>
          {internalCitations.map((c) => (
            <CitationRow key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* ── LANE 2: Official policy ───────────────────────────────────────── */}
      {policyCitations.length > 0 && (
        <div className="space-y-2" data-lane="official-policy">
          <p className="text-xs font-medium text-muted-foreground">
            Official policy
          </p>
          {policyCitations.map((c) => (
            <CitationRow key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* ── HIVE articles ────────────────────────────────────────────────── */}
      {hiveCites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            HIVE articles
          </p>
          {hiveCites.map((h) => (
            <div
              key={h.article_id}
              className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20"
            >
              <p className="text-xs font-medium leading-snug line-clamp-2">
                {h.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  HIVE
                </span>
                <span className="text-xs font-mono text-indigo-600">
                  {Math.round((h.score ?? 0) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LANE 3: External web ─────────────────────────────────────────── */}
      {externalCites.length > 0 && (
        <div className="space-y-2" data-lane="external-web">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              External web
            </p>
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              needs review
            </span>
          </div>
          {externalCites.map((c, i) => (
            <ExternalCitationRow key={`${c.url}-${i}`} c={c} />
          ))}
        </div>
      )}

      {/* ── LANE 4: Evidence gaps ─────────────────────────────────────────── */}
      {routingGaps.length > 0 && (
        <div className="space-y-2" data-lane="evidence-gaps">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Evidence gaps
            </p>
            <span className="text-[10px] text-muted-foreground">
              {routingGaps.length}
            </span>
          </div>
          {routingGaps.map((gap, i) => (
            <RoutingGapRow key={`${gap.type}-${i}`} gap={gap} />
          ))}
        </div>
      )}

      {totalVerified === 0 && routingGaps.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No verified citations yet. Ask the agent to search for evidence.
        </p>
      )}
    </div>
  );
}
