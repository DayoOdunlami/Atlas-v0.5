/**
 * Atlas Visual Recipe Director
 *
 * Pure-TypeScript decision layer that sits between analytical intent and chart
 * selection. No React, no side-effects — call it from recipes, agents, or the
 * test harness.
 *
 * Three-layer model:
 *   classifyIntent(query)         → AnalyticalIntent
 *   inspectData(records)          → DataShape
 *   selectVisuals(intent, shape, context) → VisualSelection
 *
 * Python agents mirror this logic when populating artifact_block.chart_specs.
 * The TypeScript version is the canonical grammar reference.
 */

// ── Intent taxonomy ──────────────────────────────────────────────────────────

export type AnalyticalIntent =
  | "overlap_intersection"  // "Which areas overlap?" → Venn, matrix heatmap
  | "comparison_ranking"    // "Compare A vs B, which is highest?" → bar, table
  | "evidence_coverage"     // "Where is evidence thin?" → heatmap, gap cards
  | "readiness_maturity"    // "How bid-ready?" → radar, gauge
  | "flow_pathway"          // "Where does funding flow?" → Sankey
  | "trade_off_quadrant"    // "High fit but weak evidence?" → scatter
  | "timeline_change"       // "How has this changed over time?" → line, area
  | "portfolio_audit"       // "Show the full portfolio" → stacked-bar, heatmap, table
  | "market_alignment"      // "Which calls match CPC?" → radial-bar, cards
  | "evidence_quality"      // "How reliable is the evidence?" → pie, gauge
  | "unknown";

// ── Visual family vocabulary ─────────────────────────────────────────────────

export type VisualFamily =
  | "venn"        // overlap / intersection diagrams
  | "heatmap"     // 2D matrix density
  | "radar"       // multi-axis coverage / spider chart
  | "gauge"       // single 0–100 score
  | "scatter"     // two-score quadrant
  | "sankey"      // flow / pathway diagram
  | "bar"         // comparison / ranking
  | "stacked-bar" // comparison with categorical breakdown
  | "pie"         // proportion / distribution
  | "radial-bar"  // ranked scores in radial layout
  | "line"        // timeline trend
  | "area"        // timeline with volume fill
  | "graph"       // knowledge / node-link graph
  | "table"       // evidence traceability (sparse data)
  | "cards";      // citation cards (rich evidence)

// ── Data shape inspection ────────────────────────────────────────────────────

export interface DataShape {
  recordCount: number;
  /** Number of distinct string-category values across all string fields */
  categoryCount: number;
  numericFieldCount: number;
  /** Data has sets[] arrays — suitable for Venn */
  hasIntersections: boolean;
  /** A field name contains year/date/month/quarter/period */
  hasTimeField: boolean;
  /** At least one numeric field looks like a score (0–100) */
  hasScores: boolean;
  /** Two or more score fields — suitable for scatter/quadrant */
  hasTwoScores: boolean;
  hasConfidenceTiers: boolean;
  hasSourceLinks: boolean;
  /** Fewer than 3 usable records — chart would mislead */
  isSparse: boolean;
  dimensionality: "1D" | "2D" | "3D+";
}

export function inspectData(records: Record<string, unknown>[]): DataShape {
  const recordCount = records.length;
  const stringFields = new Set<string>();
  const numericFields = new Set<string>();

  for (const row of records) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "string") stringFields.add(key);
      if (typeof val === "number") numericFields.add(key);
    }
  }

  const categoryValues = new Set<string>();
  for (const row of records) {
    for (const field of stringFields) {
      if (row[field]) categoryValues.add(String(row[field]));
    }
  }

  const scoreFields = Array.from(numericFields).filter((f) =>
    /score|pct|percent|rate|fit|strength|readiness|value|count/i.test(f),
  );

  return {
    recordCount,
    categoryCount: categoryValues.size,
    numericFieldCount: numericFields.size,
    hasIntersections: records.some((d) => Array.isArray(d.sets)),
    hasTimeField: Array.from(stringFields).some((f) =>
      /year|date|month|quarter|period|time/i.test(f),
    ),
    hasScores: scoreFields.length >= 1,
    hasTwoScores: scoreFields.length >= 2,
    hasConfidenceTiers: records.some(
      (d) => typeof d.confidence_tier === "string" || typeof d.tier === "string",
    ),
    hasSourceLinks: records.some((d) => d.source_project || d.id || d.source_type),
    isSparse: recordCount < 3,
    dimensionality:
      stringFields.size === 0 ? "1D"
      : stringFields.size === 1 ? "1D"
      : stringFields.size === 2 ? "2D"
      : "3D+",
  };
}

// ── Recipe context ────────────────────────────────────────────────────────────
// Each recipe declares what visuals it can render and its governance rules.

