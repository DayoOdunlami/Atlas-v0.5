/**
 * Atlas 5 — Art Director Block Vocabulary
 *
 * Single source of truth for:
 *   1. What block types the art director can request (status: "ready")
 *   2. What React component renders each type (via BlockRenderer)
 *   3. What data schema each type requires
 *   4. Decision rules for when to use each type
 *
 * Usage:
 *   - Lab page reads BLOCK_VOCABULARY to build the vocabulary grid
 *   - BlockRenderer maps block.type → component
 *   - Python build_visual_blocks() uses the same type strings
 *   - skills/data-visualization.md is generated from / kept in sync with
 *     the "ready" entries here
 *
 * Promotion workflow:
 *   When promoting experimental → ready, also add the entry to
 *   skills/data-visualization.md > Block Selection section.
 */

import type { ClaimState } from "./types";

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

export type BlockStatus = "ready" | "experimental" | "deprecated";

export interface VisualBlock {
  /** Must match a BLOCK_VOCABULARY entry type */
  type: string;
  /** Insight-first title — the conclusion, not the chart type */
  title?: string;
  /** Block-specific payload — typed per block type below */
  data: unknown;
  /** Number of corpus sources this block derives from */
  source_count?: number;
}

export interface BlockVocabularyEntry {
  type: string;
  label: string;
  status: BlockStatus;
  /** One sentence: when to reach for this block */
  when_to_use: string;
  /** Required top-level fields in data */
  required_fields: string[];
  /** Minimum number of data items before block earns its place */
  min_data_points: number;
  /** Recharts | ECharts | Custom table | Custom chart */
  library: string;
  /** Recipe intents that commonly trigger this block */
  intent_triggers: string[];
  /** Other block types with overlapping use cases */
  conflicts_with?: string[];
  /** Live example data for the lab page preview */
  example_data: unknown;
}

// ---------------------------------------------------------------------------
// Block data contracts (typed per block type)
// ---------------------------------------------------------------------------

export interface DomainHeatmapData {
  domains: Array<{ domain: string; project_count: number; avg_score: number }>;
}

export interface OptionsComparisonData {
  options: Array<{
    option: string;
    fit_score: number;
    rationale: string;
    action: string;
    confidence?: string;
  }>;
}

export interface EvidenceBarData {
  items: Array<{ label: string; value: number; claim_state?: ClaimState }>;
}

export interface RadarData {
  dimensions: Array<{ dimension: string; score: number }>;
  insight?: string;
}

export interface NpvWaterfallData {
  components: Array<{
    label: string;
    value: number;
    type: "positive" | "negative" | "total";
  }>;
  discount_rate: number;
}

export interface KnowledgeGraphData {
  nodes: Array<{
    id: string;
    label: string;
    /** maps to ECharts GraphNodeCategory: theme | project | funder | document | concept */
    group: "theme" | "project" | "funder" | "document" | "concept";
    value?: number;
  }>;
  edges: Array<{ source: string; target: string; weight?: number; label?: string }>;
}

export interface SankeyData {
  flows: Array<{ source: string; target: string; value: number }>;
}

export interface GapMatrixData {
  rows: Array<{
    criterion: string;
    response: string;
    claim_state: ClaimState;
    fit: "Met" | "Partial" | "Gap" | "Unknown";
    evidence_strength: "Strong" | "Moderate" | "Weak" | "None";
    action?: string;
  }>;
}

export interface ScatterData {
  points: Array<{ label: string; x: number; y: number }>;
  x_label?: string;
  y_label?: string;
}

export interface BarData {
  items: Array<{ label: string; value: number }>;
  x_label?: string;
  y_label?: string;
}

export interface AreaLineData {
  points: Array<Record<string, string | number>>;
  x: string;
  y: string;
  type?: "area" | "line";
}

export interface StakeholderMapData {
  nodes: Array<{
    id: string;
    label: string;
    role?: string;
    influence?: "high" | "medium" | "low";
  }>;
  edges: Array<{ source: string; target: string; relationship?: string }>;
}

