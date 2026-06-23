"use client";

import { CountAnimation } from "@/components/ui/ui/count-animation";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type Stat = NonNullable<AnswerSpec["stats"]>[number];

function parseStatNumber(value: string): number | null {
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** North Star — stats below instrument, mono numbers, subdued */
export function StatStripSubordinate({
  stats,
  onProv,
  animateNumbers = false,
}: {
  stats: Stat[];
  onProv?: (provId: string) => void;
  animateNumbers?: boolean;
}) {
  return (
    <div
      data-testid="stat-strip"
      className="mb-[22px] flex max-w-[560px] border-t"
      style={{ borderColor: "#E7E3DC" }}
    >
      {stats.map((s, i) => {
        const n = parseStatNumber(s.value);
        const showTicker = animateNumbers && n !== null && !s.value.includes("£");
        return (
          <button
            key={`${s.label}-${i}`}
            type="button"
            onClick={() => (s.provId ? onProv?.(s.provId) : undefined)}
            className="flex-1 border-none text-left"
            style={{
              padding: "13px 16px 0 0",
              background: "transparent",
              cursor: s.provId ? "pointer" : "default",
              borderLeft: i ? `1px solid #E7E3DC` : "none",
              paddingLeft: i ? 16 : 0,
            }}
          >
            <div style={{ fontFamily: atlasFont.mono, fontSize: 19, color: T.ink }}>
              {showTicker ? <CountAnimation number={n} /> : s.value}
            </div>
            <div style={{ fontSize: 11, color: "#8C887F", marginTop: 4 }}>{s.label}</div>
          </button>
        );
      })}
    </div>
  );
}