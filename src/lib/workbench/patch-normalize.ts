/**
 * Patch normalization — bridge agent-emitted blocks to AtlasRenderModel contract.
 *
 * The LLM often emits block_id/title and SWOT-shaped ComparisonMatrix content
 * that does not match the strict RenderBlock schema. We normalize at apply-time
 * so the artifact canvas can render without a round-trip.
 */

import type { ModelPatchOp, ModelPatchProposal } from "./workbench-agent-contract";
import type { RenderBlock } from "./atlas-render-model";
import { isCanonicalBlockType } from "./block-registry";
import {
  migrateCorpusMatrixToOpportunityList,
} from "./visual-adapter";

export interface SwotQuadrantContent {
  quadrants: Array<{ label: string; body: string }>;
}

function isSwotShaped(raw: Record<string, unknown>): boolean {
  if (Array.isArray(raw.rows)) return true;
  if (Array.isArray(raw.quadrants)) return true;
  if (raw.strengths || raw.weaknesses || raw.opportunities || raw.threats) return true;
  return false;
}

function extractQuadrants(raw: Record<string, unknown>): SwotQuadrantContent {
  if (Array.isArray(raw.quadrants)) {
    return {
      quadrants: (raw.quadrants as Array<{ label?: string; body?: string; title?: string; text?: string }>).map(
        (q) => ({
          label: q.label ?? q.title ?? "Quadrant",
          body: q.body ?? q.text ?? "",
        }),
      ),
    };
  }

  if (Array.isArray(raw.rows)) {
    const quadrants: Array<{ label: string; body: string }> = [];
    for (const row of raw.rows as Array<{ label?: string; columns?: Record<string, string> }>) {
      const cols = row.columns ?? {};
      for (const [col, text] of Object.entries(cols)) {
        quadrants.push({
          label: `${row.label ?? ""} — ${col}`.trim(),
          body: String(text),
        });
      }
    }
    if (quadrants.length > 0) return { quadrants };
  }

  const map: Array<[string, unknown]> = [
    ["Strengths", raw.strengths],
    ["Weaknesses", raw.weaknesses],
    ["Opportunities", raw.opportunities],
    ["Threats", raw.threats],
  ];
  const quadrants = map
    .filter(([, v]) => v != null)
    .map(([label, v]) => ({
      label,
      body: Array.isArray(v) ? (v as string[]).map((s) => `• ${s}`).join("\n") : String(v),
    }));

  return { quadrants };
}

function normalizeContextCardContent(raw: Record<string, unknown>): Record<string, unknown> {
  // If content already exists (paired or single-subject), pass through.
  if (raw.content && typeof raw.content === "object") return raw.content as Record<string, unknown>;

  // Agent often emits {source, target} OR {subject, body} at top-level. Lift them.
  const hasPaired = "source" in raw || "target" in raw;
  if (hasPaired) {
    return {
      ...(raw.source ? { source: raw.source } : {}),
      ...(raw.target ? { target: raw.target } : {}),
    };
  }

  const singleKeys = ["subject", "body", "text", "summary", "description"];
  const singleContent: Record<string, unknown> = {};
  for (const k of singleKeys) {
    if (k in raw && raw[k] != null) singleContent[k] = raw[k];
  }
  return Object.keys(singleContent).length > 0 ? singleContent : {};
}