export interface RecipeContext {
  recipeId: string;
  /** Visual families this recipe has components for */
  allowedFamilies: VisualFamily[];
  /** Default if primary is unavailable */
  fallback: VisualFamily;
  governanceRules?: string[];
}

// Pre-defined contexts for each CPC recipe
export const RECIPE_CONTEXTS: Record<string, RecipeContext> = {
  cpc_capability_assessment: {
    recipeId: "cpc_capability_assessment",
    allowedFamilies: ["gauge", "bar", "pie", "heatmap", "radar", "cards"],
    fallback: "cards",
    governanceRules: [
      "Do not show a gauge if claims.length === 0 — no score is meaningful",
      "Prefer cards over bar if evidence_strength < 3",
    ],
  },
  cpc_portfolio_comparison: {
    recipeId: "cpc_portfolio_comparison",
    allowedFamilies: ["stacked-bar", "bar", "heatmap", "venn", "table", "radar"],
    fallback: "table",
    governanceRules: [
      "Prefer heatmap over stacked-bar when BU count > 6",
      "Venn requires at least 2 distinct set values — skip if all BUs have same profile",
    ],
  },
  cpc_market_alignment: {
    recipeId: "cpc_market_alignment",
    allowedFamilies: ["scatter", "radial-bar", "pie", "radar", "venn", "cards"],
    fallback: "cards",
    governanceRules: [
      "Scatter requires two independent score fields — do not synthesize one from the other",
      "Fit score is semantic similarity, not funder assessment — caveat required",
    ],
  },
  cpc_evidence_gaps: {
    recipeId: "cpc_evidence_gaps",
    allowedFamilies: ["gauge", "bar", "pie", "heatmap", "table", "cards"],
    fallback: "table",
    governanceRules: [
      "Gauge readiness score is inverse of gap severity — explain the formula",
      "Do not show a heatmap if fewer than 2 BUs × 2 levels have data",
    ],
  },
  cpc_opportunity_fit: {
    recipeId: "cpc_opportunity_fit",
    allowedFamilies: ["scatter", "bar", "radial-bar", "table", "cards"],
    fallback: "table",
    governanceRules: [
      "Scatter requires live calls with score field — fall back to radial-bar if no calls",
      "Quadrant action labels must be shown — never render scatter without interpretation",
    ],
  },
  cpc_funding_flow: {
    recipeId: "cpc_funding_flow",
    allowedFamilies: ["sankey", "stacked-bar", "bar", "table"],
    fallback: "stacked-bar",
    governanceRules: [
      "Sankey requires at least 3 flow records — fall back to stacked-bar if fewer",
      "Show both funder→BU and BU→evidence-level layers when data allows",
    ],
  },
};

// ── Visual selection output ──────────────────────────────────────────────────

export interface RejectedVisual {
  family: VisualFamily;
  reason: string;
}

export interface VisualSelection {
  intent: AnalyticalIntent;
  primaryFamily: VisualFamily;
  supportingFamilies: VisualFamily[];
  fallbackFamily: VisualFamily;
  /** One-sentence plain-English explanation of why this visual was chosen */
  rationale: string;
  /** Interpretation prompt — phrased as the question the chart answers */
  interpretation: string;
  caveats: string[];
  rejected: RejectedVisual[];
}

// ── Intent classification ────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ intent: AnalyticalIntent; patterns: RegExp[] }> = [
  {
    intent: "overlap_intersection",
    patterns: [/overlap|intersect|both.*and|common|shared|share|in common/i, /venn|euler/i],
  },
  {
    intent: "flow_pathway",
    patterns: [/flow|pathway|route|through|channel|sankey|where.*fund|fund.*move|money.*go/i],
  },
  {
    intent: "evidence_coverage",
    patterns: [
      /thin|gap|missing|weak|no evidence|sparse|coverage|where.*lack|lack.*evidence/i,
      /what.*gap|gap.*analysis|evidence gap/i,
    ],
  },
  {
    intent: "readiness_maturity",
    patterns: [
      /ready|readiness|bid.ready|mature|maturity|how.*prepared|prepared.*bid/i,
      /score.*bid|bid.*score|invest.*ready/i,
    ],
  },
  {
    intent: "trade_off_quadrant",
    patterns: [
      /high.*low|fit.*evidence|evidence.*fit|trade.off|quadrant|worth.*bid/i,
      /priorit.*call|which.*call.*best|best.*call/i,
    ],
  },
  {
    intent: "timeline_change",
    patterns: [/change|trend|over time|history|timeline|grew|grew|increased|decreased|year/i],
  },
  {
    intent: "portfolio_audit",
    patterns: [
      /portfolio|all unit|compare unit|business unit|all.*unit|unit.*all/i,
      /full.*picture|overview.*portfolio|portfolio.*overview/i,
    ],
  },
  {
    intent: "market_alignment",
    patterns: [
      /market|call|live.*call|fund.*match|align|opportunit|which.*call.*match/i,
      /match.*call|fit.*call|call.*fit/i,
    ],
  },
  {
    intent: "evidence_quality",
    patterns: [
      /reliab|quality|tier|supported|robust|specul|indicat|how.*good.*evidence/i,
      /cit.*bid|bid.*cit|which.*claim.*use/i,
    ],
  },
  {
    intent: "comparison_ranking",
    patterns: [
      /compar|rank|most|least|highest|lowest|versus|vs\.|which.*more|more.*than/i,
    ],
  },
];

