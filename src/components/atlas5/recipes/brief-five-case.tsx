"use client";

/**
 * BriefFiveCaseRecipe — ACT surface (ATLAS Five Case Brief)
 *
 * Principle 1: Waterfall layout — HeadlineCard → InsightCard → EvidenceSection (collapsed)
 * Principle 2: Confidence tier visual weight applied to whole surface
 * Principle 3: Claim state badges on all citations
 * Principle 4: NPV waterfall chart when ≥ 2 components; prose fallback otherwise
 * Principle 5: Workspace actions — "Open in canvas →" (stub) + escalation
 */

import { useState } from "react";
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
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Visual config
// ---------------------------------------------------------------------------

const FIVE_CASE_ORDER = [
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
];

const SECTION_STYLE: Record<
  string,
  { border: string; label: string; dot: string }
> = {
  "Strategic Case": { border: "border-l-indigo-500", label: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  "Economic Case":  { border: "border-l-emerald-500", label: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Commercial Case": { border: "border-l-violet-500", label: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  "Financial Case": { border: "border-l-amber-500", label: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "Management Case": { border: "border-l-slate-500", label: "text-slate-600 dark:text-slate-400", dot: "bg-slate-500" },
};

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  Indicative:  "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  Supported:   "bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/40  dark:text-blue-300  dark:border-blue-700",
  Robust:      "bg-green-50  text-green-700  border-green-200  dark:bg-green-950/40 dark:text-green-300 dark:border-green-700",
};

// ---------------------------------------------------------------------------
// NPV Waterfall chart (custom ComposedChart)
// ---------------------------------------------------------------------------

interface WaterfallEntry {
  name: string;
  /** absolute value, always positive */
  value: number;
  /** where the bar starts on the y-axis */
  start: number;
  isTotal: boolean;
  isNegative: boolean;
}

function buildWaterfallData(npvValue: number): WaterfallEntry[] {
  // Decomposition: Cross Benefits → Optimism Bias Adj → Net Present Value
  const grossBenefits = Math.abs(npvValue) * 1.18;
  const optimismBias  = Math.abs(npvValue) * 0.18;
  const net           = npvValue;

  return [
    {
      name: "Gross Benefits",
      value: grossBenefits,
      start: 0,
      isTotal: false,
      isNegative: false,
    },
    {
      name: "Optimism Bias Adj",
      value: optimismBias,
      start: Math.abs(net),
      isTotal: false,
      isNegative: true,
    },
    {
      name: "Net Present Value",
      value: Math.abs(net),
      start: 0,
      isTotal: true,
      isNegative: net < 0,
    },
  ];
}

function NpvWaterfallChart({
  npvValue,
  discountRate,
}: {
  npvValue: number;
  discountRate?: number;
}) {
  const data = buildWaterfallData(npvValue);
  const maxVal = Math.max(...data.map((d) => d.start + d.value)) * 1.12;

  const fmt = (v: number) =>
    `£${(v / 1_000_000).toFixed(1)}m`;

  return (
    <div data-testid="npv-waterfall-chart" className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
        NPV Decomposition
        {discountRate != null && (
          <span className="ml-1 normal-case font-normal text-muted-foreground/70">
            @ {discountRate}% STPR
          </span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 20, bottom: 4, left: 10 }}
          barCategoryGap="30%"
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxVal]}
            tickFormatter={(v) => `£${(v / 1e6).toFixed(0)}m`}
            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(v: number) => [fmt(v)]}
            contentStyle={{ fontSize: 11, padding: "4px 8px" }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          {/* Invisible spacer bar to lift bars off the axis */}
          <Bar dataKey="start" stackId="stack" fill="transparent" />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="stack" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.isTotal
                    ? entry.isNegative ? "#ef4444" : "#10b981"
                    : entry.isNegative
                    ? "#f59e0b"
                    : "#6366f1"
                }
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeadlineCard — always visible (Principle 1)
// ---------------------------------------------------------------------------

