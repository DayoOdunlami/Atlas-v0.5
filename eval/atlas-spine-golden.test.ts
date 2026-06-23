import { describe, expect, it } from "vitest";

import {
  assembleJ1T1Spec,
  buildJ1T1SpecFromStats,
  formatGbpCompact,
} from "../src/lib/atlas/j1t1-spec-assembler";
import type { J1T1CorpusStats } from "../src/lib/atlas/j1t1-types";
import { validateGoldenFixture } from "../src/lib/atlas/golden-j1t1";
import {
  TIER_CEILING_FRACTION,
  validateFinalAnswerSpec,
} from "../src/lib/atlas/contracts/answer-spec.schema";

const MOCK_STATS: J1T1CorpusStats = {
  project_count: 55,
  funding_sum: 8_172_702.05,
  null_funding_count: 18,
  funded_row_count: 37,
  org_count: 30,
  live_since_2024: 27,
  funders: [
    {
      lead_funder: "Innovate UK",
      project_count: 36,
      null_funding_count: 1,
      funding_sum: 7_903_940.05,
    },
    {
      lead_funder: "EPSRC",
      project_count: 15,
      null_funding_count: 15,
      funding_sum: 0,
    },
  ],
  top_citations: [
    {
      id: "bb918318-0000-4000-8000-000000000001",
      title: "25kV Battery Train Charging Station Demonstration",
      organisation: "Innovate UK",
      score: 0.95,
    },
  ],
  queried_at: "2026-06-17T00:00:00.000Z",
};

describe("GATE 0b — J1T1 golden fixture", () => {
  it("validates against AnswerSpec v0.2.1", () => {
    const { ok, issues } = validateGoldenFixture();
    expect(issues).toEqual([]);
    expect(ok).toBe(true);
  });

  it("exposes four-tier ceiling fractions", () => {
    expect(TIER_CEILING_FRACTION.Supported).toBe(0.66);
    expect(TIER_CEILING_FRACTION.Speculative).toBe(0.28);
  });
});

describe("GATE 1 — J1T1 spec bootstrap", () => {
  it("formats GBP compact for corpus floor", () => {
    expect(formatGbpCompact(8_172_702.05)).toBe("£8.17m");
    expect(formatGbpCompact(11_700_000_000, { approximate: true })).toBe("~£11.7bn");
  });

  it("assembles validated AnswerSpec from mock corpus stats", () => {
    const spec = buildJ1T1SpecFromStats(MOCK_STATS);
    expect(spec.specVersion).toBe("0.2.1");
    expect(spec.stats?.[0]?.value).toBe("55");
    expect(spec.stats?.[1]?.value).toBe("£8.17m");
    expect(spec.instrument?.recipe).toBe("IncommensurableMagnitudes");
    expect(spec.instrument?.honesty?.toScale).toBe(false);
    expect(spec.blindspot?.structure?.pattern).toMatch(/EPSRC/);
    expect(spec.corpus_citations[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("exports assembleJ1T1Spec alias", () => {
    expect(assembleJ1T1Spec(MOCK_STATS).tier).toBe("Supported");
  });
});

describe("GATE 3 — NetworkMap instrument shape", () => {
  it("accepts NetworkMap recipe in AnswerSpec instrument slot", () => {
    const orient = buildJ1T1SpecFromStats(MOCK_STATS);
    const connect = {
      ...orient,
      mode: "Connect" as const,
      instrument: {
        recipe: "NetworkMap",
        data: {
          nodes: [{ id: "rail", label: "Rail", group: "mode", x: 100, y: 100 }],
          edges: [],
          ladderRung: "typed-inventory",
          layout: "none",
        },
        honesty: { toScale: false, label: "typed inventory" },
      },
      carriedFrom: {
        turn: 2,
        summary: "Orient carry-forward",
        fromTurns: [1],
      },
    };
    const result = validateFinalAnswerSpec(connect);
    expect(result.success).toBe(true);
  });
});
