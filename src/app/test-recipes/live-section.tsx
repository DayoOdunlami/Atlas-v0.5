"use client";

/**
 * CPC Live Intelligence Section
 * Fetches from /api/atlas5/cpc-intelligence and renders all four CPC recipes
 * with real data from the ingested CPC Capability Corpus v0.1.
 *
 * Shown below the static mock data on /test-recipes.
 */

import { useState } from "react";
import { ArtifactPanel } from "@/components/dashboard/layout/artifact-panel";
import { TrustRail } from "@/components/dashboard/layout/trust-rail";
import { DecisionSpineCard } from "@/components/dashboard/layout/decision-spine";
import type { ArtifactBlock, DecisionSpine, ConfidenceTier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types for the API response
// ---------------------------------------------------------------------------

interface CpcIntelligenceResponse {
  ok: boolean;
  error?: string;
  corpus_tag?: string;
  generated_at?: string;
  counts?: {
    containers: number;
    claims: number;
    business_units: number;
    gaps: number;
    verified_claims: number;
  };
  overall_confidence_tier?: ConfidenceTier;
  corpus_citations?: ArtifactBlock["corpus_citations"];
  cpc_claims?: ArtifactBlock["cpc_claims"];
  cpc_portfolio?: ArtifactBlock["cpc_portfolio"];
  cpc_gaps?: ArtifactBlock["cpc_gaps"];
  summary?: string;
}

// ---------------------------------------------------------------------------
// Build artifact blocks from live data
// ---------------------------------------------------------------------------

function buildCapabilityArtifact(data: CpcIntelligenceResponse): ArtifactBlock {
  return {
    type: "brief",
    recipe: "cpc_capability_assessment",
    confidence_tier: data.overall_confidence_tier ?? "Speculative",
    sections: { Summary: data.summary ?? "" },
    corpus_citations: data.corpus_citations ?? [],
    cpc_claims: data.cpc_claims ?? [],
    cpc_gaps: data.cpc_gaps ?? [],
  };
}

function buildPortfolioArtifact(data: CpcIntelligenceResponse): ArtifactBlock {
  const portfolio = data.cpc_portfolio ?? [];
  const topBus = portfolio.filter((b) => b.l2_claims > 0 || b.l3_claims > 0);
  const weakBus = portfolio.filter((b) => b.l2_claims === 0 && b.l3_claims === 0);
  const totalProjects = portfolio.reduce((s, b) => s + b.project_count, 0);
  const totalClaims = portfolio.reduce((s, b) => s + b.claim_count, 0);

  return {
    type: "chart",
    recipe: "cpc_portfolio_comparison",
    confidence_tier: data.overall_confidence_tier ?? "Speculative",
    sections: {
      Summary:
        `Portfolio comparison across ${portfolio.length} CPC business unit${portfolio.length !== 1 ? "s" : ""}. ` +
        `${totalProjects} project records · ${totalClaims} extracted claims. ` +
        (topBus.length > 0
          ? `Strongest evidence depth: ${topBus.map((b) => b.name).slice(0, 3).join(", ")}. `
          : "") +
        (weakBus.length > 0
          ? `L1-only (no programme or strategic claims): ${weakBus.map((b) => b.name).join(", ")}.`
          : ""),
    },
    cpc_portfolio: portfolio,
    cpc_gaps: data.cpc_gaps ?? [],
  };
}

function buildMarketAlignmentArtifact(data: CpcIntelligenceResponse): ArtifactBlock {
  // For market alignment we surface claims that are L2/L3 as the "match evidence"
  const matchClaims = (data.cpc_claims ?? []).filter(
    (c) => c.level >= 2,
  );
  return {
    type: "evidence",
    recipe: "cpc_market_alignment",
    confidence_tier: data.overall_confidence_tier ?? "Speculative",
    sections: {
      Summary:
        `${matchClaims.length} programme/strategic claims available to support a market opportunity case. ` +
        `Evidence drawn from CPC Capability Corpus v0.1 (${data.counts?.containers ?? "?"} containers).`,
    },
    corpus_citations: data.corpus_citations ?? [],
    cpc_claims: matchClaims,
    cpc_gaps: (data.cpc_gaps ?? []).filter((g) => g.severity === "high"),
  };
}

function buildEvidenceGapsArtifact(data: CpcIntelligenceResponse): ArtifactBlock {
  return {
    type: "evidence",
    recipe: "cpc_evidence_gaps",
    confidence_tier: data.overall_confidence_tier ?? "Speculative",
    sections: {
      Summary:
        `${data.cpc_gaps?.length ?? 0} evidence gap${(data.cpc_gaps?.length ?? 0) !== 1 ? "s" : ""} identified across the CPC corpus. ` +
        `${data.counts?.verified_claims ?? 0} verified claim${(data.counts?.verified_claims ?? 0) !== 1 ? "s" : ""} out of ${data.counts?.claims ?? 0} total. ` +
        `Immediate priority: promote AI-inferred claims through human review.`,
    },
    cpc_claims: data.cpc_claims ?? [],
    cpc_portfolio: data.cpc_portfolio ?? [],
    cpc_gaps: data.cpc_gaps ?? [],
  };
}

function buildSpines(data: CpcIntelligenceResponse): Record<string, DecisionSpine> {
  const tier = data.overall_confidence_tier ?? "Speculative";
  const counts = data.counts;

  return {
    capability: {
      decision: "What capability evidence does CPC have in this corpus?",
      recommendation:
        `${counts?.claims ?? "?"} claims across ${counts?.business_units ?? "?"} business units. ` +
        `${counts?.verified_claims ?? 0} verified. Overall tier: ${tier}.`,
      confidence_tier: tier,
      key_assumption:
        "Corpus coverage is representative — no major unpublished projects omitted.",
      next_action:
        counts?.verified_claims === 0
          ? "Commission an evidence review sprint to verify at least 5 L2 claims."
          : "Identify the top 3 L2/L3 claims for use in the next funding bid.",
      framework: "CPC Capability Intelligence",
    },
    portfolio: {
      decision: "Which business units are evidence-ready for 2025-26 funding bids?",
      recommendation:
        (data.cpc_portfolio ?? []).filter((b) => b.l3_claims > 0).length > 0
          ? `Units with L3 claims: ${(data.cpc_portfolio ?? []).filter((b) => b.l3_claims > 0).map((b) => b.name).join(", ")}.`
          : "No units yet have verified L3 strategic outcome claims — all are below bid-ready threshold.",
      confidence_tier: tier,
      key_assumption: "Project list is complete and not missing significant unrecorded programmes.",
      next_action:
        "Commission retrospective outcome studies for units with L1-only evidence.",
      framework: "CPC Capability Intelligence",
    },
    market: {
      decision: "Can CPC's evidence base support a market opportunity case?",
      recommendation:
        (data.cpc_claims ?? []).filter((c) => c.level >= 2).length >= 3
          ? "Sufficient L2/L3 claims to build a supporting evidence pack for a market case."
          : "Insufficient programme/strategic claims — evidence pack would need significant enrichment.",
      confidence_tier: tier,
      key_assumption: "Live funding calls align with the CPC portfolio themes represented in corpus.",
      next_action: "Match top L2 claims against current live calls in atlas.live_calls.",
      framework: "CPC Capability Intelligence",
    },
    gaps: {
      decision: "What are the highest-priority evidence gaps to close?",
      recommendation:
        (data.cpc_gaps ?? []).filter((g) => g.severity === "high").length > 0
          ? `${(data.cpc_gaps ?? []).filter((g) => g.severity === "high").length} high-severity gaps identified. Address these before the next funding round.`
          : "No high-severity gaps detected. Focus on promoting self-reported claims through verification.",
      confidence_tier: tier,
      key_assumption: "Unpublished programme evaluations exist and can be cleared for ingestion.",
      next_action: "Raise corpus ingestion request for outstanding programme evaluation reports.",
      framework: "CPC Capability Intelligence",
    },
  };
}

// ---------------------------------------------------------------------------
// Recipe block
// ---------------------------------------------------------------------------

function RecipeBlock({
  label,
  artifact,
  spine,
}: {
  label: string;
  artifact: ArtifactBlock;
  spine: DecisionSpine;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded">
          {label}
        </span>
        <span className="text-xs font-medium text-green-600">LIVE</span>
        <span className="text-xs text-muted-foreground">
          type=&quot;{artifact.type}&quot; · {artifact.confidence_tier}
        </span>
      </div>
      <DecisionSpineCard spine={spine} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ArtifactPanel artifact={artifact} />
        </div>
        <div className="lg:col-span-1">
          <TrustRail artifact={artifact} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CpcLiveSection() {
  const [data, setData] = useState<CpcIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function fetchLive(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/atlas5/cpc-intelligence${q ? `?query=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      const json = (await res.json()) as CpcIntelligenceResponse;
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const spines = data ? buildSpines(data) : null;

  return (
    <div className="space-y-8">
      {/* Header + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">
            CPC Capability Intelligence — Live Data
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fetches from <code className="font-mono text-[11px]">/api/atlas5/cpc-intelligence</code> → live
            Supabase query against <code className="font-mono text-[11px]">atlas.evidence_containers</code> +{" "}
            <code className="font-mono text-[11px]">atlas.claims</code> (corpus_tag = cpc_v0_1)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLive(query || undefined)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-48"
          />
          <button
            type="button"
            onClick={() => fetchLive(query || undefined)}
            disabled={loading}
            className="h-8 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading…" : "Load live data"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Not yet loaded */}
      {!data && !loading && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Click <strong>Load live data</strong> to fetch from the CPC corpus.
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Live recipes */}
      {data && spines && (
        <div className="space-y-2">
          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-800">
            <span>
              <strong>{data.counts?.containers ?? "?"}</strong> containers
            </span>
            <span>·</span>
            <span>
              <strong>{data.counts?.claims ?? "?"}</strong> claims
            </span>
            <span>·</span>
            <span>
              <strong>{data.counts?.business_units ?? "?"}</strong> business units
            </span>
            <span>·</span>
            <span>
              <strong>{data.counts?.verified_claims ?? 0}</strong> verified
            </span>
            <span>·</span>
            <span>
              <strong>{data.counts?.gaps ?? 0}</strong> evidence gaps
            </span>
            <span>·</span>
            <span>
              Overall: <strong>{data.overall_confidence_tier}</strong>
            </span>
            <span className="ml-auto text-green-600 font-mono">
              {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : ""}
            </span>
          </div>

          <div className="pt-4 space-y-12">
            <RecipeBlock
              label="cpc_capability_assessment · live"
              artifact={buildCapabilityArtifact(data)}
              spine={spines.capability}
            />
            <hr className="border-border" />
            <RecipeBlock
              label="cpc_portfolio_comparison · live"
              artifact={buildPortfolioArtifact(data)}
              spine={spines.portfolio}
            />
            <hr className="border-border" />
            <RecipeBlock
              label="cpc_market_alignment · live"
              artifact={buildMarketAlignmentArtifact(data)}
              spine={spines.market}
            />
            <hr className="border-border" />
            <RecipeBlock
              label="cpc_evidence_gaps · live"
              artifact={buildEvidenceGapsArtifact(data)}
              spine={spines.gaps}
            />
          </div>
        </div>
      )}
    </div>
  );
}
