"use client";

import { useState } from "react";
import { ArtifactBlock, ConfidenceTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/charts/chart-renderer";
import type { Chart } from "@/lib/types";

const FIVE_CASE_ORDER = [
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
];

const SECTION_STYLE: Record<string, {
  border: string;
  header: string;
  bar: string;
  badge: string;
  icon: string;
}> = {
  "Strategic Case":  {
    border: "border-indigo-200",
    header: "bg-indigo-50 border-b border-indigo-100",
    bar: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-700",
    icon: "bg-indigo-500",
  },
  "Economic Case":   {
    border: "border-emerald-200",
    header: "bg-emerald-50 border-b border-emerald-100",
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    icon: "bg-emerald-500",
  },
  "Commercial Case": {
    border: "border-violet-200",
    header: "bg-violet-50 border-b border-violet-100",
    bar: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700",
    icon: "bg-violet-500",
  },
  "Financial Case":  {
    border: "border-amber-200",
    header: "bg-amber-50 border-b border-amber-100",
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    icon: "bg-amber-500",
  },
  "Management Case": {
    border: "border-slate-200",
    header: "bg-slate-50 border-b border-slate-100",
    bar: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700",
    icon: "bg-slate-500",
  },
};

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative:  "bg-amber-50 text-amber-700 border-amber-200",
  Supported:   "bg-blue-50 text-blue-700 border-blue-200",
  Robust:      "bg-green-50 text-green-700 border-green-200",
};

const SCORE_BAR_COLOR = (score: number) =>
  score >= 70 ? "bg-green-500" : score >= 45 ? "bg-amber-500" : "bg-red-400";