export function classifyIntent(query: string): AnalyticalIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(query))) return intent;
  }
  return "unknown";
}

// ── Decision table ───────────────────────────────────────────────────────────

type IntentDefault = {
  primary: VisualFamily;
  supporting: VisualFamily[];
  interpretation: string;
};

const INTENT_DEFAULTS: Record<AnalyticalIntent, IntentDefault> = {
  overlap_intersection: {
    primary: "venn",
    supporting: ["heatmap", "table"],
    interpretation: "Where do these groups share common coverage?",
  },
  comparison_ranking: {
    primary: "bar",
    supporting: ["table"],
    interpretation: "Which items rank highest, and by how much?",
  },
  evidence_coverage: {
    primary: "heatmap",
    supporting: ["bar", "table"],
    interpretation: "Which areas have thin or missing evidence?",
  },
  readiness_maturity: {
    primary: "radar",
    supporting: ["gauge", "bar"],
    interpretation: "How ready is this across multiple dimensions?",
  },
  flow_pathway: {
    primary: "sankey",
    supporting: ["bar", "table"],
    interpretation: "How does funding or evidence move through the system?",
  },
  trade_off_quadrant: {
    primary: "scatter",
    supporting: ["bar", "table"],
    supporting2: ["cards"],
    interpretation: "Which opportunities have high fit but weak evidence — or vice versa?",
  } as IntentDefault,
  timeline_change: {
    primary: "line",
    supporting: ["area", "bar"],
    interpretation: "How has this changed over time?",
  },
  portfolio_audit: {
    primary: "stacked-bar",
    supporting: ["heatmap", "table"],
    interpretation: "How is effort and evidence distributed across the portfolio?",
  },
  market_alignment: {
    primary: "radial-bar",
    supporting: ["cards", "pie"],
    interpretation: "Which calls align most strongly with available evidence?",
  },
  evidence_quality: {
    primary: "pie",
    supporting: ["gauge", "bar"],
    interpretation: "How much of the evidence is citable in a funding bid?",
  },
  unknown: {
    primary: "bar",
    supporting: ["table"],
    interpretation: "Overview of the available data.",
  },
};

// ── Main selector ────────────────────────────────────────────────────────────

export function selectVisuals(
  intent: AnalyticalIntent,
  dataShape: DataShape,
  context: RecipeContext,
): VisualSelection {
  const defaults = INTENT_DEFAULTS[intent];
  let primary = defaults.primary;
  const caveats: string[] = [];
  const rejected: RejectedVisual[] = [];

  // ── Data-shape overrides ─────────────────────────────────────────────────

  // Venn needs intersection data
  if (primary === "venn" && !dataShape.hasIntersections) {
    rejected.push({ family: "venn", reason: "no sets[] intersection data in records" });
    primary = "heatmap";
  }

  // Sankey needs at least 3 flow records
  if (primary === "sankey" && dataShape.recordCount < 3) {
    rejected.push({ family: "sankey", reason: "fewer than 3 records — flow diagram would mislead" });
    primary = context.fallback;
    caveats.push("Too few records for a flow diagram — showing summary instead.");
  }

  // Scatter needs two independent score fields
  if (primary === "scatter" && !dataShape.hasTwoScores) {
    rejected.push({ family: "scatter", reason: "requires two independent numeric score fields" });
    primary = "radial-bar";
    caveats.push("Single score dimension available — quadrant view not possible.");
  }

  // Sparse data: prefer evidence cards or table
  if (dataShape.isSparse && !["gauge", "cards", "table"].includes(primary)) {
    rejected.push({ family: primary, reason: "fewer than 3 records — chart would not be meaningful" });
    primary = dataShape.hasSourceLinks ? "cards" : "table";
    caveats.push("Data is sparse — evidence cards shown instead of chart for traceability.");
  }

  // Timeline needs a time field
  if (primary === "line" && !dataShape.hasTimeField) {
    rejected.push({ family: "line", reason: "no time/date field detected" });
    primary = "bar";
    caveats.push("No time field found — timeline replaced with comparison bar.");
  }

  // ── Recipe allowed-families constraint ──────────────────────────────────
  if (!context.allowedFamilies.includes(primary)) {
    rejected.push({
      family: primary,
      reason: `not in ${context.recipeId} allowed visual families`,
    });
    primary = context.fallback;
    caveats.push(`Chosen visual (${primary}) not available in this recipe — using fallback.`);
  }

  // ── Supporting visuals (filter to allowed families) ──────────────────────
  const supportingFamilies = defaults.supporting
    .filter((f) => context.allowedFamilies.includes(f) && f !== primary)
    .slice(0, 2);

  // ── Rationale text ───────────────────────────────────────────────────────
  const rationale = buildRationale(intent, primary, dataShape, rejected);

  return {
    intent,
    primaryFamily: primary,
    supportingFamilies,
    fallbackFamily: context.fallback,
    rationale,
    interpretation: defaults.interpretation,
    caveats,
    rejected,
  };
}

