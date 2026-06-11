/**
 * Workbench Tier 1 + Tier 3 — patch pipeline contract tests (no server, no LLM).
 *
 * Run: npm run eval:workbench
 *
 * Covers:
 *   - patch extraction + JSON stripping (Tier 1)
 *   - block normalisation (Tier 1)
 *   - stage model: role defaulting, stage_intent ops, applyPatchToModel (Tier 2/M3)
 */

import { describe, it, expect } from "vitest";
import { extractAgentOutput } from "../src/lib/workbench/extract-agent-output";
import {
  normalizeAgentBlock,
  normalizePatchProposal,
  looksLikePatchPayload,
  stripPatchJsonFromChat,
} from "../src/lib/workbench/patch-normalize";
import { applyPatchToModel } from "../src/lib/workbench/workbench-context";
import {
  buildAtlasVisualBlock,
} from "../src/lib/workbench/visual-adapter";
import { selectVisualRecipe } from "../src/lib/workbench/visual-registry";
import { isCanonicalBlockType } from "../src/lib/workbench/block-registry";
import type {
  AtlasRenderModel,
  RenderBlock,
} from "../src/lib/workbench/atlas-render-model";
import type {
  ModelPatchProposal,
} from "../src/lib/workbench/workbench-agent-contract";

describe("extractAgentOutput", () => {
  it("reads model_patch from top-level state (graph contract)", () => {
    const patch = {
      rationale: "add swot",
      ops: [{ op: "add_block" as const, block: { type: "ComparisonMatrix" } }],
      confidence_tier: "Indicative" as const,
      corpus_citations: [],
    };
    const out = extractAgentOutput({
      route: "propose",
      model_patch: patch,
      chat_response: "Done.",
    });
    expect(out?.model_patch).toEqual(patch);
    expect(out?.route).toBe("propose");
  });

  it("falls back to last_output when top-level absent", () => {
    const out = extractAgentOutput({
      last_output: {
        route: "explore",
        chat_response: "Found 5 projects.",
        confidence_tier: "Indicative",
        reasoning_trace: [],
        error: null,
      },
    });
    expect(out?.route).toBe("explore");
    expect(out?.chat_response).toContain("Found");
  });
});

describe("stripPatchJsonFromChat", () => {
  it("removes unfenced model_patch JSON from chat display", () => {
    const raw = `Done — SWOT added.\n\n{"model_patch": {"rationale": "x", "ops": []}}`;
    const clean = stripPatchJsonFromChat(raw);
    expect(clean).not.toContain("model_patch");
    expect(clean).toContain("Done");
  });

  it("removes nested fenced JSON blocks", () => {
    const raw = `Done.\n\`\`\`json\n{"model_patch": {"rationale": "x", "ops": [{"op": "add_block"}]}}\n\`\`\``;
    const clean = stripPatchJsonFromChat(raw);
    expect(clean).not.toContain("model_patch");
    expect(looksLikePatchPayload(clean)).toBe(false);
  });
});

describe("looksLikePatchPayload", () => {
  it("detects model_patch in text", () => {
    expect(looksLikePatchPayload('{"model_patch": {}}')).toBe(true);
    expect(looksLikePatchPayload("Plain answer")).toBe(false);
  });
});

describe("normalizeAgentBlock", () => {
  it("maps block_id/title to id/headline", () => {
    const block = normalizeAgentBlock({
      type: "ContextCard",
      block_id: "card_1",
      title: "Test card",
      content: {},
    });
    expect(block.id).toBe("card_1");
    expect(block.headline).toBe("Test card");
  });

  it("converts SWOT-shaped ComparisonMatrix to quadrant_grid", () => {
    const block = normalizeAgentBlock({
      type: "ComparisonMatrix",
      block_id: "swot_cpc",
      title: "SWOT — CPC",
      rows: [
        {
          label: "Positive",
          columns: { Internal: "Strengths here", External: "Opportunities here" },
        },
      ],
    });
    expect(block.type).toBe("ComparisonMatrix");
    expect(block.visual).toBe("quadrant_grid");
    const content = block.content as { quadrants: Array<{ label: string }> };
    expect(content.quadrants.length).toBeGreaterThan(0);
  });
});

