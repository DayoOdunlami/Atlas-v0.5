/**
 * Seam 1 — Bridge AtlasRenderModel blocks → atlas5 Art Director visuals.
 *
 * The lab vocabulary (ECharts/Recharts) lives in @/components/atlas5/block-renderer.
 * Workbench analytical blocks carry semantic content; this adapter picks the
 * dominant chart/table visual from block type + data shape + resolved visual id.
 */

import type { VisualBlock } from "@/lib/atlas5/block-vocabulary";
import type {
  RenderBlock,
  DimensionGapBlock,
  EvidenceStateSummaryBlock,
  ComparisonMatrixBlock,
  EconomicCaseBlock,
  OpportunityListBlock,
  NetworkMapBlock,
  TransferLanesBlock,
  MatchListItem,
  OpportunityListItem,
  EvidenceState,
} from "./atlas-render-model";
import type { VisualId } from "./visual-registry";
import type { BlockDataShape } from "./visual-registry";
import type { ClaimState } from "@/lib/atlas5/types";

export type { BlockDataShape };

export function inferDataShape(block: RenderBlock): BlockDataShape {
  switch (block.type) {
    case "ComparisonMatrix": {
      const content = block.content as unknown;
      if (Array.isArray(content)) {
        return { rowCount: content.length };
      }
      if (
        typeof content === "object" &&
        content !== null &&
        "quadrants" in content &&
        Array.isArray((content as { quadrants: unknown[] }).quadrants)
      ) {
        return { quadrantCount: (content as { quadrants: unknown[] }).quadrants.length };
      }
      return {};
    }
    case "OpportunityList":
      return { rowCount: block.content.length };
    case "DimensionGap":
      return { gapCount: block.content.length };
    case "EvidenceStateSummary":
      return { evidenceStateTotal: block.content.total_claims };
    case "NetworkMap":
      return { nodeCount: block.content.nodes.length };
    case "TransferLanes":
      return { rowCount: block.content.length };
    case "EconomicCase":
      return {
        hasNpvWaterfall: (block.content.npv_waterfall?.length ?? 0) >= 2,
        hasFiveCaseScores: block.content.section_scores.length === 5,
      };
    default:
      return {};
  }
}

function mapEvidenceState(state: EvidenceState): ClaimState {
  if (state === "verified" || state === "self-reported") return "stated";
  if (state === "inferred") return "inferred";
  if (state === "contested") return "contested";
  return "unknown";
}

function isMatchList(content: unknown): content is MatchListItem[] {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    typeof (content[0] as MatchListItem).match_id === "string"
  );
}

function opportunityItemsFromMatchList(rows: MatchListItem[]): OpportunityListItem[] {
  return rows.map((r) => ({
    id: r.match_id,
    title: r.passport,
    organisation: r.target,
    score: r.score,
    funder: r.funder,
    status: r.status,
  }));
}

/** Atlas5 visual types that should render as the dominant surface (not prose/table fallback). */
export function usesDominantAtlasVisual(
  blockType: RenderBlock["type"],
  visual: VisualId,
): boolean {
  if (blockType === "OpportunityList") return true;
  if (blockType === "ComparisonMatrix") {
    return visual === "stored_match_list" || visual === "match_score_bar";
  }
  if (blockType === "DimensionGap") return visual === "gap_matrix";
  if (blockType === "EvidenceStateSummary") {
    return visual === "evidence_coverage_donut";
  }
  if (blockType === "EconomicCase") {
    return visual === "npv_waterfall" || visual === "value_driver_cards";
  }
  if (blockType === "NetworkMap") return true;
  return false;
}

/** Map a workbench block + resolved visual to an atlas5 VisualBlock, or null if N/A. */
export function buildAtlasVisualBlock(
  block: RenderBlock,
  visual: VisualId,
): VisualBlock | null {
  switch (block.type) {
    case "OpportunityList":
      return buildOpportunityVisual(block, visual);
    case "ComparisonMatrix":
      if (visual === "quadrant_grid") return null;
      if (isMatchList(block.content)) {
        return buildCorpusListVisual(block.headline, block.content, visual);
      }
      return null;
    case "DimensionGap":
      if (visual !== "gap_matrix") return null;
      return buildGapMatrixVisual(block);
    case "EvidenceStateSummary":
      if (visual !== "evidence_coverage_donut") return null;
      return buildEvidenceBarVisual(block);
    case "EconomicCase":
      return buildEconomicVisuals(block, visual);
    case "NetworkMap":
      return buildNetworkGraphVisual(block);
    default:
      return null;
  }
}

function buildNetworkGraphVisual(block: NetworkMapBlock): VisualBlock | null {
  const { nodes, edges } = block.content;
  if (!nodes?.length) return null;

  type AtlasGroup = "theme" | "project" | "funder" | "document" | "concept";

  const mapGroup = (group: NetworkMapBlock["content"]["nodes"][0]["group"]): AtlasGroup => {
    if (group === "organisation") return "funder";
    if (group === "theme" || group === "project" || group === "funder" || group === "document" || group === "concept") {
      return group;
    }
    return "project";
  };

  return {
    type: "knowledge_graph",
    title: block.headline,
    data: {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        group: mapGroup(n.group),
        value: n.value ?? 5,
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        label: e.label,
      })),
    },
  };
}

