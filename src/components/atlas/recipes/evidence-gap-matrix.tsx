"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type Dimension = {
  id?: string;
  label?: string;
  verdict?: string;
  signal?: string;
  move?: string;
};

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  HAVE: { bg: T.corpusWash, border: "#CFE0D4", color: T.corpus },
  PARTIAL: { bg: "#FBF9F4", border: "#EAE4D8", color: "#7A6A50" },
  GAP: { bg: T.gapWash, border: `${T.gap}44`, color: T.gap },
  MOVE: { bg: "#FFF7ED", border: "#FDBA74", color: "#9A3412" },
};

export function EvidenceGapMatrix({
  instrument,
}: {
  instrument: NonNullable<AnswerSpec["instrument"]>;
}) {
  const data = instrument.data as { dimensions?: Dimension[] };
  const dimensions = data.dimensions ?? [];

  return (
    <div data-testid="evidence-gap-matrix" className="mb-6 max-w-[720px]">
      <div
        className="mb-3 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#56524C",
        }}
      >
        Evidence gaps · ranked dimensions
      </div>
      <div className="flex flex-col gap-2">
        {dimensions.map((dim, i) => {
          const v = (dim.verdict ?? "GAP").toUpperCase();
          const style = VERDICT_STYLE[v] ?? VERDICT_STYLE.GAP;
          return (
            <div
              key={dim.id ?? i}
              className="rounded-lg border px-4 py-3"
              style={{ background: style.bg, borderColor: style.border }}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: T.ink }}>
                  {dim.label}
                </span>
                <span
                  style={{
                    fontFamily: atlasFont.mono,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    color: style.color,
                  }}
                >
                  {v}
                </span>
              </div>
              {dim.signal ? (
                <p className="m-0 text-xs leading-relaxed" style={{ color: "#56524C" }}>
                  {dim.signal}
                </p>
              ) : null}
              {dim.move ? (
                <p className="mb-0 mt-2 text-xs font-medium" style={{ color: T.inkSoft }}>
                  → {dim.move}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
