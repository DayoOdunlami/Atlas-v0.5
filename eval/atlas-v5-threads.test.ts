import { describe, expect, it } from "vitest";

import { extractLayoutSignals, titleFromQuery } from "../src/lib/atlas/layout-signals";
import { nextTurnIndexFromRows } from "../src/lib/atlas/turn-index";

describe("layout-signals", () => {
  it("extracts recipe and markup hash from spec", () => {
    const signals = extractLayoutSignals(
      {
        mode: "Orient",
        tier: "Supported",
        verdict: { sentence: "Test", tail: null },
        soWhat: {
          lookingAt: "x",
          oneDecision: "y",
          gate: "z",
          primaryAction: "a",
          turn: "b",
        },
        instrument: { recipe: "NetworkMap", data: {} },
        canvas: { markup: "<div>hello</div>", gate_status: "pass" },
      },
      {
        route: "substantive",
        disposition: { composition_mode: "free_compose" },
        keyed_keys: ["a", "b"],
      },
    );
    expect(signals.instrument_recipe).toBe("NetworkMap");
    expect(signals.markup_hash).toMatch(/^h/);
    expect(signals.keyed_key_count).toBe(2);
  });

  it("truncates titles", () => {
    expect(titleFromQuery("hello")).toBe("hello");
    expect(titleFromQuery("x".repeat(100)).length).toBeLessThanOrEqual(72);
  });
});

describe("nextTurnIndexFromRows", () => {
  it("returns 0 for empty and max+1 otherwise", () => {
    expect(nextTurnIndexFromRows([])).toBe(0);
    const rows = [{ turn_index: 0 }, { turn_index: 2 }];
    expect(nextTurnIndexFromRows(rows)).toBe(3);
  });
});