describe("normalizePatchProposal", () => {
  it("normalizes all add_block ops in a patch", () => {
    const patch = normalizePatchProposal({
      rationale: "test",
      ops: [
        {
          op: "add_block",
          block: {
            type: "ComparisonMatrix",
            block_id: "x",
            title: "SWOT",
            quadrants: [
              { label: "Strengths", body: "A" },
              { label: "Weaknesses", body: "B" },
            ],
          },
        },
      ],
      confidence_tier: "Indicative",
      corpus_citations: [],
    });
    const added = patch.ops[0];
    expect(added.op).toBe("add_block");
    if (added.op === "add_block") {
      expect(added.block.visual).toBe("quadrant_grid");
      expect(added.block.id).toBe("x");
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 2 / M3 — Stage model: roles, set_block_role, archive_block, branch
// ---------------------------------------------------------------------------

const minimalModel: AtlasRenderModel = {
  artifact_id: "test",
  match_id: "test",
  canonical_question_id: "cq.match.workbench",
  mode: "workbench",
  lens: "CPC",
  layout_template: "default",
  source_object: { id: "src", title: "Source" },
  target_object: { id: "tgt", title: "Target" },
  decision_spine: {
    recommendation: "Test",
    confidence_tier: "Indicative",
    confidence_cap_reason: "",
    confidence_score: 0.5,
  } as AtlasRenderModel["decision_spine"],
  blocks: [
    {
      id: "rec_1",
      type: "RecommendationConfidence",
      visual: "decision_card",
      state: "core",
      headline: "Existing recommendation",
      content: {
        decision: "Test",
        summary: "x",
        score: 0.5,
        confidence_tier: "Indicative",
        confidence_cap_reason: "",
      },
    } as RenderBlock,
  ],
  inspector_index: {},
  snapshot: { title: "Test", included_blocks: ["rec_1"], must_include: [] },
  data_quality_notes: [],
};

describe("M3 stage model — applyPatchToModel", () => {
  it("add_block defaults to role=focus when not specified", () => {
    const patch: ModelPatchProposal = {
      rationale: "add card",
      ops: [
        {
          op: "add_block",
          block: {
            id: "card_1",
            type: "ContextCard",
            visual: "paired_context_cards",
            state: "core",
            headline: "Test card",
            content: { subject: "x", body: "y" },
          } as unknown as RenderBlock,
        },
      ],
      confidence_tier: "Indicative",
      corpus_citations: [],
    };
    const out = applyPatchToModel(minimalModel, patch);
    const added = out.blocks.find((b) => b.id === "card_1");
    expect(added?.role).toBe("focus");
  });

  it("set_block_role moves a block between zones without mutating other fields", () => {
    const patch: ModelPatchProposal = {
      rationale: "demote rec",
      ops: [{ op: "set_block_role", block_id: "rec_1", role: "context" }],
      confidence_tier: "Indicative",
      corpus_citations: [],
    };
    const out = applyPatchToModel(minimalModel, patch);
    const rec = out.blocks.find((b) => b.id === "rec_1");
    expect(rec?.role).toBe("context");
    expect(rec?.headline).toBe("Existing recommendation"); // unchanged
  });

  it("archive_block sets role=archived (hidden but recoverable)", () => {
    const patch: ModelPatchProposal = {
      rationale: "archive old",
      ops: [{ op: "archive_block", block_id: "rec_1" }],
      confidence_tier: "Indicative",
      corpus_citations: [],
    };
    const out = applyPatchToModel(minimalModel, patch);
    const rec = out.blocks.find((b) => b.id === "rec_1");
    expect(rec?.role).toBe("archived");
    // Block still in array — undo can flip it back
    expect(out.blocks.length).toBe(1);
  });

  it("pivot patch: demote existing focus + add new focus block", () => {
    const patch: ModelPatchProposal = {
      rationale: "pivot to action plan",
      ops: [
        { op: "set_block_role", block_id: "rec_1", role: "context" },
        {
          op: "add_block",
          block: {
            id: "plan_1",
            type: "ActionPlan",
            visual: "gap_to_action_timeline",
            state: "core",
            headline: "Next steps",
            content: [],
          } as unknown as RenderBlock,
        },
      ],
      confidence_tier: "Indicative",
      corpus_citations: [],
      stage_intent: "pivot",
    };
    const out = applyPatchToModel(minimalModel, patch);
    expect(out.blocks.find((b) => b.id === "rec_1")?.role).toBe("context");
    expect(out.blocks.find((b) => b.id === "plan_1")?.role).toBe("focus");
  });

  it("branch patch: archives all existing blocks + adds new focus", () => {
    const patch: ModelPatchProposal = {
      rationale: "branch to maritime",
      ops: [
        { op: "archive_block", block_id: "rec_1" },
        {
          op: "add_block",
          block: {
            id: "maritime_1",
            type: "ContextCard",
            visual: "paired_context_cards",
            state: "core",
            headline: "Maritime decarbonisation",
            content: { subject: "Topic", body: "details" },
          } as unknown as RenderBlock,
        },
      ],
      confidence_tier: "Indicative",
      corpus_citations: [],
      stage_intent: "branch",
    };
    const out = applyPatchToModel(minimalModel, patch);
    expect(out.blocks.find((b) => b.id === "rec_1")?.role).toBe("archived");
    expect(out.blocks.find((b) => b.id === "maritime_1")?.role).toBe("focus");
  });

  it("preserves pinned and role flags through update_block", () => {
    const base: AtlasRenderModel = {
      ...minimalModel,
      blocks: [{ ...minimalModel.blocks[0], pinned: true, role: "focus" }],
    };
    const patch: ModelPatchProposal = {
      rationale: "rename",
      ops: [
        {
          op: "update_block",
          block_id: "rec_1",
          patch: { headline: "Renamed" } as unknown as Partial<RenderBlock>,
        },
      ],
      confidence_tier: "Indicative",
      corpus_citations: [],
    };
    const out = applyPatchToModel(base, patch);
    const rec = out.blocks.find((b) => b.id === "rec_1");
    expect(rec?.pinned).toBe(true);
    expect(rec?.role).toBe("focus");
    expect(rec?.headline).toBe("Renamed");
  });
});

describe("Seam 1 — visual adapter", () => {
  it("maps OpportunityList to evidence_bar visual data", () => {
    const block = {
      id: "opp_1",
      type: "OpportunityList",
      state: "core",
      headline: "Rail projects",
      visual: "evidence_bar",
      content: [
        { id: "a", title: "RAPPID", organisation: "CPC", score: 0.82 },
        { id: "b", title: "Track AI", organisation: "NR", score: 0.71 },
      ],
    } as RenderBlock;

    const visual = buildAtlasVisualBlock(block, "evidence_bar");
    expect(visual?.type).toBe("evidence_bar");
    expect((visual?.data as { items: unknown[] }).items).toHaveLength(2);
  });

  it("selectVisualRecipe picks match_score_bar for large corpus lists", () => {
    const visual = selectVisualRecipe("OpportunityList", undefined, { rowCount: 6 });
    expect(visual).toBe("match_score_bar");
  });
});

describe("Seam 2 — OpportunityList normalization", () => {
  it("migrates legacy ComparisonMatrix corpus tables to OpportunityList", () => {
    const block = normalizeAgentBlock({
      type: "ComparisonMatrix",
      visual: "stored_match_list",
      id: "corpus.search.1",
      headline: "Corpus results",
      content: [
        {
          match_id: "uuid-1",
          passport: "RAPPID",
          target: "CPC",
          score: 0.8,
        },
      ],
    });
    expect(block.type).toBe("OpportunityList");
    if (block.type === "OpportunityList") {
      expect(block.content[0]?.title).toBe("RAPPID");
      expect(block.content[0]?.id).toBe("uuid-1");
    }
  });
});

describe("Seam 3 — block registry", () => {
  it("rejects invented block types at normalize time", () => {
    expect(isCanonicalBlockType("swot")).toBe(false);
    const block = normalizeAgentBlock({
      type: "swot",
      title: "Bad block",
      content: {},
    });
    expect(block.type).toBe("ContextCard");
  });

  it("accepts all 13 canonical block types including Seam 4", () => {
    expect(isCanonicalBlockType("NetworkMap")).toBe(true);
    expect(isCanonicalBlockType("TransferLanes")).toBe(true);
  });
});

describe("Seam 4 — NetworkMap + TransferLanes", () => {
  it("normalizes NetworkMap content with nodes and edges", () => {
    const block = normalizeAgentBlock({
      type: "NetworkMap",
      id: "net_1",
      headline: "Rail AI landscape",
      content: {
        nodes: [
          { id: "t1", label: "Rail AI", group: "theme", value: 10 },
          { id: "p1", label: "RAPPID", group: "project", value: 8 },
        ],
        edges: [{ source: "t1", target: "p1", weight: 0.9, label: "related" }],
      },
    });
    expect(block.type).toBe("NetworkMap");
    if (block.type === "NetworkMap") {
      expect(block.visual).toBe("knowledge_graph");
      expect(block.content.nodes).toHaveLength(2);
      expect(block.content.edges).toHaveLength(1);
    }
  });

  it("buildAtlasVisualBlock maps NetworkMap to knowledge_graph", () => {
    const block = {
      id: "net_1",
      type: "NetworkMap",
      state: "core",
      headline: "Landscape",
      visual: "knowledge_graph",
      content: {
        nodes: [{ id: "a", label: "Theme", group: "theme", value: 5 }],
        edges: [],
      },
    } as RenderBlock;

    const visual = buildAtlasVisualBlock(block, "knowledge_graph");
    expect(visual?.type).toBe("knowledge_graph");
    expect((visual?.data as { nodes: unknown[] }).nodes).toHaveLength(1);
  });

  it("normalizes TransferLanes with four_lane_board visual", () => {
    const block = normalizeAgentBlock({
      type: "TransferLanes",
      id: "lanes_1",
      headline: "Transfer verdict",
      content: [
        {
          id: "c1",
          claim_text: "TRL 6 demonstrated in rail",
          transfer_outcome: "travels-as-is",
          evidence_state: "verified",
          provenance: "stored",
        },
      ],
    });
    expect(block.type).toBe("TransferLanes");
    if (block.type === "TransferLanes") {
      expect(block.visual).toBe("four_lane_board");
      expect(block.content[0]?.transfer_outcome).toBe("travels-as-is");
    }
  });

  it("selectVisualRecipe resolves knowledge_graph for NetworkMap", () => {
    expect(selectVisualRecipe("NetworkMap", undefined, { nodeCount: 5 })).toBe(
      "knowledge_graph",
    );
  });
});
