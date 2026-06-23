"use client";

import type { ConfidenceTier } from "@/lib/atlas5/types";
import { TIER_CEILING_FRACTION } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import type { ReactNode } from "react";

export function ConfidenceCeiling({
  tier,
  cappedReason,
  children,
}: {
  tier: ConfidenceTier;
  cappedReason?: string;
  children: ReactNode;
}) {
  const frac = TIER_CEILING_FRACTION[tier] ?? 0.66;

  return (
    <div
      data-testid="confidence-ceiling"
      data-tier={tier}
      data-ceiling-fraction={frac}
      className="relative rounded px-7 py-7"
      style={{
        background: T.canvas,
        boxShadow: "0 1px 3px rgba(0,0,0,.07), 0 12px 36px rgba(0,0,0,.06)",
      }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
        style={{
          top: `calc(${(1 - frac) * 100}%)`,
          borderColor: T.inkFaint,
          borderTopWidth: 1.5,
        }}
        aria-hidden
      >
        <div
          className="absolute -top-2.5 bg-[#FBFAF7] px-1.5 uppercase"
          style={{
            right: 10,
            fontFamily: atlasFont.mono,
            fontSize: 9.5,
            letterSpacing: "0.1em",
            color: T.inkFaint,
          }}
        >
          ▔ {tier} ceiling — canvas can&apos;t certify above this line
        </div>
      </div>
      {cappedReason ? (
        <p
          className="mb-4"
          style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
        >
          {cappedReason}
        </p>
      ) : null}
      {children}
    </div>
  );
}
