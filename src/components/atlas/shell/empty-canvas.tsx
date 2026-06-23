"use client";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export function EmptyCanvas() {
  return (
    <div
      data-testid="atlas-empty-canvas"
      className="flex flex-1 flex-col items-center justify-center px-12 py-24 text-center"
    >
      <p
        className="mb-2 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.14em",
          color: T.inkFaint,
        }}
      >
        Canvas at rest
      </p>
      <p className="max-w-md text-base" style={{ color: "#56524C" }}>
        Chat-first turns stay here until Atlas has enough signal to compose a canvas — e.g.
        state of play on a topic, map an ecosystem, or a company transfer into rail.
      </p>
    </div>
  );
}
