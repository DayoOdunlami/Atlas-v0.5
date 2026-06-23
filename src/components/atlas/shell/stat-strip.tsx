"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type Stat = NonNullable<AnswerSpec["stats"]>[number];

export function StatStrip({
  stats,
  onProv,
}: {
  stats: Stat[];
  onProv?: (provId: string) => void;
}) {
  return (
    <div
      data-testid="stat-strip"
      className="mb-5 flex overflow-hidden rounded-[10px] border"
      style={{ borderColor: T.ruleSoft }}
    >
      {stats.map((s, i) => (
        <button
          key={`${s.label}-${i}`}
          type="button"
          onClick={() => (s.provId ? onProv?.(s.provId) : undefined)}
          className="relative flex-1 border-none text-left"
          style={{
            padding: "14px 16px",
            background: T.canvas,
            cursor: s.provId ? "pointer" : "default",
            borderLeft: i ? `1px solid ${T.ruleSoft}` : "none",
          }}
        >
          <div
            style={{
              fontFamily: atlasFont.serif,
              fontWeight: 500,
              fontSize: 26,
              color: T.corpus,
              lineHeight: 1,
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: T.inkFaint,
              marginTop: 6,
              letterSpacing: "0.04em",
            }}
          >
            {s.label}
          </div>
          {s.provId ? (
            <div
              className="absolute right-3 top-2.5"
              style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.corpus }}
            >
              ⌖
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
