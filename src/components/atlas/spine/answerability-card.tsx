"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type Blindspot = NonNullable<AnswerSpec["blindspot"]>;

export function AnswerabilityCard({ blindspot }: { blindspot: Blindspot }) {
  const isAbsence = blindspot.sign === "absence";
  const accent = isAbsence ? T.inkFaint : T.gap;
  const wash = isAbsence ? T.ruleSoft : T.gapWash;
  const heading = isAbsence ? "What this answer cannot establish" : "What this answer can't see";

  return (
    <div
      data-testid="answerability-card"
      data-sign={blindspot.sign}
      className="relative mb-5 rounded-lg px-[18px] py-4"
      style={{
        background: wash,
        border: `1px solid ${accent}33`,
        backgroundImage: isAbsence
          ? undefined
          : `repeating-linear-gradient(135deg, transparent 0 9px, ${T.gap}0c 9px 10px)`,
      }}
    >
      {!isAbsence ? (
        <div
          className="absolute left-0 right-0 top-0 h-1 opacity-50"
          style={{
            background: `repeating-linear-gradient(90deg, ${T.gap} 0 4px, transparent 4px 9px)`,
          }}
          aria-hidden
        />
      ) : null}
      <div
        className="mb-2 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: accent,
        }}
      >
        ⚠ {heading}
      </div>
      <div style={{ fontFamily: atlasFont.sans, fontSize: 13.5, lineHeight: 1.55, color: T.inkSoft }}>
        {blindspot.gap}
        {blindspot.closable ? (
          <>
            {" "}
            <strong style={{ color: T.ink }}>{blindspot.closable}</strong>
          </>
        ) : null}
      </div>
      {blindspot.secondary ? (
        <div
          className="mt-2"
          style={{ fontFamily: atlasFont.sans, fontSize: 12.5, lineHeight: 1.5, color: T.inkFaint }}
        >
          {blindspot.secondary}
        </div>
      ) : null}
      {blindspot.structure ? (
        <div
          className="mt-3 rounded-md border px-3 py-2.5"
          style={{ borderColor: `${T.gap}44`, background: "rgba(255,255,255,0.5)" }}
        >
          <div
            className="mb-1 uppercase"
            style={{ fontFamily: atlasFont.mono, fontSize: 9, letterSpacing: "0.1em", color: T.gap }}
          >
            Structural pattern
          </div>
          <div style={{ fontFamily: atlasFont.sans, fontSize: 12.5, lineHeight: 1.5, color: T.inkSoft }}>
            {blindspot.structure.pattern}
          </div>
          <div
            className="mt-2"
            style={{ fontFamily: atlasFont.sans, fontSize: 12, lineHeight: 1.45, color: T.ink, fontWeight: 500 }}
          >
            {blindspot.structure.implication}
          </div>
        </div>
      ) : null}
    </div>
  );
}
