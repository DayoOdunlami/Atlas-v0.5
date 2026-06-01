"use client";

/**
 * EvidencePanelRecipe — DIAGNOSE surface
 *
 * Structure:
 * 1. HeadlineCard — primary recommendation (always visible)
 * 2. Gap matrix — Criterion | Response | Claim state | Fit | Evidence
 * 3. Value Translation (collapsible) — as-is / needs reframe / not credible
 * 4. Entry friction chips
 * 5. Recommended Move badge + assumptions + what_would_change
 * 6. Escalation: "Build the Five Case for this →" [FRONTEND]
 * 7. Defend Pack (deeply collapsed)
 */

import { useState } from "react";

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { CorpusCitation, SourceType } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

const SOURCE_BADGE: Record<SourceType, { label: string; style: string }> = {
  project:        { label: "R&D Project", style: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700" },
  live_call:      { label: "Open Call",   style: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700" },
  knowledge_doc:  { label: "Policy",      style: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700" },
  knowledge_chunk: { label: "Policy",     style: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700" },
  hive_chunk:     { label: "HIVE",        style: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700" },
  hive_article:   { label: "HIVE",        style: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700" },
};

function SourceBadge({ type }: { type?: SourceType }) {
  const badge = type ? SOURCE_BADGE[type] : null;
  if (!badge) return null;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", badge.style)}>
      {badge.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeadlineCard
// ---------------------------------------------------------------------------

function HeadlineCard({
  summary,
  styles,
}: {
  summary?: string;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  return (
    <div
      data-testid="diagnose-headline-card"
      className={cn("rounded-lg border p-3.5 bg-muted/20", styles.border)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        Primary Recommendation
      </p>
      {summary ? (
        <p className={cn("text-sm leading-relaxed text-foreground", styles.body)}>
          {summary}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Ask the agent to diagnose fit against a specific criterion set.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gap matrix
// ---------------------------------------------------------------------------

type FitStatus = "Met" | "Partial" | "Gap" | "Unknown";

const FIT_STYLE: Record<FitStatus, { cell: string; label: string }> = {
  Met:     { cell: "bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800",   label: "text-teal-700 dark:text-teal-300" },
  Partial: { cell: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", label: "text-amber-700 dark:text-amber-300" },
  Gap:     { cell: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",       label: "text-red-700 dark:text-red-300" },
  Unknown: { cell: "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",   label: "text-slate-500 dark:text-slate-400" },
};

interface GapRow {
  criterion: string;
  response: string;
  claim_state: ArtifactBlock["corpus_citations"] extends (infer C)[] | undefined
    ? C extends { claim_state?: infer S } ? S : never
    : never;
  claim_rationale?: string;
  fit: FitStatus;
  evidence_count: number;
}

function GapMatrixTable({
  gaps,
  styles,
}: {
  gaps: GapRow[];
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  if (gaps.length === 0) return null;

  return (
    <div data-testid="diagnose-gap-matrix" className={cn("space-y-2", styles.body)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Gap Matrix
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground font-normal w-1/3">
                Criterion
              </th>
              <th className="text-left py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground font-normal">
                Response
              </th>
              <th className="text-center py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground font-normal w-20">
                State
              </th>
              <th className="text-center py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground font-normal w-16">
                Fit
              </th>
              <th className="text-right py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground font-normal w-12">
                Srcs
              </th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((row, i) => {
              const fitStyle = FIT_STYLE[row.fit];
              return (
                <tr key={i} className={cn("border-b border-border/50", fitStyle.cell)}>
                  <td className="py-2 pr-3 font-medium text-foreground align-top">
                    {row.criterion}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground align-top">
                    {row.response}
                  </td>
                  <td className="py-2 pr-3 text-center align-top">
                    {row.claim_state ? (
                      <ClaimStateBadge
                        state={row.claim_state as import("@/lib/atlas5/types").ClaimState}
                        rationale={row.claim_rationale}
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-center align-top">
                    <span className={cn("text-[10px] font-semibold", fitStyle.label)}>
                      {row.fit}
                    </span>
                  </td>
                  <td className="py-2 text-right text-muted-foreground font-mono align-top">
                    {row.evidence_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry friction chips
// ---------------------------------------------------------------------------

const FRICTION_STYLE: Record<string, string> = {
  consortium_required:         "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  commercial_deployment_evidence: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  evidence_gap:                "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rural_delivery_track_record: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  industry_match_30pct:        "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  international_consortium:    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  eligibility_uncertain:       "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const FRICTION_LABELS: Record<string, string> = {
  consortium_required:         "Consortium required",
  commercial_deployment_evidence: "Commercial deployment evidence needed",
  evidence_gap:                "Evidence gap — enrich first",
  rural_delivery_track_record: "Rural delivery track record required",
  industry_match_30pct:        "30% industry match",
  international_consortium:    "International consortium required",
  eligibility_uncertain:       "Eligibility uncertain",
};

function EntryFrictionChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div data-testid="diagnose-entry-friction" className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Entry Friction
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            title={FRICTION_LABELS[tag] ?? tag}
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
              FRICTION_STYLE[tag] ?? "bg-muted text-muted-foreground",
            )}
          >
            {FRICTION_LABELS[tag] ?? tag.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommended Move badge
// ---------------------------------------------------------------------------

type MoveType =
  | "apply_now"
  | "reposition"
  | "evidence_build"
  | "seek_partner"
  | "monitor"
  | "stop"
  | "escalate";

const MOVE_STYLE: Record<MoveType, { bg: string; label: string }> = {
  apply_now:      { bg: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700", label: "Apply Now" },
  reposition:     { bg: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",                 label: "Reposition" },
  evidence_build: { bg: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",           label: "Build Evidence" },
  seek_partner:   { bg: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700",     label: "Seek Partner" },
  monitor:        { bg: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",              label: "Monitor" },
  stop:           { bg: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700",                       label: "Stop" },
  escalate:       { bg: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700",     label: "Escalate" },
};

function RecommendedMoveSection({
  moveType,
  rationale,
  whatWouldChange,
  styles,
}: {
  moveType?: MoveType;
  rationale?: string;
  whatWouldChange?: string;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  if (!moveType) return null;
  const style = MOVE_STYLE[moveType] ?? MOVE_STYLE.monitor;

  return (
    <div data-testid="diagnose-recommended-move" className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Recommended Move
      </p>
      <div className={cn("rounded-lg border p-3", styles.border, "bg-muted/10")}>
        <span
          className={cn(
            "inline-flex items-center rounded border px-2.5 py-1 text-xs font-bold mb-2",
            style.bg,
          )}
        >
          {style.label}
        </span>
        {rationale && (
          <p className={cn("text-xs leading-relaxed", styles.body)}>{rationale}</p>
        )}
        {whatWouldChange && (
          <p className="text-[10px] text-muted-foreground mt-1.5 italic">
            Would change if: {whatWouldChange}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escalation: "Build the Five Case for this →" [FRONTEND]
// ---------------------------------------------------------------------------

function EscalationAction({
  onEscalate,
}: {
  onEscalate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscalate}
      data-testid="diagnose-escalate-five-case"
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
    >
      Build the Five Case for this
      <ArrowRight className="size-3" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Defend Pack (deeply collapsed)
// ---------------------------------------------------------------------------

function DefendPack({ citations }: { citations: CorpusCitation[] }) {
  const [open, setOpen] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div data-testid="diagnose-defend-pack" className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        {open ? "Hide evidence trail ↑" : "Show evidence trail →"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {citations.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
                  <SourceBadge type={c.source_type} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {c.organisation ?? c.publisher ?? c.funder ?? ""}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {c.claim_state && (
                      <ClaimStateBadge
                        state={c.claim_state}
                        rationale={c.claim_rationale}
                        showLabel={false}
                      />
                    )}
                    {c.score != null && <ScoreBar score={c.score} />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  artifact: ArtifactBlock;
}

export function EvidencePanelRecipe({ artifact }: Props) {
  const citations = artifact.corpus_citations ?? [];
  const sections = artifact.sections ?? {};
  const contextKey = Object.keys(sections)[0];
  const summaryText = contextKey ? sections[contextKey] : undefined;

  const styles = getConfidenceStyles(artifact.confidence_tier);

  // Extract structured data from evidence panel fields (typed via unknown cast)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra = artifact as any;
  const gapRows: GapRow[] = extra.diagnose_gaps ?? [];
  const frictionTags: string[] = extra.entry_friction_tags ?? [];
  const moveType: MoveType | undefined = extra.move_type;
  const moveRationale: string | undefined = extra.move_rationale;
  const whatWouldChange: string | undefined = extra.what_would_change;

  const handleEscalateFiveCase = () => {
    // [FRONTEND] — switch surface_state to recipe=act, pass current citations as context
    // In the real app: useSurfaceGateway().setMode → push to act surface with pre-loaded citations
    console.info("[FRONTEND] Escalate to Five Case — wire to surface gateway");
    window.alert("[Demo] Escalation to Five Case wired at surface gateway level — no backend needed.");
  };

  return (
    <div
      className={cn("space-y-1", styles.container)}
      data-testid="recipe-evidence-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence — DIAGNOSE
        </span>
        <span
          data-testid="confidence-tier-badge"
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            styles.badge,
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. Headline */}
        <HeadlineCard summary={summaryText} styles={styles} />

        {/* 2. Gap matrix */}
        {gapRows.length > 0 && (
          <GapMatrixTable gaps={gapRows} styles={styles} />
        )}

        {/* 3. Value Translation — if no structured gaps, show citation cards */}
        {gapRows.length === 0 && citations.length > 0 && (
          <CollapsibleValueTranslation citations={citations} styles={styles} />
        )}

        {/* 4. Entry friction */}
        {frictionTags.length > 0 && (
          <EntryFrictionChips tags={frictionTags} />
        )}

        {/* 5. Recommended move */}
        {moveType && (
          <RecommendedMoveSection
            moveType={moveType}
            rationale={moveRationale}
            whatWouldChange={whatWouldChange}
            styles={styles}
          />
        )}

        {/* 6. Escalation */}
        <EscalationAction onEscalate={handleEscalateFiveCase} />

        {/* 7. Defend Pack */}
        <DefendPack citations={citations} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value Translation (collapsible — shows when no structured gap rows)
// ---------------------------------------------------------------------------

function CollapsibleValueTranslation({
  citations,
  styles,
}: {
  citations: CorpusCitation[];
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded-lg border", styles.border)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        data-testid="diagnose-value-translation-toggle"
        aria-expanded={open}
      >
        <span className={cn("text-xs font-medium", styles.body)}>
          Value translation — {citations.length} source{citations.length !== 1 ? "s" : ""}
        </span>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-2">
          {citations.map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-border bg-card p-3 space-y-1.5 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-snug flex-1 line-clamp-2">
                  {c.title}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <SourceBadge type={c.source_type} />
                  {c.claim_state && (
                    <ClaimStateBadge
                      state={c.claim_state}
                      rationale={c.claim_rationale}
                      showLabel={false}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                  {c.organisation ?? c.publisher ?? c.funder ?? ""}
                </span>
                {c.score != null && <ScoreBar score={c.score} />}
              </div>
              {c.source_type === "live_call" && c.deadline && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Deadline: {c.deadline}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