const PREVIEW_LENGTH = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSectionScores(artifact: ArtifactBlock): Record<string, number> {
  // Prefer backend-computed LLM scores (section_scores field)
  if (artifact.section_scores && Object.keys(artifact.section_scores).length > 0) {
    return artifact.section_scores;
  }
  // Fallback: extract from embedded radar chart data
  const radar = artifact.chart_specs?.find((c) => c.type === "radar");
  if (!radar) return {};
  const scores: Record<string, number> = {};
  for (const d of (radar.data ?? []) as Record<string, unknown>[]) {
    if (typeof d.case === "string" && typeof d.score === "number") {
      scores[d.case] = d.score;
    }
  }
  return scores;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictStrip({ artifact }: { artifact: ArtifactBlock }) {
  const npv = artifact.npv_value;
  const rate = artifact.discount_rate ?? 0.035;
  const firstSentence =
    artifact.sections?.["Strategic Case"]?.split(/[.!?]/)[0]?.trim() ?? "";

  return (
    <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-indigo-50/60 to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Investment Brief — HM Treasury Five Case Model
          </p>
          {firstSentence && (
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {firstSentence}.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={cn(
              "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
              TIER_BADGE[artifact.confidence_tier],
            )}
          >
            {artifact.confidence_tier}
          </span>
          {npv != null && (
            <span className="text-xs font-bold text-emerald-700">
              NPV £{(npv / 1_000_000).toFixed(1)}m
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {/* rate stored as decimal (0.035) or percentage (3.5) — normalise */}
            Discount {(rate > 1 ? rate : rate * 100).toFixed(1)}% STPR
          </span>
        </div>
      </div>
    </div>
  );
}

function RadarSummary({ chart }: { chart: Chart }) {
  const data = (chart.data ?? []) as Record<string, unknown>[];
  const scores = data.map((d) => (typeof d.score === "number" ? d.score : 0));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const weakest = data.reduce<Record<string, unknown>>(
    (min, d) => (typeof d.score === "number" && typeof min.score === "number" && d.score < min.score ? d : min),
    data[0] ?? {},
  );
  const strongest = data.reduce<Record<string, unknown>>(
    (max, d) => (typeof d.score === "number" && typeof max.score === "number" && d.score > max.score ? d : max),
    data[0] ?? {},
  );

  return (
    <div className="mx-4 my-3 rounded-xl border border-border bg-muted/10 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence Strength — at a glance
        </span>
        <span className="text-xs text-muted-foreground">
          Avg {avg}%
          {typeof weakest.case === "string" && (
            <> · Weakest: <span className="font-medium">{weakest.case.replace(" Case", "")}</span></>
          )}
          {typeof strongest.case === "string" && (
            <> · Strongest: <span className="font-medium">{strongest.case.replace(" Case", "")}</span></>
          )}
        </span>
      </div>
      {chart.insight && (
        <p className="px-4 pt-2.5 text-[11px] text-muted-foreground leading-snug">
          {chart.insight}
        </p>
      )}
      <div className="p-3">
        <ChartRenderer spec={chart} data={chart.data ?? []} />
      </div>
    </div>
  );
}

function CaseCard({
  heading,
  content,
  score,
  inlineChart,
  npvFallback,
  citationCount,
  defaultOpen,
}: {
  heading: string;
  content: string;
  score?: number;
  inlineChart?: Chart;
  npvFallback?: { value: number; rate: number } | null;
  citationCount: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const style = SECTION_STYLE[heading];
  const preview = content.length > PREVIEW_LENGTH
    ? content.slice(0, PREVIEW_LENGTH).replace(/\s+\S*$/, "") + "…"
    : content;
  const hasMore = content.length > PREVIEW_LENGTH;

  return (
    <div className={cn("rounded-xl border overflow-hidden", style?.border ?? "border-border")}>
      {/* Section header */}
      <button
        className={cn(
          "w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors hover:brightness-95",
          style?.header ?? "bg-muted/30 border-b border-border",
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", style?.icon ?? "bg-muted-foreground")} />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
          {heading}
        </span>
        {citationCount > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/60 border border-border text-muted-foreground">
            {citationCount} citation{citationCount !== 1 ? "s" : ""}
          </span>
        )}
        {score !== undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="h-1.5 w-14 rounded-full bg-white/70 overflow-hidden">
              <div
                className={cn("h-full rounded-full", SCORE_BAR_COLOR(score))}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
              {score}%
            </span>
          </div>
        )}
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      <div className="px-4 pb-4 pt-3 bg-card space-y-3">
        {!content || content.startsWith("[") ? (
          <p className="text-xs text-muted-foreground italic">
            Insufficient evidence for this case — see evidence gaps.
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
              {open ? content : preview}
            </p>
            {hasMore && (
              <button
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
              >
                {open ? "Show less ↑" : "Show full case ↓"}
              </button>
            )}
            {/* Inline chart — Economic Case gets the NPV bar embedded here */}
            {open && inlineChart && (
              <div className="mt-3 rounded-lg border border-border bg-muted/10 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {inlineChart.title}
                </p>
                {inlineChart.insight && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {inlineChart.insight}
                  </p>
                )}
                <ChartRenderer spec={inlineChart} data={inlineChart.data ?? []} />
              </div>
            )}
            {/* NPV callout — fallback when no NPV chart spec is available */}
            {open && !inlineChart && npvFallback != null && (
              <div className="mt-3 flex items-center gap-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div>
                  <p className="text-xs text-emerald-700 font-medium">NPV (3.5% STPR)</p>
                  <p className="text-xl font-bold text-emerald-800">
                    £{(npvFallback.value / 1_000_000).toFixed(1)}m
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700 font-medium">Discount rate</p>
                  <p className="text-xl font-bold text-emerald-800">
                    {/* rate stored as decimal (0.035) or percentage (3.5) — normalise */}
                    {(npvFallback.rate > 1 ? npvFallback.rate : npvFallback.rate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EvidenceFooter({ charts }: { charts: Chart[] }) {
  if (charts.length === 0) return null;
  return (
    <div className="mx-4 mb-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-2 border-t border-border">
        Evidence Foundation
      </p>
      <div className={cn(
        "grid gap-3",
        charts.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}>
        {charts.map((chart, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
            <div>
              <p className="text-xs font-semibold text-foreground/80">{chart.title}</p>
              {chart.insight && (
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {chart.insight}
                </p>
              )}
            </div>
            <ChartRenderer spec={chart} data={chart.data ?? []} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main recipe ───────────────────────────────────────────────────────────────

interface Props {
  artifact: ArtifactBlock;
}

export function BriefFiveCaseRecipe({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const sectionKeys = Object.keys(sections);
  const sectionScores = extractSectionScores(artifact);

  const ordered = [
    ...FIVE_CASE_ORDER.filter((k) => k in sections),
    ...sectionKeys.filter((k) => !FIVE_CASE_ORDER.includes(k)),
  ];

  const chartSpecs = artifact.chart_specs ?? [];
  const radarChart  = chartSpecs.find((c) => c.type === "radar");
  const npvChart    = chartSpecs.find(
    (c) => c.type === "bar" && typeof c.title === "string" && c.title.toLowerCase().includes("npv"),
  );
  // Evidence footer charts: everything except radar and NPV bar
  const footerCharts = chartSpecs.filter((c) => c !== radarChart && c !== npvChart);

  const citations = artifact.corpus_citations ?? [];

  return (
    <div className="space-y-0">
      {/* 1. Verdict strip — headline + confidence + NPV */}
      <VerdictStrip artifact={artifact} />

      {/* 2. Radar — evidence strength at a glance (shown first, not last) */}
      {radarChart && <RadarSummary chart={radarChart} />}

      {/* 3. Five Case accordion cards */}
      <div className="px-4 pb-4 space-y-2">
        {ordered.length === 0 && (
          <p className="text-sm text-muted-foreground italic pt-4">
            Ask the agent to build an investment brief.
          </p>
        )}

        {ordered.map((heading, idx) => (
          <CaseCard
            key={heading}
            heading={heading}
            content={sections[heading] ?? ""}
            score={sectionScores[heading]}
            inlineChart={heading === "Economic Case" ? npvChart : undefined}
            npvFallback={
              heading === "Economic Case" && !npvChart && artifact.npv_value != null
                ? { value: artifact.npv_value, rate: artifact.discount_rate ?? 0.035 }
                : null
            }
            citationCount={citations.length}
            defaultOpen={idx === 0}
          />
        ))}
      </div>

      {/* 4. Evidence foundation — source quality charts in compact 2-col grid */}
      <EvidenceFooter charts={footerCharts} />
    </div>
  );
}
