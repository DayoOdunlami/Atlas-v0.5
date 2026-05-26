"use client";

import { cn } from "@/lib/utils";
import type { ConfidenceTier, CpcGap, RecommendationAction } from "@/lib/types";

// ── Confidence tier badge ─────────────────────────────────────────────────────

export const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative: "bg-amber-50 text-amber-700 border-amber-200",
  Supported: "bg-blue-50 text-blue-700 border-blue-200",
  Robust: "bg-green-50 text-green-700 border-green-200",
};

export function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
        TIER_BADGE[tier],
      )}
    >
      {tier}
    </span>
  );
}

// ── Compact metric pill ───────────────────────────────────────────────────────

export function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-muted/40 min-w-[60px]">
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
        {label}
      </span>
    </div>
  );
}

// ── Recommendation action banner ──────────────────────────────────────────────

const ACTION_CONFIG: Record<
  RecommendationAction,
  { label: string; cls: string }
> = {
  bid: {
    label: "Recommended action: BID",
    cls: "bg-green-50 border-green-200 text-green-800",
  },
  partner: {
    label: "Recommended action: PARTNER",
    cls: "bg-blue-50 border-blue-200 text-blue-800",
  },
  monitor: {
    label: "Recommended action: MONITOR",
    cls: "bg-amber-50 border-amber-200 text-amber-800",
  },
  reject: {
    label: "Recommended action: REJECT",
    cls: "bg-red-50 border-red-200 text-red-800",
  },
};

export function RecommendationBanner({
  action,
  rationale,
}: {
  action: RecommendationAction;
  rationale?: string;
}) {
  const config = ACTION_CONFIG[action];
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 space-y-0.5", config.cls)}>
      <p className="text-xs font-semibold tracking-wide">{config.label}</p>
      {rationale && (
        <p className="text-xs leading-snug opacity-90">{rationale}</p>
      )}
    </div>
  );
}

// ── Gap / caveat panel ────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  CpcGap["severity"],
  { label: string; cls: string; dotCls: string }
> = {
  low: {
    label: "LOW",
    cls: "text-muted-foreground bg-muted",
    dotCls: "bg-muted-foreground",
  },
  medium: {
    label: "MED",
    cls: "text-amber-700 bg-amber-50",
    dotCls: "bg-amber-500",
  },
  high: {
    label: "HIGH",
    cls: "text-red-700 bg-red-50",
    dotCls: "bg-red-500",
  },
};

const SEVERITY_ORDER: Record<CpcGap["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function GapCaveatPanel({ gaps }: { gaps: CpcGap[] }) {
  if (gaps.length === 0) return null;
  const sorted = [...gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Gaps &amp; Caveats
      </p>
      {sorted.map((gap, i) => {
        const s = SEVERITY_STYLE[gap.severity];
        return (
          <div
            key={i}
            className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-px",
                    s.dotCls,
                  )}
                />
                <p className="text-xs font-medium leading-snug">{gap.area}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  s.cls,
                )}
              >
                {s.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug pl-3">
              {gap.description}
            </p>
            {(gap.project_count !== undefined ||
              gap.claim_count !== undefined) && (
              <div className="flex gap-3 text-[10px] text-muted-foreground/60 pl-3">
                {gap.project_count !== undefined && (
                  <span>
                    {gap.project_count} project
                    {gap.project_count !== 1 ? "s" : ""}
                  </span>
                )}
                {gap.claim_count !== undefined && (
                  <span>
                    {gap.claim_count} claim
                    {gap.claim_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
