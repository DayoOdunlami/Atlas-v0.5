/**
 * Atlas 5 — Confidence tier visual weight styles (Principle 2)
 *
 * Visual weight signals confidence — no warning banners, no red labels.
 * Opacity and border style carry the epistemic signal.
 *
 * Speculative  → opacity-60, dotted borders, light font weight
 * Indicative   → opacity-75, dashed borders, normal weight
 * Supported    → opacity-90, solid borders, medium weight
 * Robust       → opacity-100, solid borders, bold accents, filled backgrounds
 */

import type { ConfidenceTier } from "./types";

// ---------------------------------------------------------------------------
// Style map
// ---------------------------------------------------------------------------

interface ConfidenceStyleSet {
  /** Applied to the outer article/section container */
  container: string;
  /** Applied to non-headline text elements */
  body: string;
  /** Applied to border elements */
  border: string;
  /** Applied to numeric / headline emphasis */
  headline: string;
  /** Applied to the tier badge */
  badge: string;
}

const CONFIDENCE_STYLES: Record<ConfidenceTier, ConfidenceStyleSet> = {
  Speculative: {
    container: "opacity-[0.85]",
    body: "opacity-60 font-light",
    border: "border-dashed border-slate-300 dark:border-slate-600",
    headline: "opacity-75 font-normal",
    badge:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  },
  Indicative: {
    container: "opacity-[0.92]",
    body: "opacity-75 font-normal",
    border: "border-dashed border-amber-200 dark:border-amber-800",
    headline: "opacity-80 font-medium",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  Supported: {
    container: "opacity-[0.97]",
    body: "opacity-90 font-normal",
    border: "border-solid border-blue-200 dark:border-blue-800",
    headline: "opacity-95 font-medium",
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  Robust: {
    container: "opacity-100",
    body: "opacity-100 font-normal",
    border: "border-solid border-emerald-200 dark:border-emerald-800",
    headline: "opacity-100 font-bold",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind class sets for a given confidence tier.
 * Apply `container` to the outermost wrapper; other keys to child elements.
 */
export function getConfidenceStyles(tier: ConfidenceTier): ConfidenceStyleSet {
  return CONFIDENCE_STYLES[tier] ?? CONFIDENCE_STYLES.Speculative;
}

/**
 * Single-string shortcut — returns just the container class.
 * Useful when you only need the opacity wrapper.
 */
export function getConfidenceContainerClass(tier: ConfidenceTier): string {
  return CONFIDENCE_STYLES[tier]?.container ?? "opacity-[0.85]";
}

/**
 * Returns the badge class string for inline use in existing badge components.
 */
export function getConfidenceBadgeClass(tier: ConfidenceTier): string {
  return CONFIDENCE_STYLES[tier]?.badge ?? CONFIDENCE_STYLES.Speculative.badge;
}