export interface EvidenceAwareSwotData {
  strengths: Array<{ text: string; claim_state: ClaimState }>;
  weaknesses: Array<{ text: string; claim_state: ClaimState }>;
  opportunities: Array<{ text: string; claim_state: ClaimState }>;
  threats: Array<{ text: string; claim_state: ClaimState }>;
}

// ---------------------------------------------------------------------------
// Vocabulary registry
// ---------------------------------------------------------------------------

export const BLOCK_VOCABULARY: BlockVocabularyEntry[] = [

  // ── READY ────────────────────────────────────────────────────────────────

  {
    type: "domain_heatmap",
    label: "Domain Heatmap",
    status: "ready",
    when_to_use: "≥3 domains with project counts and/or evidence counts — shows evidence density across the innovation landscape at a glance.",
    required_fields: ["domains"],
    min_data_points: 3,
    library: "ECharts",
    intent_triggers: ["orient"],
    conflicts_with: ["knowledge_graph"],
    example_data: {
      domains: [
        { domain: "Urban Mobility", project_count: 8, avg_score: 0.72 },
        { domain: "Freight Automation", project_count: 5, avg_score: 0.61 },
        { domain: "EV Infrastructure", project_count: 3, avg_score: 0.58 },
        { domain: "Rail Innovation", project_count: 2, avg_score: 0.44 },
        { domain: "MaaS Platforms", project_count: 1, avg_score: 0.38 },
      ],
    } satisfies DomainHeatmapData,
  },

  {
    type: "knowledge_graph",
    label: "Knowledge Graph",
    status: "ready",
    when_to_use: "≥4 entities with meaningful relationship clusters (co-funder, shared theme, geography) where the cluster structure is the finding.",
    required_fields: ["nodes", "edges"],
    min_data_points: 4,
    library: "ECharts",
    intent_triggers: ["orient"],
    conflicts_with: ["domain_heatmap"],
    example_data: {
      nodes: [
        { id: "1", label: "MOVE-UK", group: "funder", value: 8 },
        { id: "2", label: "Autonomous Freight Pilot", group: "project", value: 6 },
        { id: "3", label: "CAV Standards UK", group: "project", value: 5 },
        { id: "4", label: "Urban Mobility", group: "theme", value: 10 },
        { id: "5", label: "Connected Places", group: "theme", value: 9 },
        { id: "6", label: "DfT CCAV", group: "funder", value: 7 },
        { id: "7", label: "Freight Corridor Trial", group: "project", value: 4 },
      ],
      edges: [
        { source: "1", target: "2", weight: 0.8 },
        { source: "1", target: "3", weight: 0.7 },
        { source: "6", target: "7", weight: 0.9 },
        { source: "4", target: "2", weight: 0.6 },
        { source: "4", target: "7", weight: 0.5 },
        { source: "5", target: "3", weight: 0.7 },
      ],
    } satisfies KnowledgeGraphData,
  },

  {
    type: "options_comparison",
    label: "Options Comparison",
    status: "ready",
    when_to_use: "2–5 distinct strategic pathways or alternatives with comparable attributes (fit score, rationale, effort).",
    required_fields: ["options"],
    min_data_points: 2,
    library: "Custom table",
    intent_triggers: ["orient", "connect"],
    conflicts_with: [],
    example_data: {
      options: [
        {
          option: "Lead urban mobility standardisation",
          fit_score: 82,
          rationale: "Strong corpus evidence across 8 projects, clear CPC positioning",
          action: "bid",
          confidence: "Supported",
        },
        {
          option: "Partner on freight automation R&D",
          fit_score: 64,
          rationale: "Moderate evidence; partner dependency on Innovate UK cohort",
          action: "partner",
          confidence: "Indicative",
        },
        {
          option: "Monitor MaaS platform developments",
          fit_score: 38,
          rationale: "Thin evidence base; whitespace domain — watch and enrich",
          action: "monitor",
          confidence: "Speculative",
        },
      ],
    } satisfies OptionsComparisonData,
  },

  {
    type: "evidence_bar",
    label: "Evidence Bar",
    status: "ready",
    when_to_use: "Ranking ≥3 items by relevance score, evidence strength, or fit band — always sorted descending.",
    required_fields: ["items"],
    min_data_points: 3,
    library: "Recharts",
    intent_triggers: ["orient", "connect", "defend"],
    conflicts_with: [],
    example_data: {
      items: [
        { label: "MOVE-UK: Automated Driving at Scale", value: 78, claim_state: "stated" },
        { label: "Enabling a Novel Evaluation Continuum", value: 71, claim_state: "stated" },
        { label: "CAV Testbed: Urban Infrastructure", value: 65, claim_state: "inferred" },
        { label: "Freight Automation Corridor Pilot", value: 58, claim_state: "inferred" },
        { label: "MaaS Integration Framework", value: 42, claim_state: "unknown" },
      ],
    } satisfies EvidenceBarData,
  },

  {
    type: "radar",
    label: "Five Case Radar",
    status: "ready",
    when_to_use: "Five Case Model only — exactly 5 balanced dimensions (Strategic, Economic, Commercial, Financial, Management) on the same 0–100 scale.",
    required_fields: ["dimensions"],
    min_data_points: 5,
    library: "ECharts",
    intent_triggers: ["brief_five_case", "act"],
    conflicts_with: [],
    example_data: {
      dimensions: [
        { dimension: "Strategic Case", score: 78 },
        { dimension: "Economic Case", score: 62 },
        { dimension: "Commercial Case", score: 45 },
        { dimension: "Financial Case", score: 55 },
        { dimension: "Management Case", score: 70 },
      ],
      insight: "Commercial case is weakest at 45% — address market readiness evidence before submission.",
    } satisfies RadarData,
  },

  {
    type: "npv_waterfall",
    label: "NPV Waterfall",
    status: "ready",
    when_to_use: "NPV decomposition — showing how benefit and cost components sum to a net present value. Requires ≥2 components before the total.",
    required_fields: ["components", "discount_rate"],
    min_data_points: 2,
    library: "Custom Recharts",
    intent_triggers: ["brief_five_case", "act"],
    conflicts_with: [],
    example_data: {
      components: [
        { label: "Congestion savings", value: 18.4, type: "positive" },
        { label: "Safety benefits", value: 7.2, type: "positive" },
        { label: "Emissions reduction", value: 4.8, type: "positive" },
        { label: "Capital investment", value: -12.6, type: "negative" },
        { label: "Operating costs", value: -5.1, type: "negative" },
        { label: "Net Present Value", value: 12.7, type: "total" },
      ],
      discount_rate: 0.035,
    } satisfies NpvWaterfallData,
  },

  {
    type: "gap_matrix",
    label: "Gap Matrix",
    status: "ready",
    when_to_use: "Diagnose intent — evidence gaps with criterion, response, fit status, and evidence strength. Always a table, never prose rows.",
    required_fields: ["rows"],
    min_data_points: 1,
    library: "Custom table",
    intent_triggers: ["diagnose", "cpc_evidence_gaps"],
    conflicts_with: [],
    example_data: {
      rows: [
        {
          criterion: "Rail energy pilot precedent",
          response: "No corpus evidence found",
          claim_state: "unknown",
          fit: "Gap",
          evidence_strength: "None",
          action: "Commission targeted literature review",
        },
        {
          criterion: "Urban freight demand modelling",
          response: "2 adjacent projects found, not direct",
          claim_state: "inferred",
          fit: "Partial",
          evidence_strength: "Weak",
          action: "Enrichment — request UKRI dataset",
        },
        {
          criterion: "CPC CAV expertise",
          response: "8 verified projects across 3 business units",
          claim_state: "stated",
          fit: "Met",
          evidence_strength: "Strong",
        },
      ],
    } satisfies GapMatrixData,
  },

  {
    type: "sankey",
    label: "Sankey / Funding Flow",
    status: "ready",
    when_to_use: "Source → target → value triples representing funding flows, sector adjacencies, or resource movement. Requires ≥3 distinct sources/targets and ≥6 total flows.",
    required_fields: ["flows"],
    min_data_points: 6,
    library: "ECharts",
    intent_triggers: ["connect", "cpc_funding_flow"],
    conflicts_with: [],
    example_data: {
      flows: [
        { source: "Innovate UK", target: "Urban Mobility", value: 18 },
        { source: "Innovate UK", target: "Freight", value: 12 },
        { source: "UKRI", target: "Urban Mobility", value: 14 },
        { source: "UKRI", target: "EV Infrastructure", value: 9 },
        { source: "DfT CCAV", target: "Freight", value: 8 },
        { source: "DfT CCAV", target: "Urban Mobility", value: 6 },
        { source: "Horizon Europe", target: "EV Infrastructure", value: 7 },
      ],
    } satisfies SankeyData,
  },

  {
    type: "scatter",
    label: "Scatter Plot",
    status: "ready",
    when_to_use: "Two quantitative variables where correlation or cluster pattern is the finding. Atlas use: gap severity (x) × effort to close (y). Requires ≥15 data points.",
    required_fields: ["points"],
    min_data_points: 5,
    library: "ECharts",
    intent_triggers: ["diagnose"],
    conflicts_with: [],
    example_data: {
      points: Array.from({ length: 12 }, (_, i) => ({
        label: `Gap ${i + 1}`,
        x: Math.round((Math.sin(i * 0.9) * 3 + 5) * 10) / 10,
        y: Math.round((Math.cos(i * 0.7) * 3 + 5) * 10) / 10,
      })),
      x_label: "Severity",
      y_label: "Effort to close",
    } satisfies ScatterData,
  },

  {
    type: "bar",
    label: "Bar Chart",
    status: "ready",
    when_to_use: "Default for categorical comparison when no specialist block applies. Always starts at zero. Maximum 12 bars.",
    required_fields: ["items"],
    min_data_points: 3,
    library: "Recharts",
    intent_triggers: ["orient", "connect", "diagnose", "defend"],
    conflicts_with: [],
    example_data: {
      items: [
        { label: "Policy", value: 34 },
        { label: "Research", value: 28 },
        { label: "Guidance", value: 19 },
        { label: "Case study", value: 13 },
        { label: "Other", value: 5 },
      ],
    } satisfies BarData,
  },

  {
    type: "area_line",
    label: "Area / Line (Time Series)",
    status: "ready",
    when_to_use: "Genuine time dimension (year, quarter, month) where trend direction is the finding. Use area for volume, line for rate.",
    required_fields: ["points", "x", "y"],
    min_data_points: 4,
    library: "Recharts",
    intent_triggers: ["orient"],
    conflicts_with: [],
    example_data: {
      points: [
        { year: "2019", count: 23 }, { year: "2020", count: 15 },
        { year: "2021", count: 29 }, { year: "2022", count: 34 },
        { year: "2023", count: 41 }, { year: "2024", count: 22 },
      ],
      x: "year",
      y: "count",
      type: "area",
    } satisfies AreaLineData,
  },

  {
    type: "stakeholder_map",
    label: "Stakeholder Map",
    status: "ready",
    when_to_use:
      "Programme or policy question where power, influence, and relationships between actors are the finding — ≥3 stakeholders with explicit links.",
    required_fields: ["nodes", "edges"],
    min_data_points: 3,
    library: "Custom",
    intent_triggers: ["organisation_profile"],
    conflicts_with: ["knowledge_graph"],
    example_data: {
      nodes: [
        { id: "cpc", label: "Connected Places Catapult", role: "Delivery partner", influence: "high" },
        { id: "dft", label: "DfT CCAV", role: "Regulator / funder", influence: "high" },
        { id: "oem", label: "OEM consortium", role: "Technology provider", influence: "medium" },
        { id: "lga", label: "Local highways authority", role: "Infrastructure", influence: "medium" },
        { id: "union", label: "Freight unions", role: "Workforce", influence: "low" },
      ],
      edges: [
        { source: "dft", target: "cpc", relationship: "funds" },
        { source: "cpc", target: "oem", relationship: "commissions" },
        { source: "cpc", target: "lga", relationship: "coordinates" },
        { source: "union", target: "oem", relationship: "challenges" },
      ],
    } satisfies StakeholderMapData,
  },

  {
    type: "evidence_aware_swot",
    label: "Evidence-Aware SWOT",
    status: "ready",
    when_to_use:
      "Strategic position for an entity or programme where each quadrant item must carry epistemic state (stated / inferred / unknown / contested).",
    required_fields: ["strengths", "weaknesses", "opportunities", "threats"],
    min_data_points: 4,
    library: "Custom",
    intent_triggers: ["organisation_profile", "orient"],
    conflicts_with: [],
    example_data: {
      strengths: [
        { text: "National freight innovation convening power", claim_state: "stated" },
        { text: "Cross-modal evidence corpus density", claim_state: "inferred" },
      ],
      weaknesses: [
        { text: "Limited open-road HGV trial precedent in corpus", claim_state: "stated" },
      ],
      opportunities: [
        { text: "A14 corridor regulatory sandbox window", claim_state: "inferred" },
      ],
      threats: [
        { text: "Union resistance to automation narrative", claim_state: "contested" },
      ],
    } satisfies EvidenceAwareSwotData,
  },

  // ── EXPERIMENTAL ─────────────────────────────────────────────────────────

  {
    type: "gauge",
    label: "Confidence Gauge",
    status: "experimental",
    when_to_use: "Single summary score (0–100) where the value relative to a threshold is the point. Consider using a confidence badge instead.",
    required_fields: ["value", "label"],
    min_data_points: 1,
    library: "ECharts",
    intent_triggers: [],
    conflicts_with: [],
    example_data: { value: 68, label: "Evidence strength" },
  },

  {
    type: "stacked_bar",
    label: "Stacked Bar",
    status: "experimental",
    when_to_use: "Total AND composition matter simultaneously — needs a series field. Use when both 'how much' and 'what mix' are the point.",
    required_fields: ["items", "series"],
    min_data_points: 3,
    library: "Recharts",
    intent_triggers: [],
    conflicts_with: [],
    example_data: {
      items: [
        { funder: "Innovate UK", open: 18, closed: 24 },
        { funder: "UKRI", open: 12, closed: 19 },
        { funder: "OZEV", open: 8, closed: 10 },
      ],
      series: ["open", "closed"],
    },
  },

  {
    type: "radial_bar",
    label: "Radial Bar",
    status: "experimental",
    when_to_use: "Ranked categories as arcs — more visually engaging than a bar chart for presentations. Same data as evidence_bar but circular.",
    required_fields: ["items"],
    min_data_points: 3,
    library: "Recharts",
    intent_triggers: [],
    conflicts_with: ["evidence_bar"],
    example_data: {
      items: [
        { label: "EV charging", value: 47 },
        { label: "Active travel", value: 39 },
        { label: "Freight", value: 31 },
        { label: "Autonomous", value: 24 },
        { label: "MaaS", value: 19 },
      ],
    },
  },

  {
    type: "venn",
    label: "Venn / Overlap",
    status: "experimental",
    when_to_use: "Overlap between 2–3 named sets where the intersection size is meaningful.",
    required_fields: ["sets"],
    min_data_points: 3,
    library: "AntV G2",
    intent_triggers: [],
    conflicts_with: [],
    example_data: {
      sets: [
        { sets: ["EV Charging"], size: 47 },
        { sets: ["Active Travel"], size: 39 },
        { sets: ["EV Charging", "Active Travel"], size: 9 },
      ],
    },
  },

];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getBlock(type: string): BlockVocabularyEntry | undefined {
  return BLOCK_VOCABULARY.find((b) => b.type === type);
}

export function getReadyBlocks(): BlockVocabularyEntry[] {
  return BLOCK_VOCABULARY.filter((b) => b.status === "ready");
}

export function getBlocksByIntent(intent: string): BlockVocabularyEntry[] {
  return BLOCK_VOCABULARY.filter(
    (b) => b.status === "ready" && b.intent_triggers.includes(intent),
  );
}
