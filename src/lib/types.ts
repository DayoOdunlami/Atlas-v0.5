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

export type CorpusCitation = {
  id: string;
  title: string;
  organisation: string;
  score: number;
};

export type HiveCitation = {
  article_id: string;
  chunk_id?: string;
  title: string;
  score: number;
};

export type ArtifactBlock = {
  type: "brief" | "evidence" | "chart";
  sections?: Record<string, string>;
  corpus_citations?: CorpusCitation[];
  hive_citations?: HiveCitation[];
  npv_value?: number;
  discount_rate?: number;
  confidence_tier: ConfidenceTier;
  chart_spec?: object;
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

export type AgentState = {
  title: string;
  charts: Chart[];
  pinnedMetrics: Metric[];
  surface_state?: SurfaceState;
  artifact_block?: ArtifactBlock;
  decision_spine?: DecisionSpine;
};

export type AgentSetState<T extends AgentState> = (
  newState: T | ((prevState: T | undefined) => T),
) => void;

export const initialState: AgentState = {
  title: "Atlas Decision Workbench",
  charts: [],
  pinnedMetrics: [
    {
      id: "corpus-size",
      title: "Corpus projects",
      value: "2,847",
      hint: "Total indexed CPC project records",
      icon: "users",
    },
    {
      id: "confidence",
      title: "Avg confidence",
      value: "Indicative",
      hint: "Across active session citations",
      icon: "conversion",
    },
    {
      id: "citations",
      title: "Citations found",
      value: "0",
      hint: "Corpus citations in current brief",
      icon: "mrr",
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
    corpus_citations: [
      {
        id: "demo-atlas-001",
        title: "Connected and Autonomous Vehicles: UK Readiness Assessment",
        organisation: "Connected Places Catapult",
        score: 0.87,
      },
      {
        id: "demo-atlas-002",
        title: "Urban Freight Decarbonisation Pathways 2030",
        organisation: "Innovate UK",
        score: 0.74,
      },
    ],
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