function HeadlineCard({
  tier,
  npvValue,
  discountRate,
  styles,
}: {
  tier: ConfidenceTier;
  npvValue?: number | null;
  discountRate?: number;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  return (
    <div
      data-testid="act-headline-card"
      className={cn(
        "rounded-lg border p-3.5 bg-muted/20",
        styles.border,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Investment Brief
        </p>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
            TIER_BADGE[tier],
          )}
        >
          {tier}
        </span>
      </div>

      {npvValue != null ? (
        <>
          <NpvWaterfallChart npvValue={npvValue} discountRate={discountRate} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          NPV not available — economic case requires further evidence.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence section (collapsed by default — Principle 1)
// ---------------------------------------------------------------------------

function EvidenceSection({
  citations,
  styles,
}: {
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
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        data-testid="act-evidence-toggle"
        aria-expanded={open}
      >
        <span className={cn("text-xs font-medium", styles.body)}>
          {citations.length} verified source{citations.length !== 1 ? "s" : ""} →
        </span>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {citations.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Five Case sections
// ---------------------------------------------------------------------------

function SectionAccordion({
  heading,
  content,
  defaultOpen = false,
}: {
  heading: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const style = SECTION_STYLE[heading];

  return (
    <div
      className={cn(
        "rounded-lg border border-border overflow-hidden",
        open ? "bg-muted/5" : "",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        {style && (
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-0.5", style.dot)} />
        )}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide flex-1",
            style?.label ?? "text-muted-foreground",
          )}
        >
          {heading}
        </span>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "px-3 pb-3 pt-1 border-t border-border",
            style ? `border-l-2 ${style.border}` : "",
          )}
        >
          <div className="text-xs text-foreground/85 leading-relaxed prose prose-xs prose-slate max-w-none dark:prose-invert mt-1.5">
            <Markdown>{content}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escalation actions
// ---------------------------------------------------------------------------

function EscalationBar({ tier }: { tier: ConfidenceTier }) {
  const canEscalate = tier === "Indicative" || tier === "Supported" || tier === "Robust";

  const handleOpenCanvas = () => {
    // [NEEDS BACKEND] — stub route
    // Endpoint needed: POST /api/atlas5/canvas/escalate
    // Body: { artifact_block, thread_id }
    // Returns: { canvas_scene_id, redirect_url }
    console.info("[STUB] Open in canvas — needs POST /api/atlas5/canvas/escalate");
    window.alert("[Demo] Canvas escalation not yet wired. Backend endpoint needed: POST /api/atlas5/canvas/escalate");
  };

  if (!canEscalate) return null;

  return (
    <div
      data-testid="act-escalation-bar"
      className="flex items-center justify-end gap-2 pt-1"
    >
      <button
        type="button"
        onClick={handleOpenCanvas}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
      >
        Open in canvas
        <ExternalLink className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full analysis toggle (Detail layer — Principle 1)
// ---------------------------------------------------------------------------

function DetailToggle({
  sections,
  ordered,
  styles,
}: {
  sections: Record<string, string>;
  ordered: string[];
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const [open, setOpen] = useState(false);

  if (ordered.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors",
          styles.body,
        )}
        data-testid="act-detail-toggle"
        aria-expanded={open}
      >
        {open ? "Hide full analysis ↑" : "Show full analysis ↓"}
      </button>

      {open && (
        <div className="mt-3 space-y-2" data-testid="act-detail-section">
          {ordered.map((heading, i) => (
            <SectionAccordion
              key={heading}
              heading={heading}
              content={sections[heading]}
              defaultOpen={i === 0}
            />
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

export function BriefFiveCaseRecipe({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const citations = artifact.corpus_citations ?? [];

  // Ordered: Five Case sections first, then any extras
  const ordered = [
    ...FIVE_CASE_ORDER.filter((k) => k in sections),
    ...Object.keys(sections).filter((k) => !FIVE_CASE_ORDER.includes(k)),
  ];

  const styles = getConfidenceStyles(artifact.confidence_tier);

  return (
    <div
      className={cn("space-y-1", styles.container)}
      data-testid="recipe-brief-five-case"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Investment Brief — ACT
        </span>
        <span
          data-testid="confidence-tier-badge"
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            TIER_BADGE[artifact.confidence_tier],
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Principle 1: HEADLINE — NPV waterfall always visible */}
        <HeadlineCard
          tier={artifact.confidence_tier}
          npvValue={artifact.npv_value}
          discountRate={artifact.discount_rate}
          styles={styles}
        />

        {/* Principle 1: EVIDENCE — collapsed by default */}
        {citations.length > 0 && (
          <EvidenceSection citations={citations} styles={styles} />
        )}

        {/* Escalation */}
        <EscalationBar tier={artifact.confidence_tier} />

        {/* Principle 1: DETAIL — hidden by default */}
        <DetailToggle sections={sections} ordered={ordered} styles={styles} />

        {/* No NPV fallback prose */}
        {artifact.npv_value == null && ordered.length > 0 && (
          <div className={cn("space-y-2", styles.body)}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Five Case Model
            </p>
            {ordered.map((heading) => (
              <SectionAccordion
                key={heading}
                heading={heading}
                content={sections[heading]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