function buildOpportunityVisual(
  block: OpportunityListBlock,
  visual: VisualId,
): VisualBlock | null {
  const items = block.content;
  if (!items.length) return null;

  if (visual === "match_score_bar" || visual === "evidence_bar") {
    return {
      type: "evidence_bar",
      title: block.headline,
      data: {
        items: items
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((row) => ({
            label: row.title.slice(0, 48),
            value: Math.round((row.score ?? 0) * 100),
            claim_state: "stated" as ClaimState,
          })),
      },
    };
  }

  return {
    type: "options_comparison",
    title: block.headline,
    data: {
      options: items.slice(0, 12).map((row) => ({
        option: row.title,
        fit_score: Math.round((row.score ?? 0) * 100),
        rationale: row.organisation ?? row.funder ?? "CPC corpus project",
        action: row.status || "explore",
        confidence: row.score && row.score >= 0.7 ? "Supported" : "Indicative",
      })),
    },
  };
}

function buildCorpusListVisual(
  headline: string,
  rows: MatchListItem[],
  visual: VisualId,
): VisualBlock | null {
  if (!rows.length) return null;

  if (visual === "match_score_bar" || visual === "evidence_bar") {
    return {
      type: "evidence_bar",
      title: headline,
      data: {
        items: rows.map((r) => ({
          label: r.passport.slice(0, 48),
          value: Math.round(r.score * 100),
          claim_state: "stated" as ClaimState,
        })),
      },
    };
  }

  return {
    type: "options_comparison",
    title: headline,
    data: {
      options: rows.slice(0, 12).map((r) => ({
        option: r.passport,
        fit_score: Math.round(r.score * 100),
        rationale: r.target,
        action: r.funder || "corpus",
        confidence: r.score >= 0.7 ? "Supported" : "Indicative",
      })),
    },
  };
}

function buildGapMatrixVisual(block: DimensionGapBlock): VisualBlock | null {
  const gaps = block.content;
  if (!gaps.length) return null;

  return {
    type: "gap_matrix",
    title: block.headline,
    data: {
      rows: gaps.map((g) => ({
        criterion: g.title,
        response: g.description,
        claim_state: mapEvidenceState(g.evidence_state),
        fit:
          g.magnitude === "large" || g.severity === "critical"
            ? "Gap"
            : g.magnitude === "medium"
              ? "Partial"
              : g.magnitude === "small"
                ? "Met"
                : "Unknown",
        evidence_strength:
          g.evidence_state === "verified"
            ? "Strong"
            : g.evidence_state === "self-reported"
              ? "Moderate"
              : g.evidence_state === "unknown"
                ? "None"
                : "Weak",
        action: g.what_would_change,
      })),
    },
  };
}

function buildEvidenceBarVisual(block: EvidenceStateSummaryBlock): VisualBlock | null {
  const c = block.content;
  const states: EvidenceState[] = [
    "verified",
    "self-reported",
    "inferred",
    "unknown",
    "contested",
  ];
  const items = states
    .map((s) => ({ label: s, value: c.counts[s] ?? 0, claim_state: mapEvidenceState(s) }))
    .filter((i) => i.value > 0);

  if (items.length < 2) return null;

  return {
    type: "evidence_bar",
    title: block.headline,
    data: { items },
  };
}

function buildEconomicVisuals(
  block: EconomicCaseBlock,
  visual: VisualId,
): VisualBlock | null {
  const c = block.content;

  if (visual === "npv_waterfall" && c.npv_waterfall && c.npv_waterfall.length >= 2) {
    return {
      type: "npv_waterfall",
      title: `${block.headline} — NPV decomposition`,
      data: {
        discount_rate: c.discount_rate,
        components: c.npv_waterfall.map((item) => ({
          label: item.label,
          value: item.value,
          type:
            item.type === "benefit"
              ? "positive"
              : item.type === "cost"
                ? "negative"
                : "total",
        })),
      },
    };
  }

  if (visual === "value_driver_cards" && c.section_scores.length === 5) {
    return {
      type: "radar",
      title: `${block.headline} — Five Case profile`,
      data: {
        dimensions: c.section_scores.map((s) => ({
          dimension: s.label,
          score: Math.round(s.score * 100),
        })),
        insight: c.verdict_summary,
      },
    };
  }

  return null;
}

/** Normalize legacy ComparisonMatrix corpus tables → OpportunityList. */
export function migrateCorpusMatrixToOpportunityList(
  raw: Record<string, unknown>,
): OpportunityListBlock | null {
  if (raw.type !== "ComparisonMatrix") return null;
  if (raw.visual !== "stored_match_list" && raw.visual !== "match_score_bar") return null;
  const content = raw.content;
  if (!isMatchList(content)) return null;

  const id = String(raw.id ?? raw.block_id ?? `block.opp.${Date.now()}`);
  return {
    id,
    type: "OpportunityList",
    state: (raw.state as OpportunityListBlock["state"]) ?? "core",
    headline: String(raw.headline ?? raw.title ?? "Corpus results"),
    visual: "evidence_bar",
    role: raw.role as OpportunityListBlock["role"],
    content: opportunityItemsFromMatchList(content),
  };
}
