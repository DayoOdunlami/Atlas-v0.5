"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

/** North Star proportional geometry — ~1400× ratio as visible sliver */
const BAR_W = 158;
const UPPER_H = 206;
const GAP_H = 40;
const LOWER_H = 26;

type MagnitudeSide = {
  label?: string;
  display?: string;
  source?: string;
  note?: string;
};

type InstrumentData = {
  upper?: MagnitudeSide;
  lower?: MagnitudeSide;
  ratioLabel?: string;
  ratioNote?: string;
};

const tornBottom = `polygon(0 0, 100% 0, 100% calc(100% - 11px), 95% 100%, 90% calc(100% - 11px), 85% 100%, 80% calc(100% - 11px), 75% 100%, 70% calc(100% - 11px), 65% 100%, 60% calc(100% - 11px), 55% 100%, 50% calc(100% - 11px), 45% 100%, 40% calc(100% - 11px), 35% 100%, 30% calc(100% - 11px), 25% 100%, 20% calc(100% - 11px), 15% 100%, 10% calc(100% - 11px), 5% 100%, 0 calc(100% - 11px))`;

const tornTop = `polygon(0 11px, 5% 0, 10% 11px, 15% 0, 20% 11px, 25% 0, 30% 11px, 35% 0, 40% 11px, 45% 0, 50% 11px, 55% 0, 60% 11px, 65% 0, 70% 11px, 75% 0, 80% 11px, 85% 0, 90% 11px, 95% 0, 100% 11px, 100% 100%, 0 100%)`;

export function IncommensurableMagnitudes({
  instrument,
  onProv,
}: {
  instrument: NonNullable<AnswerSpec["instrument"]>;
  onProv?: (provId: string) => void;
}) {
  const data = instrument.data as InstrumentData;
  const upper = data.upper ?? {};
  const lower = data.lower ?? {};
  const honestyLabel = instrument.honesty?.label ?? "axis broken at the gap";

  return (
    <div data-testid="incommensurable-magnitudes" className="mb-2 max-w-[720px]">
      <div className="mb-4 flex items-baseline justify-between">
        <div
          className="uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#56524C",
          }}
        >
          The two-tier field · proportional
        </div>
        <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
          £ · {honestyLabel}
        </div>
      </div>

      <div className="flex items-stretch gap-[26px]">
        {/* Proportional bar column */}
        <div className="flex shrink-0 flex-col" style={{ width: BAR_W }}>
          <button
            type="button"
            onClick={() => onProv?.("mag-upper")}
            className="relative cursor-pointer overflow-hidden border border-b-0 border-dashed text-center"
            style={{
              height: UPPER_H,
              background: "linear-gradient(180deg,#EEF2F7 0%,#E0E9F1 100%)",
              borderColor: "#AEC4D7",
              clipPath: tornBottom,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg,rgba(62,107,140,.07) 0 1px,transparent 1px 7px)",
              }}
            />
            <div className="absolute left-0 right-0 top-4">
              <div
                style={{
                  fontFamily: atlasFont.mono,
                  fontSize: 25,
                  fontWeight: 500,
                  color: "#2C4F68",
                  lineHeight: 1,
                }}
              >
                {upper.display ?? "—"}
              </div>
              <div style={{ fontSize: 10.5, color: "#5C7E96", marginTop: 6 }}>national programme</div>
            </div>
          </button>

          <div
            className="flex items-center justify-center"
            style={{
              height: GAP_H,
              background: "repeating-linear-gradient(135deg,#F7F0E2 0 6px,#FBFAF7 6px 12px)",
            }}
          >
            <span style={{ fontFamily: atlasFont.mono, fontSize: 13, color: T.gap }}>⇡⇣</span>
          </div>

          <button
            type="button"
            onClick={() => onProv?.("stat-corpus")}
            className="relative cursor-pointer overflow-hidden text-center"
            style={{
              height: LOWER_H,
              background: "linear-gradient(180deg,#3F7A52 0%,#356B47 100%)",
              clipPath: tornTop,
            }}
          >
            <div
              className="absolute bottom-1 left-0 right-0"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 11,
                color: "#EAF3EC",
                fontWeight: 600,
              }}
            >
              {lower.display ?? "—"}
            </div>
          </button>
        </div>

        {/* Zone-aligned annotations */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="border-l-2 border-dashed pl-4"
            style={{ height: UPPER_H, borderColor: T.web, paddingTop: 2 }}
          >
            <div
              className="mb-1.5 uppercase"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "#3E6B8C",
              }}
            >
              {upper.label ?? "National electrification programme"}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#46423C", margin: "0 0 12px" }}>
              What the corpus is structurally blind to. The multi-billion-pound infrastructure tier
              above the innovation layer.
            </p>
            {upper.note ? (
              <div style={{ fontSize: 12.5, color: "#5C6B78" }}>
                <span style={{ fontFamily: atlasFont.mono, color: "#3E6B8C" }}>→ </span>
                {upper.note}
              </div>
            ) : null}
            <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: "#7D97AC", marginTop: 12 }}>
              [W1·W2·W3] · web context, not corpus fact
            </div>
          </div>

          <div
            className="flex items-center pl-4"
            style={{ height: GAP_H }}
          >
            <div
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 20,
                fontWeight: 600,
                color: T.gap,
              }}
            >
              {data.ratioLabel}
            </div>
            <div style={{ fontSize: 12, color: "#9A7B47", marginLeft: 12, lineHeight: 1.35 }}>
              three orders of magnitude.
              <br />
              the gap <em>is</em> the finding.
            </div>
          </div>

          <div className="border-l-2 pl-4" style={{ borderColor: T.corpus, paddingTop: 6 }}>
            <div
              className="mb-1.5 uppercase"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                color: T.corpus,
              }}
            >
              {lower.label ?? "SME innovation layer"}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#46423C", margin: 0 }}>
              Everything the corpus can see.{" "}
              <span style={{ color: "#8C887F" }}>A floor, not a total.</span>
            </p>
            {lower.note ? (
              <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.corpus, marginTop: 6 }}>
                {lower.note}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
