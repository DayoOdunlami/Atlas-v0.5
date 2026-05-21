export type LineChartSpec = {
  type: "line";
  title: string;
  x: string;
  y: string;
};
export type BarChartSpec = { type: "bar"; title: string; x: string; y: string };
export type PieChartSpec = { type: "pie"; title: string; x: string; y: string };
export type ChartSpec = LineChartSpec | BarChartSpec | PieChartSpec;

// Data records supplied by the agent for charts
export type ChartDataRecord = Record<string, string | number>;
export type ChartDataMap = Record<string, ChartDataRecord[]>; // keyed by chart title

export type Metric = {
  id: string;
  title: string;
  value: string;
  hint?: string;
  icon?: "users" | "mrr" | "conversion" | "churn" | "custom";
};

export type Chart = ChartSpec & {
  data: ChartDataRecord[];
};

// ── Atlas v5 contracts (locked in CLAUDE.md) ────────────────────────────────

export type ConfidenceTier = "Speculative" | "Indicative" | "Supported" | "Robust";

export type SurfaceState = {
  mode: "chat" | "artifact" | "canvas";
  activeAgent: "ATLAS" | "JARVIS" | "CICERONE" | "HYVE";
  lens: "CPC" | "Atlas" | "Ecosystem" | "Funder" | "Mode";
  timestamp: string;
};

export type SourceType =
  | "project"
  | "live_call"
  | "knowledge_doc"
  | "knowledge_chunk"
  | "hive_chunk"
  | "hive_article";

export type CorpusCitation = {
  id: string;
  title: string;
  score: number;
  source_type?: SourceType;
  // project
  organisation?: string;
  // live_call
  funder?: string;
  deadline?: string | null;
  // knowledge types
  chunk_id?: string;
  document_id?: string;
  publisher?: string;
  // hive types
  article_id?: string;
};

export type HiveCitation = {
  article_id: string;
  chunk_id?: string;
  title: string;
  score: number;
};

export type RecipeType =
  | "brief_five_case"
  | "evidence_panel"
  | "stats_dashboard"
  | "scenario_stress_test";

export type ArtifactBlock = {
  type: "brief" | "evidence" | "chart" | "scenario";
  recipe?: RecipeType;
  sections?: Record<string, string>;
  corpus_citations?: CorpusCitation[];
  hive_citations?: HiveCitation[];
  npv_value?: number;
  discount_rate?: number;
  confidence_tier: ConfidenceTier;
  /**
   * Charts that belong to THIS artefact and should travel with it.
   * Distinct from AgentState.charts which holds temporary workspace charts.
   * Used by stats_dashboard and optionally brief_five_case.
   */
  chart_specs?: Chart[];
};

export type DecisionSpine = {
  decision: string;
  recommendation: string;
  confidence_tier: ConfidenceTier;
  key_assumption: string;
  next_action: string;
  framework?: string;
  strongest_objection?: string;
  would_change_if?: string;
};

// ── Shared agent state (useCoAgent sync contract) ────────────────────────────

export type EvidenceCoverage = {
  projects_found: number;
  live_calls_found: number;
  knowledge_docs_found: number;
  hive_chunks_found: number;
  source_diversity: number;
  top_similarity: number;
  average_similarity: number;
  evidence_gaps: string[];
  suggested_confidence_tier: ConfidenceTier;
  coverage_note: "thin" | "adequate" | "strong";
};

export type AgentState = {
  title: string;
  charts: Chart[];
  pinnedMetrics: Metric[];
  surface_state?: SurfaceState;
  artifact_block?: ArtifactBlock;
  decision_spine?: DecisionSpine;
  evidence_coverage?: EvidenceCoverage;
};

export type AgentSetState<T extends AgentState> = (
  newState: T | ((prevState: T | undefined) => T),
) => void;

// ── Visual validation: swap import to test each recipe ───────────────────────
// import { MOCK_BRIEF, MOCK_EVIDENCE, MOCK_STATS, MOCK_SCENARIO } from "./test-states";
// export const initialState: AgentState = { ...defaultInitialState, ...MOCK_BRIEF };
// ─────────────────────────────────────────────────────────────────────────────

export const initialState: AgentState = {
  title: "Atlas Decision Workbench",
  charts: [],
  pinnedMetrics: [
    {
      id: "corpus-size",
      title: "Corpus projects",
      value: "711",
      hint: "Indexed atlas.projects records (source: get_corpus_stats)",
      icon: "users",
    },
    {
      id: "confidence",
      title: "Avg confidence",
      value: "Indicative",
      hint: "Across active session citations",
      icon: "conversion",
    },
  ],
  surface_state: {
    mode: "artifact",
    activeAgent: "ATLAS",
    lens: "CPC",
    timestamp: new Date().toISOString(),
  },
  artifact_block: {
    type: "brief",
    confidence_tier: "Indicative",
    sections: {
      "Strategic Case":
        "Ask the agent a question to generate a brief. Try: \"What is the case for autonomous freight corridors in the UK?\"",
      "Economic Case": "NPV analysis at 3.5% STPR will appear here once evidence is gathered.",
    },
    corpus_citations: [],
  },
  decision_spine: {
    decision: "Should CPC commission autonomous freight corridor research?",
    recommendation:
      "Proceed to scoping phase — evidence base is sufficient for an Indicative assessment.",
    confidence_tier: "Indicative",
    key_assumption:
      "UK government freight decarbonisation targets remain in place through 2030.",
    next_action: "Search CPC corpus for freight decarbonisation analogues.",
    framework: "Green Book / Five Case Model",
    strongest_objection:
      "Technology readiness level remains low; commercial deployment unlikely before 2032.",
    would_change_if: "Evidence of successful corridor pilots in comparable geographies.",
  },
};
