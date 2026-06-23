"use client";

import type { ConfidenceTier } from "@/lib/atlas5/types";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export type TrustScope = "corpus" | "web" | "synthesized";

/** Corpus-solid / web-dashed material swatch */
export function TrustSwatch({ trust }: { trust: TrustScope }) {
  const isCorpus = trust === "corpus";
  const color = isCorpus ? T.corpus : T.web;
  return (
    <span
      data-testid={`trust-swatch-${trust}`}
      className="inline-block shrink-0 rounded-sm"
      style={{
        width: 10,
        height: 10,
        background: isCorpus ? color : "transparent",
        border: isCorpus ? "none" : `1.5px dashed ${color}`,
      }}
    />
  );
}

export function TrustBadge({
  trust,
  label,
}: {
  trust: TrustScope;
  label?: string;
}) {
  const isCorpus = trust === "corpus";
  const color = isCorpus ? T.corpus : T.web;
  return (
    <span
      data-testid={`trust-badge-${trust}`}
      className="inline-flex items-center gap-1.5"
      style={{ fontFamily: atlasFont.mono, fontSize: 10, letterSpacing: "0.08em", color, textTransform: "uppercase" }}
    >
      <TrustSwatch trust={trust} />
      {label ?? `Trust · ${trust}`}
    </span>
  );
}

export function SourceBadge({
  source,
  title,
}: {
  source: TrustScope;
  title: string;
}) {
  return (
    <span
      data-testid="source-badge"
      className="inline-flex items-center gap-2 rounded px-2 py-0.5"
      style={{
        fontFamily: atlasFont.mono,
        fontSize: 10,
        border: source === "corpus" ? `1px solid ${T.corpus}` : `1px dashed ${T.web}`,
        color: source === "corpus" ? T.corpus : "#3E5566",
        background: source === "corpus" ? T.corpusWash : "#EDF1F6",
      }}
    >
      <TrustSwatch trust={source} />
      {title}
    </span>
  );
}

export function TierBadge({ tier }: { tier: ConfidenceTier }) {
  return (
    <div
      data-testid="tier-badge"
      style={{
        fontFamily: atlasFont.mono,
        fontSize: 10.5,
        letterSpacing: "0.08em",
        color: T.corpus,
        border: `1px solid ${T.corpus}`,
        borderRadius: 4,
        padding: "3px 8px",
        textTransform: "uppercase",
      }}
    >
      {tier}
    </div>
  );
}
