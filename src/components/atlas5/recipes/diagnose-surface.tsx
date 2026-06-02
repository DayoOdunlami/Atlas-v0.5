"use client";

/**
 * DiagnoseSurface — DIAGNOSE recipe
 *
 * Gold-standard pattern:
 *   1. Bold verdict — "apply only if X; otherwise reposition as Y"
 *   2. Gap matrix — criterion | response | claim state | fit | evidence strength
 *   3. Evidence gaps — what's missing + why it matters + specific action
 *   4. Value translation — travels as-is / needs reframe / not credible
 *   5. Entry friction chips
 *   6. Recommended move card — MoveBadge + rationale + key assumption
 *   7. Action → Build Five Case
 */

import { useState } from "react";
import Markdown from "react-markdown";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import {
  SurfaceHeadline,
  SurfaceSection,
  CitationRow,
  FitBadge,
  MoveBadge,
  EvidenceCountStrip,
  TIER_BADGE,
} from "./surface-primitives";
import { ArrowRight, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Gap row (parsed from CpcGap or sections)
// ---------------------------------------------------------------------------

interface GapRow {
  criterion: string;
  response: string;
  claim_state?: import("@/lib/atlas5/types").ClaimState;
  fit: "Met" | "Partial" | "Gap" | "Unknown";
  evidence_strength?: "Strong" | "Moderate" | "Weak" | "None";
  action?: string;
}

function parseGapRows(artifact: ArtifactBlock): GapRow[] {
  // Prefer structured gap_rows from verify_citations
  const structured = artifact.gap_rows;
  if (structured && structured.length > 0) {
    return structured.map((r) => ({
      criterion: r.criterion,
      response: r.response,
      claim_state: r.claim_state,
      fit: r.fit as GapRow["fit"],
      evidence_strength: r.evidence_strength as GapRow["evidence_strength"],
      action: r.action,
    }));
  }

  // Use cpc_gaps if the agent returned them
  const cpcGaps = (artifact as unknown as Record<string, unknown>).cpc_gaps as Array<{
    area: string; severity: string; description: string; claim_count?: number;
  }> | undefined;

  if (cpcGaps && cpcGaps.length > 0) {
    return cpcGaps.map((g) => ({
      criterion: g.area,
      response: g.description,
      fit: g.severity === "high" ? "Gap" : g.severity === "medium" ? "Partial" : "Met",
      evidence_strength: g.claim_count && g.claim_count > 0 ? "Weak" : "None",
      claim_state: g.severity === "high" ? "unknown" : "inferred",
    }));
  }

  // Fall back to corpus citations as gap evidence
  const citations = artifact.corpus_citations ?? [];
  if (citations.length === 0) return [];

  return citations.slice(0, 6).map((c) => ({
    criterion: c.title,
    response: c.relevance_note ?? c.organisation ?? "",
    fit: c.claim_state === "stated" ? "Met" : c.claim_state === "inferred" ? "Partial" : "Gap",
    evidence_strength: c.score != null ? (c.score > 0.7 ? "Strong" : c.score > 0.5 ? "Moderate" : "Weak") : "None",
    claim_state: c.claim_state,
  }));
}

// ---------------------------------------------------------------------------
// Gap matrix table
// ---------------------------------------------------------------------------

function GapMatrix({ rows }: { rows: GapRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto" data-testid="diagnose-gap-matrix">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium w-1/4">Criterion</th>
            <th className="text-left py-2 pr-3 font-medium">Response</th>
            <th className="text-left py-2 pr-2 font-medium w-16">State</th>
            <th className="text-left py-2 pr-2 font-medium w-16">Fit</th>
            <th className="text-left py-2 font-medium w-16">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3 text-foreground font-medium align-top">{row.criterion}</td>
              <td className="py-2 pr-3 text-muted-foreground align-top">{row.response}</td>
              <td className="py-2 pr-2 align-top">
                {row.claim_state && (
                  <ClaimStateBadge state={row.claim_state} showLabel={false} />
                )}
              </td>
              <td className="py-2 pr-2 align-top">
                <FitBadge fit={row.fit} />
              </td>
              <td className="py-2 align-top">
                <span className={cn(
                  "text-[10px] font-medium",
                  row.evidence_strength === "Strong" ? "text-emerald-600 dark:text-emerald-400" :
                  row.evidence_strength === "Moderate" ? "text-blue-600 dark:text-blue-400" :
                  row.evidence_strength === "Weak" ? "text-amber-600 dark:text-amber-400" :
                  "text-muted-foreground",
                )}>
                  {row.evidence_strength ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Critical gaps list
// ---------------------------------------------------------------------------

function CriticalGaps({ rows }: { rows: GapRow[] }) {
  const gaps = rows.filter((r) => r.fit === "Gap");
  if (gaps.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="diagnose-critical-gaps">
      {gaps.map((g, i) => (
        <div key={i} className="rounded-lg border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">{g.criterion}</p>
              <p className="text-xs text-muted-foreground">{g.response}</p>
              {g.action && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <ArrowRight className="size-3 shrink-0" /> {g.action}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value translation section
// ---------------------------------------------------------------------------

function ValueTranslationSection({ sections }: { sections: Record<string, string> }) {
  const content = sections["Value Translation"] ?? sections["value_translation"];
  if (!content) return null;

  // Try to parse ✓ ~ ✗ structure from markdown
  const lines = content.split("\n").filter((l) => l.trim());
  const travels  = lines.filter((l) => l.includes("✓") || l.toLowerCase().includes("travels"));
  const reframe  = lines.filter((l) => l.includes("→") || l.toLowerCase().includes("reframe"));
  const notYet   = lines.filter((l) => l.includes("✗") || l.toLowerCase().includes("not credible") || l.toLowerCase().includes("not yet"));

  if (travels.length === 0 && reframe.length === 0 && notYet.length === 0) {
    // Fall back to markdown render
    return (
      <div className="text-xs text-muted-foreground leading-relaxed prose prose-xs prose-slate dark:prose-invert max-w-none">
        <Markdown>{content}</Markdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {travels.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle className="size-3" /> Travels as-is
          </p>
          {travels.map((l, i) => (
            <p key={i} className="text-xs text-muted-foreground ml-4">{l.replace(/✓/g, "").trim()}</p>
          ))}
        </div>
      )}
      {reframe.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <ArrowRight className="size-3" /> Needs reframe
          </p>
          {reframe.map((l, i) => (
            <p key={i} className="text-xs text-muted-foreground ml-4">{l.replace(/→/g, "").trim()}</p>
          ))}
        </div>
      )}
      {notYet.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1">
            <XCircle className="size-3" /> Not yet credible
          </p>
          {notYet.map((l, i) => (
            <p key={i} className="text-xs text-muted-foreground ml-4">{l.replace(/✗/g, "").trim()}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry friction chips
// ---------------------------------------------------------------------------

function FrictionChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="diagnose-friction">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full bg-muted/60 text-muted-foreground border border-border px-2.5 py-0.5 text-[10px] font-medium"
        >
          {tag.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommended move card
// ---------------------------------------------------------------------------

function RecommendedMoveCard({
  action,
  rationale,
  sections,
}: {
  action?: string;
  rationale?: string;
  sections: Record<string, string>;
}) {
  const moveSection = sections["Recommended Move"] ?? sections["recommended_move"];
  const moveText = rationale ?? moveSection ?? "";
  const moveKey = action ?? "monitor";

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      data-testid="diagnose-recommended-move"
    >
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended Move
        </span>
        <MoveBadge move={moveKey} />
      </div>
      {moveText && (
        <p className="text-xs text-muted-foreground leading-relaxed">{moveText}</p>
      )}
      {sections["Key Assumption"] && (
        <p className="text-[10px] text-muted-foreground/70 italic border-t border-border pt-2">
          Key assumption: {sections["Key Assumption"]}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiagnoseSurface({ artifact }: { artifact: ArtifactBlock }) {
  const sections  = artifact.sections ?? {};
  const citations = artifact.corpus_citations ?? [];
  const styles    = getConfidenceStyles(artifact.confidence_tier);
  const gapRows   = parseGapRows(artifact);
  const frictionTags = ((artifact as unknown as Record<string, unknown>).entry_friction_tags as string[]) ?? [];
  const hasBlockGapMatrix = artifact.visual_blocks?.some((b) => b.type === "gap_matrix");

  const headlineText =
    artifact.headline ||
    sections["Headline"] ||
    sections["Verdict"] ||
    artifact.analysis ||
    "";

  // Extra sections to show as accordion (excluding known structured ones)
  const KNOWN_SECTIONS = new Set([
    "Headline", "Verdict", "Gap Matrix", "Value Translation",
    "Recommended Move", "Entry Friction", "Key Assumption",
  ]);
  const extraSections = Object.entries(sections).filter(([k]) => !KNOWN_SECTIONS.has(k));

  return (
    <div className={cn("space-y-0", styles.container)} data-testid="recipe-diagnose">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Diagnose
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

      <div className="p-4 space-y-4">

        {/* 1. Bold verdict — headline rendered at RecipeView level when set; repeat only if local */}
        {headlineText && !artifact.headline && (
          <SurfaceHeadline
            text={headlineText}
            tier={artifact.confidence_tier}
            label="gap analysis"
          />
        )}

        {/* 2. Gap matrix — skip when art director block already shown */}
        {gapRows.length > 0 && !hasBlockGapMatrix && (
          <SurfaceSection
            title="Gap matrix"
            preview={`${gapRows.filter((r) => r.fit === "Gap").length} gaps · ${gapRows.filter((r) => r.fit === "Met").length} met · ${gapRows.filter((r) => r.fit === "Partial").length} partial`}
            defaultOpen={false}
            testId="diagnose-gap-section"
          >
            <GapMatrix rows={gapRows} />
          </SurfaceSection>
        )}

        {/* 3. Critical gaps — red callouts for Gap rows */}
        {gapRows.some((r) => r.fit === "Gap") && (
          <SurfaceSection
            title="Evidence gaps — what's missing and why it matters"
            defaultOpen={false}
            testId="diagnose-critical-section"
          >
            <CriticalGaps rows={gapRows} />
          </SurfaceSection>
        )}

        {/* 4. Value translation */}
        {(sections["Value Translation"] || sections["value_translation"]) && (
          <SurfaceSection
            title="Value translation"
            preview="What travels as-is, what needs reframing, what's not yet credible"
            testId="diagnose-value-section"
          >
            <ValueTranslationSection sections={sections} />
          </SurfaceSection>
        )}

        {/* 5. Entry friction */}
        {frictionTags.length > 0 && (
          <SurfaceSection title="Entry friction" testId="diagnose-friction-section">
            <FrictionChips tags={frictionTags} />
          </SurfaceSection>
        )}

        {/* 6. Evidence strip — collapsed; full list at RecipeView level */}
        {citations.length > 0 && (
          <SurfaceSection
            title={`${citations.length} verified sources`}
            preview={`${citations.filter((c) => c.claim_state === "stated").length} stated · ${citations.filter((c) => c.claim_state === "inferred").length} inferred`}
            defaultOpen={false}
            testId="diagnose-evidence-section"
          >
            <div className="divide-y divide-border">
              {citations.map((c) => <CitationRow key={c.id} citation={c} />)}
            </div>
          </SurfaceSection>
        )}

        {/* 7. Extra sections from agent */}
        {extraSections.map(([heading, content]) => (
          <SurfaceSection key={heading} title={heading} testId={`diagnose-section-${heading}`}>
            <div className="text-xs text-muted-foreground leading-relaxed prose prose-xs prose-slate dark:prose-invert max-w-none">
              <Markdown>{content}</Markdown>
            </div>
          </SurfaceSection>
        ))}

        {/* 8. Recommended move */}
        <RecommendedMoveCard
          action={artifact.recommendation_action}
          rationale={artifact.recommendation_rationale}
          sections={sections}
        />

        {/* 9. Action */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            onClick={() => console.info("[STUB] Build Five Case from Diagnose")}
          >
            Build Five Case for this <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
