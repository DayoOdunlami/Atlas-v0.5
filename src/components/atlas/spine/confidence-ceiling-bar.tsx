"use client";

import type { ConfidenceTier } from "@/lib/atlas5/types";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

/** North Star — horizontal confidence cap above canvas content */
export function ConfidenceCeilingBar({ tier }: { tier: ConfidenceTier }) {
  return (
    <div
      data-testid="confidence-ceiling-bar"
      data-tier={tier}
      className="relative z-[3] shrink-0 border-b px-12 py-3"
      style={{
        background: "linear-gradient(180deg,#F1EEE8 0%,#FBFAF7 100%)",
        borderColor: "#E3DFD7",
        boxShadow: "0 7px 14px -10px rgba(40,34,26,.22)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.13em",
            color: "#6B6760",
          }}
        >
          ▔ Confidence ceiling
        </div>
        <div
          className="flex items-center gap-1.5 rounded px-2 py-0.5"
          style={{ background: T.corpusWash, border: `1px solid #CFE0D4` }}
        >
          <span
            className="inline-block rounded-full"
            style={{ width: 5, height: 5, background: T.corpus }}
          />
          <span
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 9.5,
              color: "#2F5C3E",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            {tier.toUpperCase()}
          </span>
        </div>
        <div
          className="h-px flex-1"
          style={{
            background: `repeating-linear-gradient(90deg,#C9C4BB 0 6px,transparent 6px 11px)`,
          }}
        />
        <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
          the canvas cannot certify above this line — corpus layer only
        </div>
      </div>
    </div>
  );
}
