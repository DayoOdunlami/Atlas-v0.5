"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export function VerdictHero({ verdict }: { verdict: AnswerSpec["verdict"] }) {
  const sentence = verdict.sentence;
  const blindIdx = sentence.indexOf("blind");
  const head = blindIdx > 0 ? sentence.slice(0, blindIdx) : sentence;
  const tailPhrase = blindIdx > 0 ? sentence.slice(blindIdx) : null;

  return (
    <div data-testid="verdict-hero" className="mb-4 max-w-[690px]">
      <h1
        style={{
          fontFamily: atlasFont.serif,
          fontWeight: 500,
          fontSize: 39,
          lineHeight: 1.13,
          color: T.ink,
          margin: "0 0 12px",
          letterSpacing: "-0.018em",
        }}
      >
        {tailPhrase ? (
          <>
            {head}
            <span style={{ fontStyle: "italic", color: T.gap }}>{tailPhrase}</span>
          </>
        ) : (
          sentence
        )}
      </h1>
      {verdict.tail ? (
        <p
          style={{
            fontFamily: atlasFont.sans,
            fontSize: 16.5,
            lineHeight: 1.5,
            color: "#46423C",
            margin: 0,
            maxWidth: 660,
          }}
        >
          {verdict.tail}
        </p>
      ) : null}
    </div>
  );
}
