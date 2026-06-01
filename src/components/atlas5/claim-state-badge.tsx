"use client";

/**
 * ClaimStateBadge — Principle 3: Claim states are first-class citizens.
 *
 * Four states:
 *   stated    → solid teal   — directly extracted, cited
 *   inferred  → amber italic — agent-derived, tooltip shows rationale
 *   unknown   → grey         — no data found
 *   contested → red-amber    — sources conflict, tooltip shows both
 *
 * Inline badge ≤ 32px height. Apply to: trust-rail citation rows,
 * gap matrix rows, evidence tree rows.
 */

import type { ClaimState } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Visual config per state
// ---------------------------------------------------------------------------

const STATE_CONFIG: Record<
  ClaimState,
  {
    symbol: string;
    label: string;
    className: string;
    italicLabel: boolean;
  }
> = {
  stated: {
    symbol: "✓",
    label: "stated",
    className:
      "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700",
    italicLabel: false,
  },
  inferred: {
    symbol: "~",
    label: "inferred",
    className:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
    italicLabel: true,
  },
  unknown: {
    symbol: "?",
    label: "unknown",
    className:
      "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
    italicLabel: false,
  },
  contested: {
    symbol: "⚠",
    label: "contested",
    className:
      "bg-red-50 text-red-700 border-amber-400 dark:bg-red-950/40 dark:text-red-300 dark:border-amber-700",
    italicLabel: false,
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClaimStateBadgeProps {
  state: ClaimState;
  /** Tooltip text — especially useful for inferred/contested states */
  rationale?: string;
  /** Show label text alongside symbol (default: true) */
  showLabel?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaimStateBadge({
  state,
  rationale,
  showLabel = true,
  className,
}: ClaimStateBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATE_CONFIG[state];

  return (
    <span className="relative inline-flex items-center">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5",
          "text-[10px] font-semibold leading-none",
          "max-h-[28px]",
          config.className,
          className,
        )}
        onMouseEnter={() => rationale && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        data-testid={`claim-state-badge-${state}`}
        aria-label={`Claim state: ${state}${rationale ? `. ${rationale}` : ""}`}
      >
        <span aria-hidden="true">{config.symbol}</span>
        {showLabel && (
          <span className={config.italicLabel ? "italic" : undefined}>
            {config.label}
          </span>
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && rationale && (
        <span
          role="tooltip"
          className={cn(
            "absolute bottom-full left-0 z-50 mb-1.5 w-52",
            "rounded-lg border border-border bg-popover px-2.5 py-2",
            "text-[11px] leading-snug text-popover-foreground shadow-lg",
            "pointer-events-none",
          )}
        >
          <span className="block font-semibold text-muted-foreground mb-0.5 uppercase tracking-wide text-[9px]">
            {config.label}
          </span>
          {rationale}
        </span>
      )}
    </span>
  );
}
