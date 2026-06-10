/**
 * Atlas 5 Design Token System — TypeScript companion to globals.css
 *
 * Use these constants wherever you need colours in JS/TS context:
 *   - Recharts / ECharts data series colours
 *   - Badge / pill className helpers
 *   - Dynamic style objects
 *   - Agent output rendering logic
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE LAYERS — never mix them:
 *
 *   BRAND    →  CPC identity, navigation, primary actions
 *   SEMANTIC →  Trust, risk, state, gap, value — carries meaning
 *   DATA-VIS →  Chart series, map categories — no semantic meaning
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Layer 1 — Brand
// ---------------------------------------------------------------------------

export const BRAND = {
  green:           "#006E51",  // CPC green — primary / selected nav
  greenLight:      "#00a878",  // lighter for dark mode
  mint:            "#CCE2DC",  // soft panel wash
  mintDark:        "#1a3832",  // dark mode mint
  charcoal:        "#2E2D2B",  // body text
  blue:            "#098BC3",  // Atlas accent / links
} as const;

// ---------------------------------------------------------------------------
// Layer 2 — Semantic
// ---------------------------------------------------------------------------

/** Evidence state — what we know about each piece of evidence */
export const EVIDENCE = {
  verified:   { text: "#1a7a5e", bg: "#e6f4f1", label: "Verified" },
  partial:    { text: "#d97706", bg: "#fef3c7", label: "Partial" },
  inferred:   { text: "#2563eb", bg: "#eff6ff", label: "Inferred" },
  unknown:    { text: "#9ca3af", bg: "#f3f4f6", label: "Unknown" },
  contested:  { text: "#c0392b", bg: "#fef2f2", label: "Contested" },
} as const;

export type EvidenceState = keyof typeof EVIDENCE;

/** Confidence tier — quality of the agent's overall output */
export const CONFIDENCE_TIER = {
  Speculative: { text: "#9ca3af", bg: "#f3f4f6", label: "Speculative" },
  Indicative:  { text: "#d97706", bg: "#fef3c7", label: "Indicative"  },
  Supported:   { text: "#2563eb", bg: "#eff6ff", label: "Supported"   },
  Robust:      { text: "#1a7a5e", bg: "#e6f4f1", label: "Robust"      },
} as const;

export type ConfidenceTier = keyof typeof CONFIDENCE_TIER;

/** Gap magnitude — how significant a knowledge/evidence gap is */
export const GAP = {
  minor:   { text: "#fbbf24", bg: "#fffbeb", label: "Minor gap"   },
  medium:  { text: "#d97706", bg: "#fef3c7", label: "Gap"         },
  major:   { text: "#ea7317", bg: "#fff7ed", label: "Major gap"   },
  blocker: { text: "#c0392b", bg: "#fef2f2", label: "Blocker"     },
} as const;

export type GapMagnitude = keyof typeof GAP;

/** Value signal — for Five Case / EconomicCaseBlock */
export const VALUE = {
  positive: { text: "#1a7a5e", bg: "#e6f4f1", label: "Positive"  },
  neutral:  { text: "#64748b", bg: "#f8fafc", label: "Neutral"   },
  negative: { text: "#c0392b", bg: "#fef2f2", label: "Negative"  },
  gold:     { text: "#b45309", bg: "#fef3c7", label: "Value"     },  // headline NPV / BCR figures
} as const;

export type ValueSignal = keyof typeof VALUE;

// ---------------------------------------------------------------------------
// Layer 3 — Data-vis categorical palette
// 6 colours, colour-blind safe, no overlap with semantic layer
// ---------------------------------------------------------------------------

export const VIS_PALETTE = [
  "#098BC3",  // vis-1  blue
  "#006E51",  // vis-2  CPC green
  "#7c3aed",  // vis-3  violet
  "#ea7317",  // vis-4  orange
  "#c2185b",  // vis-5  rose
  "#64748b",  // vis-6  slate
] as const;

/** Recharts / ECharts compatible series colour for index n */
export function visColour(index: number): string {
  return VIS_PALETTE[index % VIS_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Tailwind className helpers
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind utility classes for evidence state badges.
 * Usage:  <span className={evidenceClass("verified")}>Verified</span>
 */
export function evidenceClass(state: EvidenceState): string {
  const map: Record<EvidenceState, string> = {
    verified:  "text-evidence-verified  bg-evidence-verified-bg  border-evidence-verified/30",
    partial:   "text-evidence-partial   bg-evidence-partial-bg   border-evidence-partial/30",
    inferred:  "text-evidence-inferred  bg-evidence-inferred-bg  border-evidence-inferred/30",
    unknown:   "text-evidence-unknown   bg-evidence-unknown-bg   border-evidence-unknown/30",
    contested: "text-evidence-contested bg-evidence-contested-bg border-evidence-contested/30",
  };
  return map[state];
}

/**
 * Returns Tailwind utility classes for confidence tier badges.
 * Usage:  <Badge className={tierClass("Supported")}>Supported</Badge>
 */
export function tierClass(tier: ConfidenceTier): string {
  const map: Record<ConfidenceTier, string> = {
    Speculative: "text-tier-speculative bg-tier-speculative-bg border-tier-speculative/30",
    Indicative:  "text-tier-indicative  bg-tier-indicative-bg  border-tier-indicative/30",
    Supported:   "text-tier-supported   bg-tier-supported-bg   border-tier-supported/30",
    Robust:      "text-tier-robust      bg-tier-robust-bg      border-tier-robust/30",
  };
  return map[tier];
}

/**
 * Returns Tailwind utility classes for gap magnitude indicators.
 * Usage:  <div className={gapClass("major")}>...</div>
 */
export function gapClass(magnitude: GapMagnitude): string {
  const map: Record<GapMagnitude, string> = {
    minor:   "text-gap-minor   bg-gap-minor-bg   border-gap-minor/30",
    medium:  "text-gap-medium  bg-gap-medium-bg  border-gap-medium/30",
    major:   "text-gap-major   bg-gap-major-bg   border-gap-major/30",
    blocker: "text-gap-blocker bg-gap-blocker-bg border-gap-blocker/30",
  };
  return map[magnitude];
}

/**
 * Returns Tailwind utility classes for value signal highlights.
 * Usage:  <span className={valueClass("positive")}>+£2.4m NPV</span>
 */
export function valueClass(signal: ValueSignal): string {
  const map: Record<ValueSignal, string> = {
    positive: "text-value-positive bg-value-positive-bg",
    neutral:  "text-value-neutral  bg-value-neutral-bg",
    negative: "text-value-negative bg-value-negative-bg",
    gold:     "text-value-gold     bg-value-gold-bg font-semibold",
  };
  return map[signal];
}

// ---------------------------------------------------------------------------
// Gap magnitude inference helper
// (used by DimensionGap block renderer when gap_score is a number 0-1)
// ---------------------------------------------------------------------------

export function inferGapMagnitude(score: number): GapMagnitude {
  if (score >= 0.75) return "blocker";
  if (score >= 0.5)  return "major";
  if (score >= 0.25) return "medium";
  return "minor";
}

// ---------------------------------------------------------------------------
// Confidence tier inference helper
// (used to convert string from agent output to typed tier key)
// ---------------------------------------------------------------------------

export function toConfidenceTier(raw: string): ConfidenceTier {
  const normalised = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (normalised in CONFIDENCE_TIER) return normalised as ConfidenceTier;
  return "Speculative";
}
