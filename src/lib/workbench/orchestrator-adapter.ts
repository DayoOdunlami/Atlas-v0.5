/**
 * orchestrator-adapter.ts
 *
 * Maps the Python orchestrator render_model dict → frontend AtlasRenderModel.
 * The orchestrator emits render_blocks (full payloads) after the format pass;
 * this adapter merges them into the workbench canvas contract.
 */
import type {
  AtlasRenderModel,
  CanonicalQuestionId,
  ConfidenceTier,
  RenderBlock,
} from "./atlas-render-model";
import renderModels from "@/data/atlas-v10-render-models.json";
import type { RenderModelMap } from "./atlas-render-model";

const MODELS = renderModels as RenderModelMap;

const VALID_TIERS: ConfidenceTier[] = [
  "Speculative",
  "Indicative",
  "Supported",
  "Robust",
];

function asTier(value: unknown): ConfidenceTier {
  if (typeof value === "string" && VALID_TIERS.includes(value as ConfidenceTier)) {
    return value as ConfidenceTier;
  }
  return "Speculative";
}

function asCqId(value: unknown): CanonicalQuestionId {
  const id = typeof value === "string" ? value : "cq.match.workbench";
  const valid: CanonicalQuestionId[] = [
    "cq.home",
    "cq.match.browse",
    "cq.match.workbench",
    "cq.match.act",
    "cq.match.defend",
  ];
  return valid.includes(id as CanonicalQuestionId)
    ? (id as CanonicalQuestionId)
    : "cq.match.workbench";
}

/**
 * Convert an orchestrator render_model (post format-pass) into an AtlasRenderModel
 * the BlockRenderer can consume.
 */
export function orchestratorToAtlasRenderModel(
  raw: Record<string, unknown>,
  baseCq: CanonicalQuestionId = "cq.match.workbench",
): AtlasRenderModel {
  const base = structuredClone(MODELS[baseCq]);
  const renderBlocks = (raw.render_blocks as RenderBlock[] | undefined) ?? [];
  const tier = asTier(raw.confidence_tier);
  const headline = typeof raw.headline === "string" ? raw.headline : base.decision_spine.recommendation;
  const insight =
    typeof raw.insight_card === "string" ? raw.insight_card : base.decision_spine.summary;
  const sections = (raw.sections as Record<string, string> | undefined) ?? {};
  const entity = sections.entity ?? base.source_object.title;
  const opportunity = sections.opportunity ?? base.target_object.title;
  const summary = raw.translation_summary as
    | { readiness_rate?: number; essential_ready?: number; total_essential?: number }
    | undefined;

  const score =
    typeof summary?.readiness_rate === "number"
      ? summary.readiness_rate
      : base.decision_spine.score;

  return {
    ...base,
    artifact_id: `artifact.orchestrator.${Date.now()}`,
    model_version: "orchestrator-v1",
    generated_at: new Date().toISOString(),
    canonical_question_id: asCqId(raw.canonical_question_id ?? baseCq),
    layout_template: "Orchestrator — Value Translation",
    mode: String(raw.outcome ?? "diagnose"),
    source_object: {
      type: "passport",
      id: base.source_object.id,
      title: entity.split("(")[0]?.trim() || entity,
      summary: insight.slice(0, 280),
    },
    target_object: {
      ...base.target_object,
      title: opportunity,
      funder: sections.funder ?? base.target_object.funder,
    },
    decision_spine: {
      recommendation: headline,
      decision: opportunity,
      summary: insight,
      confidence_tier: tier,
      confidence_cap_reason:
        summary?.total_essential != null
          ? `${summary.essential_ready ?? 0}/${summary.total_essential} essential criteria travel as-is`
          : base.decision_spine.confidence_cap_reason,
      score,
    },
    blocks: renderBlocks.length > 0 ? renderBlocks : base.blocks,
    snapshot: {
      ...base.snapshot,
      title: headline,
      included_blocks: renderBlocks.map((b) => b.id),
    },
    data_quality_notes: [
      ...(base.data_quality_notes ?? []),
      `Orchestrator outcome: ${String(raw.outcome ?? "unknown")}`,
      `Render mode: ${String(raw.render_mode ?? "blocks")}`,
      ...(Array.isArray(raw.external_evidence) && raw.external_evidence.length > 0
        ? [`External evidence: ${raw.external_evidence.length} candidate source(s)`]
        : []),
    ],
  };
}