function buildRationale(
  intent: AnalyticalIntent,
  chosen: VisualFamily,
  shape: DataShape,
  rejected: RejectedVisual[],
): string {
  const parts: string[] = [];

  const intentLabels: Record<AnalyticalIntent, string> = {
    overlap_intersection: "overlap/intersection query",
    comparison_ranking: "comparison/ranking query",
    evidence_coverage: "evidence coverage/gap query",
    readiness_maturity: "readiness/maturity query",
    flow_pathway: "flow/pathway query",
    trade_off_quadrant: "trade-off/quadrant query",
    timeline_change: "timeline/change query",
    portfolio_audit: "portfolio audit query",
    market_alignment: "market alignment query",
    evidence_quality: "evidence quality query",
    unknown: "general query",
  };

  const visualLabels: Record<VisualFamily, string> = {
    venn: "Venn diagram",
    heatmap: "heatmap",
    radar: "radar/spider chart",
    gauge: "gauge",
    scatter: "scatter/quadrant chart",
    sankey: "Sankey flow diagram",
    bar: "bar chart",
    "stacked-bar": "stacked bar chart",
    pie: "pie/donut chart",
    "radial-bar": "radial bar chart",
    line: "line chart",
    area: "area chart",
    graph: "knowledge graph",
    table: "data table",
    cards: "evidence cards",
  };

  parts.push(`Detected as a ${intentLabels[intent]}.`);
  parts.push(`${visualLabels[chosen]} chosen`);

  if (shape.isSparse) {
    parts.push("because data is sparse");
  } else if (shape.hasIntersections && chosen === "venn") {
    parts.push("because intersection/set data is present");
  } else if (shape.hasTwoScores && chosen === "scatter") {
    parts.push(`because two score fields enable quadrant analysis`);
  } else if (shape.dimensionality === "2D" && chosen === "heatmap") {
    parts.push("because two categorical dimensions create a matrix");
  } else if (shape.recordCount >= 3 && chosen === "sankey") {
    parts.push("because flow/pathway data has enough records");
  } else {
    parts.push("as the best match for this data shape");
  }

  if (rejected.length > 0) {
    parts.push(
      `(${rejected.map((r) => `${r.family} rejected: ${r.reason}`).join("; ")})`,
    );
  }

  return parts.join(" ") + ".";
}

// ── Quadrant action helper (for opportunity fit scatter) ─────────────────────

export type QuadrantAction = "bid_now" | "enrich_first" | "reposition" | "pass";

export function classifyQuadrant(fitPct: number, evidenceStrength: number): QuadrantAction {
  const highFit = fitPct >= 75;
  const strongEvidence = evidenceStrength >= 3;
  if (highFit && strongEvidence) return "bid_now";
  if (highFit && !strongEvidence) return "enrich_first";
  if (!highFit && strongEvidence) return "reposition";
  return "pass";
}

export const QUADRANT_CONFIG: Record<
  QuadrantAction,
  { label: string; color: string; textCls: string; bgCls: string; borderCls: string }
> = {
  bid_now: {
    label: "Bid now",
    color: "#22c55e",
    textCls: "text-green-700",
    bgCls: "bg-green-50",
    borderCls: "border-green-200",
  },
  enrich_first: {
    label: "Enrich evidence first",
    color: "#f59e0b",
    textCls: "text-amber-700",
    bgCls: "bg-amber-50",
    borderCls: "border-amber-200",
  },
  reposition: {
    label: "Reposition or monitor",
    color: "#3b82f6",
    textCls: "text-blue-700",
    bgCls: "bg-blue-50",
    borderCls: "border-blue-200",
  },
  pass: {
    label: "Pass",
    color: "#6b7280",
    textCls: "text-muted-foreground",
    bgCls: "bg-muted/40",
    borderCls: "border-border",
  },
};
