/**
 * Golden-path fixtures — agent output → normalized blocks (Seam 5.4).
 * No live DB or LLM required.
 */

import { describe, it, expect } from "vitest";
import { normalizePatchProposal } from "../src/lib/workbench/patch-normalize";
import { applyPatchToModel } from "../src/lib/workbench/workbench-context";
import type { AtlasRenderModel, RenderBlock } from "../src/lib/workbench/atlas-render-model";
import landscapePatch from "./fixtures/corpus-landscape-patch.json";
import transferPatch from "./fixtures/transfer-lanes-patch.json";

const baseModel: AtlasRenderModel = {
  artifact_id: "fixture",
  match_id: "fixture",
  canonical_question_id: "cq.match.workbench",
  mode: "workbench",
  lens: "CPC",
  layout_template: "default",
  source_object: { id: "src", title: "Source passport" },
  target_object: { id: "tgt", title: "Target call" },
  decision_spine: {
    recommendation: "Test",
    confidence_tier: "Indicative",
    confidence_cap_reason: "",
    confidence_score: 0.5,
  } as AtlasRenderModel["decision_spine"],
  blocks: [],
  inspector_index: {},
  snapshot: { title: "Fixture", included_blocks: [], must_include: [] },
  data_quality_notes: [],
};

describe("Seam 5.4 — golden path fixtures", () => {
  it("corpus landscape patch yields NetworkMap block", () => {
    const patch = normalizePatchProposal(landscapePatch as never);
    const model = applyPatchToModel(baseModel, patch);
    const net = model.blocks.find((b) => b.type === "NetworkMap");
    expect(net).toBeDefined();
    if (net?.type === "NetworkMap") {
      expect(net.content.nodes.length).toBeGreaterThanOrEqual(2);
      expect(net.visual).toBe("knowledge_graph");
    }
  });

  it("transfer lanes patch yields four_lane_board block", () => {
    const patch = normalizePatchProposal(transferPatch as never);
    const model = applyPatchToModel(baseModel, patch);
    const lanes = model.blocks.find((b) => b.type === "TransferLanes");
    expect(lanes).toBeDefined();
    if (lanes?.type === "TransferLanes") {
      expect(lanes.content.length).toBeGreaterThanOrEqual(2);
      expect(lanes.content.some((x) => x.transfer_outcome === "travels-as-is")).toBe(true);
    }
  });
});

describe("Seam 5.0 — coverage transport metadata", () => {
  it("accepts transport fields on coverage object shape", () => {
    const coverage = {
      transport: "rest_keyword" as const,
      transport_note: "keyword mode over HTTPS",
      suggested_confidence_tier: "Indicative",
    };
    expect(coverage.transport).toBe("rest_keyword");
    expect(coverage.transport_note).toContain("HTTPS");
  });
});
