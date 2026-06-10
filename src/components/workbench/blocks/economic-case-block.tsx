"use client";

/**
 * EconomicCaseBlock — Five Case Model economic analysis renderer (M1.0)
 *
 * Renders two layouts depending on block.visual:
 *
 *   "npv_waterfall"    — when quantified NPV/BCR data exists
 *     Headline NPV/BCR cards → NPV waterfall bar chart → value driver table
 *     → assumption ledger → sensitivity note
 *
 *   "value_driver_cards" — when only qualitative data is available
 *     Verdict card → value driver cards → assumption ledger → sensitivity note
 *
 * Five Case section scores shown as a compact row in both modes.
 *
 * Token usage:
 *   value-positive / value-negative / value-gold — financial signals
 *   tier-* — confidence tier badge
 *   evidence-* — per-item evidence state badges
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  tierClass,
  toConfidenceTier,
  evidenceClass,
  valueClass,
  type ValueSignal,
} from "@/lib/design/tokens";
import { CitationList } from "@/components/workbench/citation-popover";
import type {
  EconomicCaseBlock as EconomicCaseBlockType,
  EconomicCaseContent,
  ValueDriver,
  Assumption,
  FiveCaseSectionScore,
  NpvWaterfallItem,
} from "@/lib/workbench/atlas-render-model";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000)     return `£${(val / 1_000).toFixed(0)}k`;
  return `£${val.toFixed(0)}`;
}

function verdictToSignal(verdict: EconomicCaseContent["verdict"]): ValueSignal {
  if (verdict === "positive")          return "positive";
  if (verdict === "negative")          return "negative";
  if (verdict === "insufficient_data") return "neutral";
  return "neutral";
}

function VerdictIcon({ verdict }: { verdict: EconomicCaseContent["verdict"] }) {
  if (verdict === "positive")          return <TrendingUp className="w-4 h-4" />;
  if (verdict === "negative")          return <TrendingDown className="w-4 h-4" />;
  if (verdict === "insufficient_data") return <AlertTriangle className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

// ---------------------------------------------------------------------------
// Five Case section scores strip
// ---------------------------------------------------------------------------

function SectionScoreRow({ score }: { score: FiveCaseSectionScore }) {
  const pct = Math.round(score.score * 100);
  const barColour =
    pct >= 70 ? "bg-evidence-verified" :
    pct >= 40 ? "bg-evidence-partial"  :
                "bg-gap-major";

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-24 text-[10px] font-medium text-muted-foreground capitalize shrink-0">
        {score.label}
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", barColour)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] text-muted-foreground tabular-nums shrink-0">
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NPV waterfall (horizontal bar chart — pure CSS, no recharts dep yet)
// ---------------------------------------------------------------------------

function NpvWaterfall({ items }: { items: NpvWaterfallItem[] }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const pct = (Math.abs(item.value) / maxAbs) * 100;
        const isNpv = item.type === "npv";
        const isCost = item.value < 0;
        const barClass = isNpv
          ? item.value >= 0 ? "bg-value-positive" : "bg-value-negative"
          : isCost ? "bg-gap-major" : "bg-evidence-verified";

        return (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-32 text-[10px] text-muted-foreground truncate shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-4 bg-muted rounded overflow-hidden flex items-center">
              <div
                className={cn("h-full rounded", barClass, isNpv && "opacity-90")}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span
              className={cn(
                "w-16 text-right text-[10px] font-medium tabular-nums shrink-0",
                isCost ? "text-value-negative" : "text-value-positive",
                isNpv && "font-bold text-value-gold",
              )}
            >
              {item.value >= 0 ? "+" : ""}
              {fmt(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value driver card
// ---------------------------------------------------------------------------

function ValueDriverRow({ driver }: { driver: ValueDriver }) {
  const evClass = evidenceClass(
    driver.evidence_state === "self-reported" ? "partial" :
    driver.evidence_state === "verified"      ? "verified" :
    driver.evidence_state === "inferred"      ? "inferred" :
    driver.evidence_state === "contested"     ? "contested" : "unknown"
  );
  const dirIcon =
    driver.direction === "benefit"   ? <TrendingUp className="w-3 h-3 text-evidence-verified" /> :
    driver.direction === "cost"      ? <TrendingDown className="w-3 h-3 text-value-negative" /> :
                                       <Minus className="w-3 h-3 text-muted-foreground" />;

  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">{dirIcon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{driver.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{driver.description}</p>
        {driver.assumption && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">
            Assumes: {driver.assumption}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {driver.quantified_value !== undefined && (
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            driver.direction === "benefit" ? "text-value-positive" : "text-value-negative",
          )}>
            {driver.quantified_value >= 0 ? "+" : ""}{fmt(driver.quantified_value)}
          </span>
        )}
        <span className="capitalize text-[10px]">{driver.magnitude}</span>
        <span className={cn("rounded border px-1 py-0.5 text-[9px] font-medium", evClass)}>
          {driver.evidence_state}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assumption ledger
// ---------------------------------------------------------------------------

function AssumptionLedger({ assumptions }: { assumptions: Assumption[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <span className="text-[11px] font-semibold">
          Assumptions ({assumptions.length})
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {assumptions.map((a, i) => {
            const sensitivityColour =
              a.sensitivity === "high"   ? "text-gap-blocker" :
              a.sensitivity === "medium" ? "text-gap-medium"  : "text-muted-foreground";
            return (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.value}</p>
                  {a.note && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{a.note}</p>}
                </div>
                <span className={cn("text-[10px] font-medium shrink-0", sensitivityColour)}>
                  {a.sensitivity} sensitivity
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  block: EconomicCaseBlockType;
}

export function EconomicCaseBlock({ block }: Props) {
  const c = block.content;
  const signal = verdictToSignal(c.verdict);
  const hasWaterfall = block.visual === "npv_waterfall" && c.npv_waterfall && c.npv_waterfall.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Block header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <BarChart2 className="w-4 h-4 text-value-gold shrink-0" />
        <h3 className="text-sm font-semibold flex-1">{block.headline}</h3>
        <Badge
          variant="outline"
          className={cn("text-[10px] border", tierClass(toConfidenceTier(c.confidence_tier)))}
        >
          {c.confidence_tier}
        </Badge>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Verdict card */}
        <div className={cn("rounded-lg border px-4 py-3 flex items-start gap-3", `bg-value-${signal}-bg border-value-${signal}/20`)}>
          <div className={cn("mt-0.5 shrink-0", valueClass(signal))}>
            <VerdictIcon verdict={c.verdict} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold capitalize", valueClass(signal).split(" ")[0])}>
              {c.verdict === "insufficient_data" ? "Insufficient data for verdict" : `${c.verdict} economic case`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.verdict_summary}</p>
            {c.confidence_cap_reason && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                {c.confidence_cap_reason}
              </p>
            )}
          </div>
          {/* NPV headline */}
          {c.npv_value != null && (
            <div className="ml-auto text-right shrink-0">
              <p className={cn("text-lg font-bold tabular-nums", valueClass("gold").split(" ")[0])}>
                {c.npv_value >= 0 ? "+" : ""}{fmt(c.npv_value)}
              </p>
              <p className="text-[10px] text-muted-foreground">NPV ({(c.discount_rate * 100).toFixed(1)}% STPR)</p>
              {c.bcr != null && (
                <p className="text-[10px] text-muted-foreground">BCR {c.bcr.toFixed(2)}</p>
              )}
            </div>
          )}
        </div>

        {/* Five Case section scores */}
        {c.section_scores.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Five Case scores
            </p>
            <div className="space-y-0.5">
              {c.section_scores.map((s) => (
                <SectionScoreRow key={s.case} score={s} />
              ))}
            </div>
          </div>
        )}

        {/* NPV waterfall */}
        {hasWaterfall && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              NPV waterfall
            </p>
            <NpvWaterfall items={c.npv_waterfall!} />
          </div>
        )}

        {/* Value drivers */}
        {c.value_drivers.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Value drivers
            </p>
            <div className="rounded border border-border divide-y divide-border">
              {c.value_drivers.map((d, i) => (
                <div key={i} className="px-3">
                  <ValueDriverRow driver={d} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assumptions ledger */}
        {c.assumptions.length > 0 && (
          <AssumptionLedger assumptions={c.assumptions} />
        )}

        {/* Sensitivity note */}
        {c.sensitivity_note && (
          <div className="flex items-start gap-2 rounded bg-gap-minor-bg border border-gap-minor/30 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-gap-medium shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-gap-medium">Sensitivity: </span>
              {c.sensitivity_note}
            </p>
          </div>
        )}

        {/* Citations — M1.3 popover chips */}
        {c.corpus_citations.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Evidence ({c.corpus_citations.length})
            </p>
            <CitationList
              citations={c.corpus_citations.map((cit) => ({
                id: cit.id,
                title: cit.title,
                organisation: (cit as { organisation?: string }).organisation,
                score: cit.score,
                schema: "atlas" as const,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
