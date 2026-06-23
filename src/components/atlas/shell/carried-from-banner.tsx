"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont } from "@/lib/atlas/tokens";

export function CarriedFromBanner({
  carriedFrom,
}: {
  carriedFrom: NonNullable<AnswerSpec["carriedFrom"]>;
}) {
  const turns =
    carriedFrom.fromTurns?.length > 0
      ? carriedFrom.fromTurns.join("–")
      : String(carriedFrom.turn - 1);

  return (
    <div
      data-testid="carried-from-banner"
      className="mb-5 flex max-w-[680px] items-center gap-2.5 rounded-r-md px-3 py-1.5"
      style={{ background: "#F4F1EB", borderLeft: "2px solid #CFC8BC" }}
    >
      <div
        className="shrink-0 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 9,
          letterSpacing: "0.1em",
          color: "#A39E96",
        }}
      >
        ↑ carried from Turn{carriedFrom.fromTurns?.length !== 1 ? "s" : ""} {turns}
      </div>
      <div className="text-xs" style={{ color: "#8C887F" }}>
        {carriedFrom.summary}
      </div>
    </div>
  );
}
