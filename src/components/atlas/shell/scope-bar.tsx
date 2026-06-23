"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { TierBadge } from "@/components/atlas/spine/trust-badge";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const MODES: Array<{ ab: string; full: AnswerSpec["mode"] }> = [
  { ab: "Or", full: "Orient" },
  { ab: "Cn", full: "Connect" },
  { ab: "Dg", full: "Diagnose" },
  { ab: "Ac", full: "Act" },
  { ab: "Df", full: "Defend" },
];

export function ScopeBar({
  object,
  scope,
  mode,
  tier,
}: Pick<AnswerSpec, "object" | "scope" | "mode" | "tier">) {
  return (
    <div
      data-testid="scope-bar"
      className="flex items-center gap-4 border-b px-6 py-4"
      style={{ borderColor: "#E7E3DC", background: T.canvas }}
    >
      <div className="flex gap-1.5">
        {MODES.map(({ ab, full }) => {
          const on = full === mode;
          return (
            <div
              key={ab}
              title={full}
              className="grid place-items-center rounded-md"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 11,
                width: 26,
                height: 26,
                background: on ? T.ink : "transparent",
                color: on ? T.canvas : T.inkFaint,
                border: on ? "none" : `1px solid ${T.ruleSoft}`,
              }}
            >
              {ab}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: atlasFont.serif, fontSize: 17, color: T.ink, fontWeight: 500 }}>
        {object}
      </div>
      <div
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10.5,
          letterSpacing: "0.1em",
          color: T.inkFaint,
        }}
      >
        {scope}
      </div>
      <div className="flex-1" />
      <TierBadge tier={tier} />
    </div>
  );
}
