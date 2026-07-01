/** KB validation tier labels for corpus document citations (review workflow). */

export type KbValidationTier =
  | "T1_anchor"
  | "T2_embedded"
  | "T3_thin"
  | "T4_candidate"
  | "T0_retired";

export const KB_VALIDATION_TIER_LABEL: Record<KbValidationTier, string> = {
  T1_anchor: "T1 Anchor",
  T2_embedded: "T2 Embedded",
  T3_thin: "T3 Thin",
  T4_candidate: "T4 Candidate",
  T0_retired: "Retired",
};

export const KB_VALIDATION_TIER_STYLE: Record<KbValidationTier, string> = {
  T1_anchor:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  T2_embedded:
    "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  T3_thin:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  T4_candidate:
    "bg-muted text-muted-foreground border-border",
  T0_retired:
    "bg-muted text-muted-foreground border-border line-through",
};

export function kbValidationTierLabel(tier: string | undefined | null): string | null {
  if (!tier) return null;
  return KB_VALIDATION_TIER_LABEL[tier as KbValidationTier] ?? tier;
}

export function kbValidationTierStyle(tier: string | undefined | null): string {
  if (!tier) return "bg-muted text-muted-foreground border-border";
  return KB_VALIDATION_TIER_STYLE[tier as KbValidationTier] ?? "bg-muted text-muted-foreground border-border";
}
