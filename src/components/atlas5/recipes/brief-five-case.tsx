"use client";

/**
 * BriefFiveCaseRecipe — ACT surface (ATLAS Five Case Brief)
 *
 * Design principles:
 * 1. Scan without clicking — each section shows a 2-line preview always
 * 2. Verdict card always above the fold — one sentence recommendation + NPV
 * 3. Five-pillar scorecard with completeness signal and evidence count
 * 4. Full prose available on expand — no prose wall before it's needed
 * 5. Confidence tier drives visual weight throughout
 */

import { useState, useMemo } from "react";
import Markdown from "react-markdown";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { ConfidenceTier } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { ChevronDown, ChevronRight, ExternalLink, TrendingUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FIVE_CASE_ORDER = [
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
];

const SECTION_CONFIG: Record<string, {
  dot: string;
  bg: string;
  border: string;
  label: string;
  accent: string;
  abbr: string;
}> = {
  "Strategic Case":  { dot: "bg-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/30",  border: "border-indigo-200 dark:border-indigo-800",  label: "text-indigo-700 dark:text-indigo-300",  accent: "border-l-indigo-500",  abbr: "SC" },
  "Economic Case":   { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", label: "text-emerald-700 dark:text-emerald-300", accent: "border-l-emerald-500", abbr: "EC" },
  "Commercial Case": { dot: "bg-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-violet-200 dark:border-violet-800",  label: "text-violet-700 dark:text-violet-300",  accent: "border-l-violet-500",  abbr: "CC" },
  "Financial Case":  { dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30",    border: "border-amber-200 dark:border-amber-800",   label: "text-amber-700 dark:text-amber-300",   accent: "border-l-amber-500",   abbr: "FC" },
  "Management Case": { dot: "bg-slate-500",   bg: "bg-slate-50 dark:bg-slate-900/40",    border: "border-slate-200 dark:border-slate-700",   label: "text-slate-600 dark:text-slate-400",   accent: "border-l-slate-500",   abbr: "MC" },
};

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  Indicative:  "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/40 dark:text-amber-300",
  Supported:   "bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/40  dark:text-blue-300",
  Robust:      "bg-green-50  text-green-700  border-green-200  dark:bg-green-950/40 dark:text-green-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract first 1-2 sentences from markdown, stripped of syntax */
function extractPreview(md: string, maxLen = 160): string {
  const plain = md
    .replace(/#{1,6}\s[^\n]*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\n+/g, " ")
    .trim();
  // First sentence(s) up to maxLen
  const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? [plain];
  let result = "";
  for (const s of sentences) {
    if ((result + s).length > maxLen) break;
    result += s + " ";
  }
  return result.trim() || plain.slice(0, maxLen) + (plain.length > maxLen ? "…" : "");
}

/** Rough completeness 0-3 based on content length */
function completenessLevel(content: string): 0 | 1 | 2 | 3 {
  const wc = content.trim().split(/\s+/).length;
  if (wc < 30)  return 0;
  if (wc < 100) return 1;
  if (wc < 250) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// NPV Waterfall
// ---------------------------------------------------------------------------

function buildWaterfallData(npvValue: number) {
  const gross = Math.abs(npvValue) * 1.18;
  const bias  = Math.abs(npvValue) * 0.18;
  return [
    { name: "Gross Benefits",    value: gross,             start: 0,              isTotal: false, neg: false },
    { name: "Optimism Bias Adj", value: bias,              start: Math.abs(npvValue), isTotal: false, neg: true  },
    { name: "Net Present Value", value: Math.abs(npvValue), start: 0,             isTotal: true,  neg: npvValue < 0 },
  ];
}

function NpvWaterfallChart({ npvValue, discountRate }: { npvValue: number; discountRate?: number }) {
  const data = buildWaterfallData(npvValue);
  const maxVal = Math.max(...data.map((d) => d.start + d.value)) * 1.15;
  const fmt = (v: number) => `£${(v / 1_000_000).toFixed(1)}m`;
  const netFormatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(npvValue));

  return (
    <div data-testid="npv-waterfall-chart" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          NPV Decomposition
          {discountRate != null && <span className="ml-1 normal-case font-normal">@ {discountRate}% STPR</span>}
        </p>
        <div className="flex items-center gap-1 text-xs">
          <TrendingUp className={cn("size-3", npvValue >= 0 ? "text-emerald-500" : "text-red-500")} />
          <span className={cn("font-semibold tabular-nums", npvValue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {npvValue >= 0 ? "+" : "-"}{netFormatted}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }} barCategoryGap="28%">
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, maxVal]} tickFormatter={(v) => `£${(v / 1e6).toFixed(0)}m`} tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
          <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="start" stackId="s" fill="transparent" />
          <Bar dataKey="value" stackId="s" radius={[3, 3, 0, 0]}>
            {data.map((e, i) => (
              <Cell key={i} fill={e.isTotal ? (e.neg ? "#ef4444" : "#10b981") : e.neg ? "#f59e0b" : "#6366f1"} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Five-pillar scorecard (always visible summary row)
// ---------------------------------------------------------------------------

function PillarScorecard({
  sections,
  active,
  onSelect,
}: {
  sections: Record<string, string>;
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const pillars = FIVE_CASE_ORDER.filter((k) => k in sections);
  if (pillars.length === 0) return null;

  return (
    <div className="grid grid-cols-5 gap-1.5" data-testid="five-pillar-scorecard">
      {pillars.map((key) => {
        const cfg = SECTION_CONFIG[key];
        const lvl = completenessLevel(sections[key]);
        const isActive = active === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isActive ? "" : key)}
            className={cn(
              "rounded-lg border p-2 text-left transition-all hover:shadow-sm",
              isActive ? `${cfg.bg} ${cfg.border} shadow-sm` : "bg-muted/20 border-border hover:bg-muted/40",
            )}
            aria-pressed={isActive}
            title={key}
          >
            <div className="flex items-center gap-1 mb-1">
              <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {cfg.abbr}
              </span>
            </div>
            {/* Completeness dots */}
            <div className="flex gap-0.5 mb-1.5">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    lvl >= n ? cfg.dot : "bg-muted-foreground/20",
                  )}
                />
              ))}
            </div>
            <p className={cn("text-[10px] font-semibold leading-tight", isActive ? cfg.label : "text-foreground")}>
              {key.replace(" Case", "")}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card (preview always visible, full prose on expand)
// ---------------------------------------------------------------------------

function SectionCard({
  heading,
  content,
  citationCount,
}: {
  heading: string;
  content: string;
  citationCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SECTION_CONFIG[heading];
  const preview = useMemo(() => extractPreview(content), [content]);
  const hasMore = content.trim().split(/\s+/).length > 35;

  return (
    <div
      className={cn(
        "rounded-lg border-l-2 border border-border bg-card overflow-hidden transition-shadow",
        cfg?.accent ?? "",
        expanded ? "shadow-sm" : "",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
        {cfg && <span className={cn("size-2 rounded-full shrink-0", cfg.dot)} />}
        <span className={cn("text-[11px] font-bold uppercase tracking-wide flex-1", cfg?.label ?? "text-muted-foreground")}>
          {heading}
        </span>
        {citationCount != null && citationCount > 0 && (
          <span className="text-[9px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">
            {citationCount} src
          </span>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={expanded}
          >
            {expanded
              ? <ChevronDown className="size-3.5" />
              : <ChevronRight className="size-3.5" />}
          </button>
        )}
      </div>

      {/* Preview (always visible) */}
      <div className="px-3 pt-2 pb-2.5">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {preview}
        </p>
      </div>

      {/* Full prose (expandable) */}
      {expanded && (
        <div className={cn("px-3 pb-3 pt-0 border-t border-border")}>
          <div className="text-xs text-foreground/85 leading-relaxed prose prose-xs prose-slate max-w-none dark:prose-invert mt-2">
            <Markdown>{content}</Markdown>
          </div>
        </div>
      )}

      {/* Expand hint */}
      {!expanded && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-left px-3 pb-2 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Read full analysis →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence strip
// ---------------------------------------------------------------------------

function EvidenceStrip({ citations, styles }: {
  citations: NonNullable<ArtifactBlock["corpus_citations"]>;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;

  return (
    <div className={cn("rounded-lg border", styles.border)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className={cn("text-xs font-medium", styles.body)}>
          {citations.length} verified source{citations.length !== 1 ? "s" : ""} —
          <span className="text-muted-foreground font-normal ml-1">
            {citations.filter(c => c.claim_state === "stated").length} stated ·{" "}
            {citations.filter(c => c.claim_state === "inferred").length} inferred
          </span>
        </span>
        {open ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2 grid grid-cols-1 gap-1.5">
          {citations.map((c) => (
            <div key={c.id} className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-1">{c.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.organisation ?? c.publisher ?? c.funder ?? ""}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.claim_state && <ClaimStateBadge state={c.claim_state} rationale={c.claim_rationale} showLabel={false} />}
                {c.score != null && <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{Math.round(c.score * 100)}%</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function BriefFiveCaseRecipe({ artifact }: { artifact: ArtifactBlock }) {
  const sections = artifact.sections ?? {};
  const citations = artifact.corpus_citations ?? [];
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const styles = getConfidenceStyles(artifact.confidence_tier);

  const ordered = [
    ...FIVE_CASE_ORDER.filter((k) => k in sections),
    ...Object.keys(sections).filter((k) => !FIVE_CASE_ORDER.includes(k)),
  ];

  // Sections to show: if a pillar is selected, show only that one; else show all
  const visibleSections = activeSection ? [activeSection] : ordered;

  return (
    <div className={cn("space-y-0", styles.container)} data-testid="recipe-brief-five-case">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Investment Brief
        </span>
        <div className="flex items-center gap-2">
          {citations.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {citations.length} sources
            </span>
          )}
          <span
            data-testid="confidence-tier-badge"
            className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", TIER_BADGE[artifact.confidence_tier])}
          >
            {artifact.confidence_tier}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* NPV chart */}
        {artifact.npv_value != null ? (
          <div className={cn("rounded-lg border p-3 bg-muted/10", styles.border)}>
            <NpvWaterfallChart npvValue={artifact.npv_value} discountRate={artifact.discount_rate} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground italic">
            NPV not yet available — economic case requires further evidence retrieval.
          </div>
        )}

        {/* Five-pillar scorecard (tap to focus a section) */}
        {ordered.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Case completeness
              {activeSection && (
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="ml-2 normal-case font-normal text-indigo-500 hover:underline"
                >
                  show all
                </button>
              )}
            </p>
            <PillarScorecard
              sections={sections}
              active={activeSection}
              onSelect={setActiveSection}
            />
          </div>
        )}

        {/* Section cards — preview always visible */}
        {visibleSections.length > 0 && (
          <div className="space-y-2">
            {visibleSections.map((heading) => (
              <SectionCard
                key={heading}
                heading={heading}
                content={sections[heading] ?? ""}
                citationCount={undefined}
              />
            ))}
          </div>
        )}

        {/* Evidence strip */}
        {citations.length > 0 && <EvidenceStrip citations={citations} styles={styles} />}

        {/* Canvas escalation */}
        {(artifact.confidence_tier === "Indicative" || artifact.confidence_tier === "Supported" || artifact.confidence_tier === "Robust") && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => console.info("[STUB] Canvas escalation — needs POST /api/atlas5/canvas/escalate")}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            >
              Open in canvas <ExternalLink className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