/** Normalize a single agent-emitted block into a renderable RenderBlock. */
export function normalizeAgentBlock(raw: Record<string, unknown>): RenderBlock {
  const type = String(raw.type ?? "ContextCard");

  const migrated = migrateCorpusMatrixToOpportunityList(raw);
  if (migrated) return migrated;

  if (!isCanonicalBlockType(type)) {
    // Fall back to ContextCard shell rather than crashing render tree
    return {
      id: String(raw.id ?? raw.block_id ?? `block.agent.${Date.now()}`),
      type: "ContextCard",
      state: (raw.state as RenderBlock["state"]) ?? "core",
      headline: String(raw.headline ?? raw.title ?? "Agent block"),
      visual: "paired_context_cards",
      content: { body: JSON.stringify(raw).slice(0, 500) },
    } as unknown as RenderBlock;
  }

  const id = String(raw.id ?? raw.block_id ?? `block.agent.${Date.now()}`);
  const headline = String(raw.headline ?? raw.title ?? "Agent block");
  const state = (raw.state as RenderBlock["state"]) ?? "core";

  // SWOT / quadrant layout recipe → ComparisonMatrix with quadrant_grid visual
  if (type === "ComparisonMatrix" && isSwotShaped(raw)) {
    return {
      id,
      type: "ComparisonMatrix",
      state,
      headline,
      visual: "quadrant_grid",
      content: extractQuadrants(raw),
    } as unknown as RenderBlock;
  }

  // ContextCard — accept paired, single-subject, or free body shapes
  if (type === "ContextCard") {
    return {
      id,
      type: "ContextCard",
      state,
      headline,
      visual: (raw.visual as string) ?? "paired_context_cards",
      content: normalizeContextCardContent(raw),
    } as unknown as RenderBlock;
  }

  const visualDefaults: Record<string, string> = {
    RecommendationConfidence: "decision_card",
    EvidenceStateSummary: "evidence_state_bar",
    DimensionGap: "source_target_gap_rows",
    MatchBench: "evidence_map_table",
    ClaimLedger: "claim_audit_ledger",
    ActionPlan: "gap_to_action_timeline",
    ObjectionResponse: "objection_response_table",
    ProvenanceTrace: "evidence_trail",
    ComparisonMatrix: "stored_match_list",
    OpportunityList: "evidence_bar",
    ContextCard: "paired_context_cards",
    EconomicCase: "value_driver_cards",
    NetworkMap: "knowledge_graph",
    TransferLanes: "four_lane_board",
  };

  if (type === "OpportunityList") {
    const rows = Array.isArray(raw.content) ? raw.content : [];
    return {
      id,
      type: "OpportunityList",
      state,
      headline,
      visual: (raw.visual as string) ?? "evidence_bar",
      content: rows,
    } as RenderBlock;
  }

  if (type === "NetworkMap") {
    const content = (raw.content as { nodes?: unknown[]; edges?: unknown[] }) ?? {};
    return {
      id,
      type: "NetworkMap",
      state,
      headline,
      visual: (raw.visual as string) ?? "knowledge_graph",
      content: {
        nodes: Array.isArray(content.nodes) ? content.nodes : [],
        edges: Array.isArray(content.edges) ? content.edges : [],
      },
    } as RenderBlock;
  }

  if (type === "TransferLanes") {
    const rows = Array.isArray(raw.content) ? raw.content : [];
    return {
      id,
      type: "TransferLanes",
      state,
      headline,
      visual: (raw.visual as string) ?? "four_lane_board",
      content: rows,
    } as RenderBlock;
  }

  return {
    ...raw,
    id,
    headline,
    state,
    content: raw.content ?? {},
    visual: raw.visual ?? visualDefaults[type] ?? "paired_context_cards",
    type,
  } as RenderBlock;
}

/** Normalize all ops in a patch proposal before applying. */
export function normalizePatchProposal(patch: ModelPatchProposal): ModelPatchProposal {
  return {
    ...patch,
    ops: patch.ops.map((op) => {
      if (op.op !== "add_block") return op;
      return {
        ...op,
        block: normalizeAgentBlock(op.block as unknown as Record<string, unknown>),
      };
    }) as ModelPatchOp[],
  };
}

/** True when message text is (or is becoming) a model_patch payload — hide from chat. */
export function looksLikePatchPayload(text: string): boolean {
  if (!text) return false;
  return (
    /"model_patch"/.test(text) ||
    /```json/.test(text) ||
    (/"ops"\s*:\s*\[/.test(text) && /"op"\s*:\s*"add_block"/.test(text))
  );
}

function removeBalancedJsonBlock(text: string, key: string): string {
  const idx = text.indexOf(`"${key}"`);
  if (idx < 0) return text;
  const start = text.lastIndexOf("{", idx);
  if (start < 0) return text;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return (text.slice(0, start) + text.slice(i + 1)).trim();
      }
    }
  }
  return text;
}

function removeFencedJsonBlocks(text: string): string {
  let out = text;
  let changed = true;
  while (changed) {
    changed = false;
    const match = out.match(/```(?:json)?\s*(\{[\s\S]*)/);
    if (!match || match.index === undefined) break;
    const fenceStart = match.index;
    const jsonStart = fenceStart + match[0].indexOf("{");
    let depth = 0;
    let end = -1;
    for (let i = jsonStart; i < out.length; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end > 0) {
      const closeFence = out.indexOf("```", end);
      const sliceEnd = closeFence >= 0 ? closeFence + 3 : end;
      out = (out.slice(0, fenceStart) + out.slice(sliceEnd)).trim();
      changed = true;
    } else {
      break;
    }
  }
  return out;
}

/** Strip model_patch JSON from chat text (belt-and-suspenders for display). */
export function stripPatchJsonFromChat(text: string): string {
  if (!text) return text;
  let out = text;
  for (let i = 0; i < 5; i++) {
    const prev = out;
    out = removeFencedJsonBlocks(out);
    out = removeBalancedJsonBlock(out, "model_patch");
    if (out === prev) break;
  }
  // Drop orphan "Here is the patch" lines and dedupe paragraphs
  out = out
    .replace(
      /^(?:here\s+is|here['\u2019]s)\s+the\s+(?:proposed\s+)?patch[:.]?\s*$/gim,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const seen = new Set<string>();
  out = out
    .split("\n")
    .filter((line) => {
      const key = line.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n")
    .trim();
  return out;
}
