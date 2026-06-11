// Demo fixtures for the Atlas Workbench.
//
// Purpose: showcase every block type with realistic CPC-flavoured content
// so the UI can be evaluated without a live corpus / agent. Each scenario
// is a fully-formed AtlasRenderModel + a canned chat transcript.
//
// URL: /workbench/demo?scenario=<id>
//
// IMPORTANT: Demo fixtures are not connected to LangGraph. The chat panel
// in demo mode replays the canned transcript; the composer is informational.
//
// To add a new scenario:
//   1. Add a new entry to DEMO_SCENARIOS below
//   2. The scenario id becomes the URL param (?scenario=<id>)
//   3. Pick blocks that genuinely demonstrate the question being asked

import type {
  AtlasRenderModel,
  RenderBlock,
} from "@/lib/workbench/atlas-render-model";
import type { WorkbenchChatMessage } from "@/lib/workbench/workbench-context";

export interface DemoScenario {
  id: string;
  label: string;
  /** Short prompt for the scenario picker */
  prompt: string;
  /** Group for the picker UI */
  group: "explore" | "analyse" | "decide";
  /** Optional one-line description */
  description?: string;
  /** Pre-baked render model — drives the canvas */
  model: AtlasRenderModel;
  /** Pre-baked chat transcript — drives the demo chat panel */
  messages: WorkbenchChatMessage[];
  /** Last route the "agent" used — drives the chat route chip */
  lastRoute?: string;
  /** Last citations — drives the citation strip */
  lastCitations?: Array<{
    id: string;
    title?: string;
    organisation?: string;
    score?: number;
    relevanceNote?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Shared scaffolding — every fixture uses the same source/target for the
// "CPC innovation portfolio" framing. Individual scenarios override blocks.
// ---------------------------------------------------------------------------

const CPC_SOURCE = {
  type: "passport" as const,
  id: "passport-cpc-portfolio",
  title: "Connected Places Catapult — Innovation Portfolio",
  summary:
    "CPC's active portfolio across rail, road, maritime, aviation, and urban innovation. Combines stored project records, live calls, and outcomes evidence from the corpus.",
};

const CPC_TARGET = {
  type: "project" as const,
  id: "target-cpc-strategy",
  title: "CPC Strategic Lens 2025–2030",
  funder: "DfT / Innovate UK",
  status: "Active",
  lead_org: "Connected Places Catapult",
  abstract:
    "Whole-portfolio analysis lens. Lets the analyst ask cross-cutting questions about CPC's positioning, gaps, opportunities, and partnership posture.",
};

function baseModel(
  overrides: Partial<AtlasRenderModel> & { blocks: RenderBlock[] },
): AtlasRenderModel {
  return {
    artifact_id: overrides.artifact_id ?? "demo-artifact",
    model_version: "demo-1.0",
    generated_at: "2026-06-11T10:00:00Z",
    canonical_question_id: "cq.match.workbench",
    layout_template: "demo",
    mode: "demo",
    source_object: overrides.source_object ?? CPC_SOURCE,
    target_object: overrides.target_object ?? CPC_TARGET,
    decision_spine:
      overrides.decision_spine ?? {
        recommendation: "Investigate further before commitment",
        decision: "Demo mode — illustrative only",
        summary:
          "This artifact uses pre-baked demo data so the UI can be evaluated without a live corpus connection.",
        confidence_tier: "Indicative",
        confidence_cap_reason:
          "Demo mode — no real corpus evidence backs these blocks.",
        score: 0.62,
      },
    blocks: overrides.blocks,
    inspector_index: overrides.inspector_index ?? {},
    snapshot:
      overrides.snapshot ?? {
        title: "Demo snapshot",
        included_blocks: overrides.blocks.map((b) => b.id),
        must_include: [],
      },
    data_quality_notes:
      overrides.data_quality_notes ?? [
        "Demo fixture — no live corpus query was made.",
      ],
  };
}

function msg(
  role: "user" | "assistant",
  content: string,
  extras: Partial<WorkbenchChatMessage> = {},
): WorkbenchChatMessage {
  return {
    id: `demo-${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extras,
  };
}

// ===========================================================================
// 01 — Top 10 questions about CPC
// ===========================================================================

const topQuestionsModel = baseModel({
  artifact_id: "demo-top-questions",
  decision_spine: {
    recommendation: "Lead with portfolio questions before commissioning new work",
    decision: "10 priority questions surfaced from the corpus",
    summary:
      "These are the questions analysts most-often need answered to position a new piece of work inside CPC's existing landscape.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "Synthesised from recurring patterns in 2024–2026 corpus interactions.",
    score: 0.74,
  },
  blocks: [
    {
      id: "top-q-context",
      type: "ContextCard",
      visual: "paired_context_cards",
      state: "core",
      headline: "Why these 10 questions",
      role: "context",
      content: {
        source: {
          id: CPC_SOURCE.id,
          title: CPC_SOURCE.title,
          summary:
            "Mined from 18 months of analyst sessions across rail, urban, and maritime briefs.",
        },
        target: {
          id: "context-lens",
          title: "Strategic positioning",
          abstract:
            "Each question maps to a downstream decision: pursue, partner, defer, or de-risk.",
        },
      },
    },
    {
      id: "top-q-list",
      type: "OpportunityList",
      visual: "ranked_table",
      state: "core",
      headline: "Top 10 questions analysts ask Atlas",
      role: "focus",
      content: [
        {
          id: "q1",
          title:
            "Where in CPC's portfolio is rail-AI strongest and where are the gaps?",
          organisation: "Portfolio analytics",
          score: 0.94,
          abstract:
            "Returned via NetworkMap. 32 projects, 7 funders, density highest in inspection + signalling.",
        },
        {
          id: "q2",
          title: "What's the economic case for autonomous freight in 2027?",
          organisation: "Economic appraisal",
          score: 0.91,
          abstract:
            "NPV positive at £18.4m at 3.5% STPR — gated on signalling integration risk.",
        },
        {
          id: "q3",
          title: "Who should CPC partner with on EV-to-grid pilots?",
          organisation: "Partnerships",
          score: 0.88,
          abstract:
            "3 strong candidates surface from corpus co-authorship + funding co-occurrence.",
        },
        {
          id: "q4",
          title: "Does GPS-denied navigation transfer from rail to maritime?",
          organisation: "Cross-sector",
          score: 0.85,
          abstract:
            "Partial transfer — depends on inertial sensor cost trajectory. See TransferLanes.",
        },
        {
          id: "q5",
          title: "What gaps would block a credible smart-cities bid in 2026?",
          organisation: "Bid strategy",
          score: 0.82,
          abstract:
            "5 gaps — most critical: missing urban realtime telemetry partnerships.",
        },
        {
          id: "q6",
          title: "Which CPC outcomes are most-cited externally?",
          organisation: "Influence audit",
          score: 0.78,
          abstract:
            "Top 3 outcomes drive 41% of all external citations of CPC work.",
        },
        {
          id: "q7",
          title:
            "Where is CPC duplicating effort vs Catapult network partners?",
          organisation: "Network analysis",
          score: 0.74,
          abstract:
            "Two overlap zones flagged with the Future Mobility & Digital Catapults.",
        },
        {
          id: "q8",
          title: "What does the corpus say about decarbonising last-mile?",
          organisation: "Climate",
          score: 0.71,
          abstract:
            "Strong evidence on cargo-bike viability — weak on charging-infrastructure economics.",
        },
        {
          id: "q9",
          title:
            "Which standards bodies does CPC consistently underweight in briefs?",
          organisation: "Standards",
          score: 0.66,
          abstract:
            "ISO/TC 268, ETSI ITS, and the new ORR digital-twin advisory.",
        },
        {
          id: "q10",
          title: "What 3 follow-ons should every Atlas user know about?",
          organisation: "Onboarding",
          score: 0.61,
          abstract:
            "Brief snapshot, transfer lanes, and economic case rapid-prototyping.",
        },
      ],
    },
  ],
});

const topQuestionsScenario: DemoScenario = {
  id: "top-questions",
  label: "Top 10 questions about CPC",
  prompt: "What are the top questions analysts ask Atlas about CPC?",
  group: "explore",
  description:
    "Ranked OpportunityList — the questions that drive most downstream briefs.",
  model: topQuestionsModel,
  lastRoute: "explore",
  lastCitations: [
    {
      id: "atlas-onboarding-2026",
      title: "Atlas onboarding session notes",
      organisation: "CPC analyst desk",
      score: 0.83,
      relevanceNote: "18 months of recurring question patterns",
    },
  ],
  messages: [
    msg("user", "What are the top questions analysts ask Atlas about CPC?"),
    msg(
      "assistant",
      "I synthesised the top 10 questions from 18 months of analyst sessions and grouped them by decision-type. The OpportunityList below is ranked by frequency × downstream-impact. Each item links to the route Atlas would take to answer it.",
      {
        reasoning: {
          content:
            "Pulled 1.2k analyst prompts from session logs → clustered by intent → ranked by frequency × ‘led to a brief’ outcome. Removed PII and one-off curiosity queries. Top 10 surfaced where score > 0.6.",
          duration: 2400,
        },
        citations: [
          {
            id: "atlas-onboarding-2026",
            title: "Atlas onboarding session notes",
            score: 0.83,
          },
        ],
      },
    ),
  ],
};

// ===========================================================================
// 02 — SWOT on CPC innovation portfolio
// ===========================================================================

const swotModel = baseModel({
  artifact_id: "demo-cpc-swot",
  decision_spine: {
    recommendation:
      "Double down on cross-sector convening; close two operational gaps before bidding on smart-cities",
    decision: "SWOT — CPC Innovation Portfolio",
    summary:
      "CPC's neutral-broker positioning is a clear strength; opportunity sits in net-zero and active travel; threat from consultancies entering the market.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "Synthesised from 87 portfolio entries, 12 strategy docs, and 4 external interviews.",
    score: 0.78,
  },
  blocks: [
    {
      id: "swot-cpc",
      type: "ComparisonMatrix",
      visual: "quadrant_grid",
      state: "core",
      headline: "SWOT — CPC Innovation on Portfolio",
      role: "focus",
      content: {
        quadrants: [
          {
            label: "Strengths",
            body: "- **Unique UK catapult mandate** bridging public sector, academia, and industry\n- **Cross-cutting expertise** spanning mobility, digital infrastructure, and place-based innovation\n- **Strong government and innovate UK relationships** enabling access to national programmes\n- **Established testbeds and demonstrator environments** (e.g. urban mobility, CAV, smart places)\n- **Neutral convening role** trusted by both public and private sector partners",
          },
          {
            label: "Weaknesses",
            body: "- **Reliance on innovate UK core funding** creates vulnerability to spending review cycles\n- **Portfolio breadth can dilute depth of expertise** in any single domain\n- **Limited corpus indexing** reduces internal knowledge reuse and transfer efficiency\n- **Commercialisation pathways from research to market-ready products** are not always clear\n- **Smaller scale than some international equivalents** limits global influence",
          },
          {
            label: "Opportunities",
            body: "- **Growing UK policy focus** on net zero, active travel, and smart city infrastructure\n- **Levelling-up and place-based investment agendas** create demand for CPC's expertise\n- **International partnerships** (eg. ASEAN, Gulf states) expanding market for UK innovation exports\n- **Emerging technology waves** (AI, digital twins, 5G/6G) align with CPC's connected places thesis\n- **Increased local authority appetite** for data-driven transport and planning tools",
          },
          {
            label: "Threats",
            body: "- **Competitive pressure** from consultancies and universities offering similar services at lower cost\n- **Policy uncertainty** around autonomous vehicles and connected transport slowing industry investment\n- **Risk of being outpaced** by faster-moving private-sector innovation in key verticals\n- **Post-Brexit constraints** on EU horizon collaboration including access to European research networks\n- **Funding squeeze across public-sector clients** limiting pull-and-pipeline conversion",
          },
        ],
      },
    },
  ],
});

const swotScenario: DemoScenario = {
  id: "cpc-swot",
  label: "SWOT the CPC portfolio",
  prompt: "Give me a SWOT on the CPC innovation portfolio",
  group: "analyse",
  description: "Four-quadrant SWOT analysis with color-coded themes.",
  model: swotModel,
  lastRoute: "propose",
  messages: [
    msg("user", "Give me a SWOT on the CPC innovation portfolio"),
    msg(
      "assistant",
      "I've added a SWOT quadrant to the canvas covering CPC's innovation portfolio. The 4-quadrant grid surfaces strengths, weaknesses, opportunities, threats with 5 bullets per quadrant. **Top takeaways**: CPC's neutral-broker positioning is the strongest asset; biggest threat is consultancies entering the market; biggest opportunity is the levelling-up agenda creating place-based demand.",
      {
        reasoning: {
          content:
            "Loaded CPC strategy docs (n=12), portfolio entries (n=87), and external interview notes (n=4). Ran SWOT framework against the corpus. Bullets ranked by evidence-mention frequency. Cross-checked against 2024 ORR + DfT industrial strategy alignment.",
          duration: 3200,
        },
      },
    ),
  ],
};

// ===========================================================================
// 03 — Gaps in CPC innovation
// ===========================================================================

const gapsModel = baseModel({
  artifact_id: "demo-cpc-gaps",
  decision_spine: {
    recommendation:
      "Close 2 critical gaps (urban telemetry + EV-to-grid) before next bid round",
    decision: "5 strategic gaps in CPC's innovation portfolio",
    summary:
      "Gaps clustered by severity. The 2 critical gaps would block a credible smart-cities bid in 2026.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "Triangulated from corpus coverage, external benchmark, and 4 partner interviews.",
    score: 0.71,
  },
  blocks: [
    {
      id: "gaps-evidence",
      type: "EvidenceStateSummary",
      visual: "evidence_state_bar",
      state: "core",
      headline: "Evidence coverage across the gap analysis",
      role: "context",
      content: {
        counts: {
          verified: 18,
          "self-reported": 9,
          inferred: 6,
          unknown: 3,
          contested: 1,
        },
        total_claims: 37,
        cap_reason:
          "1 contested claim (active-travel ROI) holds the overall tier at Supported.",
      },
    },
    {
      id: "gaps-list",
      type: "DimensionGap",
      visual: "source_target_gap_rows",
      state: "core",
      headline: "5 strategic gaps in CPC's innovation portfolio",
      role: "focus",
      content: [
        {
          id: "gap-1",
          gap_type: "Capability",
          title: "Urban realtime telemetry partnerships",
          magnitude: "large",
          severity: "critical",
          description:
            "CPC lacks an operating partnership with a major UK city for sub-second telemetry. Without it, smart-cities bids that require real-time data lose competitiveness.",
          provenance: "stored",
          evidence_state: "verified",
          what_would_change:
            "Standing MOU with one of: Manchester, Bristol, Greater Cambridge.",
        },
        {
          id: "gap-2",
          gap_type: "Capability",
          title: "EV-to-grid pilot infrastructure",
          magnitude: "large",
          severity: "critical",
          description:
            "No active V2G pilot site under CPC's direct oversight. Cited by 3 partners as a missing precondition for joint bids.",
          provenance: "derived",
          evidence_state: "self-reported",
          what_would_change:
            "Joint venture with a DNO to host a 50-vehicle pilot.",
        },
        {
          id: "gap-3",
          gap_type: "Process",
          title: "Standards-body co-publishing cadence",
          magnitude: "medium",
          severity: "significant",
          description:
            "CPC co-authors ~2 standards papers/year; comparator orgs average 6-8. Reduces external influence on emerging digital-twin standards.",
          provenance: "stored",
          evidence_state: "verified",
        },
        {
          id: "gap-4",
          gap_type: "Skills",
          title: "Senior product economist coverage",
          magnitude: "medium",
          severity: "significant",
          description:
            "Five Case appraisals are bottlenecked on 1 senior economist. Slows brief turnaround during peak commissioning windows.",
          provenance: "derived",
          evidence_state: "inferred",
        },
        {
          id: "gap-5",
          gap_type: "Evidence",
          title: "Outcomes tracking on closed projects",
          magnitude: "small",
          severity: "minor",
          description:
            "Post-close outcomes captured for 64% of projects. Below the 80% threshold used in equivalent funders.",
          provenance: "stored",
          evidence_state: "verified",
        },
      ],
    },
  ],
});

const gapsScenario: DemoScenario = {
  id: "innovation-gaps",
  label: "Gaps in CPC innovation",
  prompt: "What are the gaps in our innovation portfolio?",
  group: "analyse",
  description: "DimensionGap rows + EvidenceStateSummary coverage bar.",
  model: gapsModel,
  lastRoute: "propose",
  messages: [
    msg("user", "What are the gaps in our innovation portfolio?"),
    msg(
      "assistant",
      "I found 5 gaps and added them to the canvas, ordered by severity. **Two are critical** and would block a credible smart-cities bid in 2026 — urban telemetry partnerships and EV-to-grid infrastructure. The evidence bar shows 18 of 37 claims are verified; the rest are mostly self-reported or inferred, which caps overall confidence at *Supported*.",
      {
        reasoning: {
          content:
            "Compared CPC's portfolio against 3 comparator orgs (Future Mobility Catapult, Energy Systems Catapult, equivalent Singapore body). Filtered to gaps with ≥2 corroborating signals. Severity ranked by ‘would-block-a-bid’ test.",
          duration: 2800,
        },
      },
    ),
  ],
};

// ===========================================================================
// 04 — Partnership opportunities
// ===========================================================================

const partnersModel = baseModel({
  artifact_id: "demo-partnerships",
  decision_spine: {
    recommendation:
      "Approach Octopus Energy, Centrica, and University of Manchester for joint EV-to-grid bid",
    decision: "Top partnership opportunities by domain fit",
    summary:
      "8 candidates ranked by co-citation, complementary capability, and funder-overlap. Top 3 score >0.85.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "Citation graph based on 18 months of joint-publication data.",
    score: 0.81,
  },
  blocks: [
    {
      id: "partners-context",
      type: "ContextCard",
      visual: "paired_context_cards",
      state: "core",
      headline: "Partnership lens — EV-to-grid focus",
      role: "context",
      content: {
        source: {
          id: CPC_SOURCE.id,
          title: "CPC partnership posture",
          summary:
            "Currently 12 active partnerships; 4 in energy, 6 in transport, 2 in built environment. Net-zero theme under-served.",
        },
        target: {
          id: "partner-lens",
          title: "EV-to-grid (V2G) — bid window 2027",
          abstract:
            "Innovate UK + Ofgem co-funded call. CPC scoped to lead consortium if 3 partners signed by Q1 2026.",
        },
      },
    },
    {
      id: "partners-list",
      type: "OpportunityList",
      visual: "ranked_table",
      state: "core",
      headline: "Ranked partnership opportunities (EV-to-grid)",
      role: "focus",
      content: [
        {
          id: "p1",
          title: "Octopus Energy — Kraken platform integration",
          organisation: "Octopus Energy Group",
          funder: "Innovate UK / Ofgem",
          score: 0.92,
          status: "Warm intro",
          abstract:
            "13 co-citations in 2024-25. Existing MOU on smart-tariff data. V2G pilot readiness confirmed.",
        },
        {
          id: "p2",
          title: "Centrica — Hive smart-grid telemetry",
          organisation: "Centrica plc",
          funder: "Industry-led",
          score: 0.87,
          status: "Active discussion",
          abstract:
            "Joint workshop in March 2026. Centrica brings 350k smart-grid endpoints, CPC brings convening role.",
        },
        {
          id: "p3",
          title: "University of Manchester — Tyndall Centre",
          organisation: "University of Manchester",
          funder: "EPSRC / NERC",
          score: 0.86,
          status: "Strong corpus signal",
          abstract:
            "8 co-authored papers. Manchester provides academic depth on grid-storage economics.",
        },
        {
          id: "p4",
          title: "UK Power Networks — DNO integration partner",
          organisation: "UK Power Networks",
          funder: "Ofgem RIIO-ED2",
          score: 0.78,
          status: "Scoped",
          abstract:
            "Recently published V2G white paper. Looking for academic + Catapult partners.",
        },
        {
          id: "p5",
          title: "Connected Energy — second-life batteries",
          organisation: "Connected Energy Ltd",
          funder: "Industry",
          score: 0.71,
          status: "Cold",
          abstract:
            "Strong technical fit but no prior CPC interaction. Would need an introduction.",
        },
        {
          id: "p6",
          title: "Heriot-Watt — Smart Grids research group",
          organisation: "Heriot-Watt University",
          funder: "EPSRC",
          score: 0.63,
          status: "Cold",
          abstract:
            "Scotland-based, complements Manchester. Lower co-citation score but distinct geography.",
        },
      ],
    },
  ],
});

const partnersScenario: DemoScenario = {
  id: "partners",
  label: "What should we partner on?",
  prompt:
    "Who should CPC partner with on EV-to-grid pilots for the 2027 bid window?",
  group: "decide",
  description: "OpportunityList + ContextCard pairing.",
  model: partnersModel,
  lastRoute: "explore",
  lastCitations: [
    {
      id: "iuk-v2g-2025",
      title: "Innovate UK V2G pilots — outcomes review 2025",
      organisation: "Innovate UK",
      score: 0.91,
      relevanceNote: "Names Octopus, Centrica as top performers",
    },
    {
      id: "ofgem-riio-ed2",
      title: "Ofgem RIIO-ED2 framework — V2G provisions",
      organisation: "Ofgem",
      score: 0.84,
      relevanceNote: "Defines DNO obligations relevant to UKPN scoping",
    },
    {
      id: "tyndall-grid-2024",
      title: "Tyndall Centre — grid storage economics review",
      organisation: "University of Manchester",
      score: 0.79,
    },
  ],
  messages: [
    msg(
      "user",
      "Who should CPC partner with on EV-to-grid pilots for the 2027 bid window?",
    ),
    msg(
      "assistant",
      "Top 3 candidates surface clearly: **Octopus Energy** (0.92), **Centrica** (0.87), and **University of Manchester** (0.86). All three pass the joint-citation + funder-overlap + capability-complementarity tests. Octopus is the strongest single move because of the existing MOU and confirmed V2G pilot readiness. I've also surfaced 3 weaker candidates worth keeping warm.",
      {
        reasoning: {
          content:
            "Built a partnership scoring model: 0.4 × co-citation + 0.3 × funder-overlap + 0.3 × capability-complementarity. Filtered to V2G domain. Cross-referenced with Innovate UK pilot outcomes (2024-25) to identify proven performers.",
          duration: 3100,
        },
      },
    ),
  ],
};

// ===========================================================================
// 05 — Rail-AI landscape (NetworkMap)
// ===========================================================================

const railAiModel = baseModel({
  artifact_id: "demo-rail-ai-landscape",
  decision_spine: {
    recommendation:
      "Network is dense around inspection + signalling; thin around accessibility and freight optimisation",
    decision: "Rail-AI knowledge graph — 32 projects, 18 organisations",
    summary:
      "Inspection cluster is mature (12 projects, 5 funders). Signalling is a high-investment cluster with HS2 + Network Rail concentration. Accessibility AI is the clearest white-space.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "Built from atlas.projects with rail-ai keyword tags and explicit theme links.",
    score: 0.77,
  },
  blocks: [
    {
      id: "rail-ai-map",
      type: "NetworkMap",
      visual: "knowledge_graph",
      state: "core",
      headline: "Rail-AI landscape — projects × themes × funders",
      role: "focus",
      content: {
        nodes: [
          // Themes (cluster anchors)
          { id: "t-inspection", label: "Inspection AI", group: "theme", value: 24 },
          { id: "t-signalling", label: "Signalling AI", group: "theme", value: 22 },
          { id: "t-passenger", label: "Passenger flow", group: "theme", value: 16 },
          { id: "t-freight", label: "Freight optimisation", group: "theme", value: 12 },
          { id: "t-accessibility", label: "Accessibility AI", group: "theme", value: 7 },
          // Funders
          { id: "f-iuk", label: "Innovate UK", group: "funder", value: 18 },
          { id: "f-nr", label: "Network Rail", group: "funder", value: 14 },
          { id: "f-rssb", label: "RSSB", group: "funder", value: 9 },
          { id: "f-dft", label: "DfT", group: "funder", value: 11 },
          // Organisations
          { id: "o-cpc", label: "CPC", group: "organisation", value: 15 },
          { id: "o-hs2", label: "HS2 Ltd", group: "organisation", value: 8 },
          { id: "o-tflriff", label: "TfL Rail-AI Hub", group: "organisation", value: 6 },
          { id: "o-siemens", label: "Siemens Mobility", group: "organisation", value: 7 },
          { id: "o-thales", label: "Thales UK", group: "organisation", value: 5 },
          // Projects (leaf nodes)
          { id: "p-1", label: "RAIL-AI Inspection Pilot", group: "project", value: 4 },
          { id: "p-2", label: "Signalling Vision Trial", group: "project", value: 5 },
          { id: "p-3", label: "Crowd-flow Twin", group: "project", value: 3 },
          { id: "p-4", label: "Freight Slot Optimiser", group: "project", value: 4 },
          { id: "p-5", label: "Accessibility Companion AI", group: "project", value: 3 },
          { id: "p-6", label: "Auto-PWay Survey", group: "project", value: 4 },
        ],
        edges: [
          // Themes ↔ funders
          { source: "t-inspection", target: "f-iuk", weight: 3 },
          { source: "t-inspection", target: "f-rssb", weight: 2 },
          { source: "t-signalling", target: "f-nr", weight: 4 },
          { source: "t-signalling", target: "f-dft", weight: 3 },
          { source: "t-passenger", target: "f-iuk", weight: 2 },
          { source: "t-freight", target: "f-dft", weight: 2 },
          { source: "t-accessibility", target: "f-iuk", weight: 1 },
          // Themes ↔ organisations
          { source: "t-inspection", target: "o-cpc", weight: 4 },
          { source: "t-signalling", target: "o-hs2", weight: 3 },
          { source: "t-signalling", target: "o-siemens", weight: 3 },
          { source: "t-signalling", target: "o-thales", weight: 2 },
          { source: "t-passenger", target: "o-tflriff", weight: 3 },
          { source: "t-passenger", target: "o-cpc", weight: 2 },
          { source: "t-freight", target: "o-cpc", weight: 2 },
          // Projects → themes
          { source: "p-1", target: "t-inspection", weight: 1 },
          { source: "p-2", target: "t-signalling", weight: 1 },
          { source: "p-3", target: "t-passenger", weight: 1 },
          { source: "p-4", target: "t-freight", weight: 1 },
          { source: "p-5", target: "t-accessibility", weight: 1 },
          { source: "p-6", target: "t-inspection", weight: 1 },
          // Projects → orgs
          { source: "p-1", target: "o-cpc", weight: 1 },
          { source: "p-2", target: "o-siemens", weight: 1 },
          { source: "p-2", target: "o-hs2", weight: 1 },
          { source: "p-3", target: "o-tflriff", weight: 1 },
          { source: "p-4", target: "o-cpc", weight: 1 },
          { source: "p-5", target: "o-cpc", weight: 1 },
          { source: "p-6", target: "o-thales", weight: 1 },
        ],
      },
    },
  ],
});

const railAiScenario: DemoScenario = {
  id: "rail-ai-landscape",
  label: "Rail-AI landscape",
  prompt: "Show me the rail-AI landscape in CPC's corpus",
  group: "explore",
  description: "Knowledge graph: themes × funders × projects × orgs.",
  model: railAiModel,
  lastRoute: "explore",
  messages: [
    msg("user", "Show me the rail-AI landscape in CPC's corpus"),
    msg(
      "assistant",
      "Loaded 32 rail-AI projects across 5 themes, 4 funders, and 18 organisations. **Inspection AI** is the mature cluster (12 projects); **signalling** is the highest-investment cluster (HS2 + Network Rail concentration); **accessibility AI** is the clearest white-space with only 1 active project. CPC sits at the centre of 4 of the 5 theme clusters.",
      {
        reasoning: {
          content:
            "Filtered atlas.projects WHERE 'rail' = ANY(themes) AND 'ai' = ANY(tags). Built bipartite graph from project → theme → funder + project → organisation. Ranked clusters by node count + total funding.",
          duration: 2200,
        },
      },
    ),
  ],
};

// ===========================================================================
// 06 — Transfer rail-AI to maritime (TransferLanes)
// ===========================================================================

const transferModel = baseModel({
  artifact_id: "demo-transfer-maritime",
  decision_spine: {
    recommendation:
      "Pursue inspection-AI transfer; defer signalling transfer pending sensor cost data",
    decision: "Rail → Maritime transfer credibility",
    summary:
      "Of 6 claims tested, 2 travel as-is, 2 need reframing, 1 is not credible in maritime, and 1 needs evidence.",
    confidence_tier: "Indicative",
    confidence_cap_reason:
      "Maritime corpus thinner than rail — judgement holds 2 verdicts.",
    score: 0.58,
  },
  blocks: [
    {
      id: "transfer-context",
      type: "ContextCard",
      visual: "paired_context_cards",
      state: "core",
      headline: "Transfer hypothesis — rail-AI to maritime",
      role: "context",
      content: {
        source: {
          id: "source-rail",
          title: "Rail-AI corpus evidence (n=32 projects)",
          summary:
            "Mature evidence base spanning inspection, signalling, passenger-flow.",
        },
        target: {
          id: "target-maritime",
          title: "UK maritime innovation surface",
          abstract:
            "Smaller corpus (n=7 directly-relevant projects). Different regulatory regime (MCA, IMO).",
        },
      },
    },
    {
      id: "transfer-lanes",
      type: "TransferLanes",
      visual: "four_lane_board",
      state: "core",
      headline: "Four-lane transfer verdict — does rail-AI transfer to maritime?",
      role: "focus",
      content: [
        {
          id: "tl-1",
          claim_text:
            "Computer-vision inspection on rolling stock generalises to ship hulls and engine rooms.",
          transfer_outcome: "travels-as-is",
          evidence_state: "verified",
          provenance: "stored",
          note: "MCA pilot 2024 confirmed equivalent failure-mode catalogue.",
        },
        {
          id: "tl-2",
          claim_text:
            "Predictive-maintenance models trained on rail bogies apply to marine propulsion.",
          transfer_outcome: "travels-as-is",
          evidence_state: "self-reported",
          provenance: "derived",
          note: "Two operator-led trials report >85% transfer accuracy.",
        },
        {
          id: "tl-3",
          claim_text:
            "Crowd-flow models from stations apply directly to ferry boarding.",
          transfer_outcome: "needs-reframing",
          evidence_state: "inferred",
          provenance: "derived",
          note: "Maritime boarding is sparser + has fixed slot windows — model assumptions break.",
        },
        {
          id: "tl-4",
          claim_text:
            "GPS-denied navigation (rail tunnels) transfers to indoor port environments.",
          transfer_outcome: "needs-reframing",
          evidence_state: "inferred",
          provenance: "derived",
          note: "Inertial-sensor cost trajectory differs — needs maritime-specific re-cost.",
        },
        {
          id: "tl-5",
          claim_text:
            "Signalling-AI for train-spacing applies to vessel-spacing in port approaches.",
          transfer_outcome: "not-credible-here",
          evidence_state: "contested",
          provenance: "stored",
          note: "Stopping distances + collision physics differ by 2 orders of magnitude.",
        },
        {
          id: "tl-6",
          claim_text:
            "Track-defect detection algorithms transfer to underwater hull inspection.",
          transfer_outcome: "evidence-needed",
          evidence_state: "unknown",
          provenance: "live-gap",
          note: "No published UK pilots. Worth scoping a feasibility study.",
        },
      ],
    },
  ],
});

const transferScenario: DemoScenario = {
  id: "transfer-maritime",
  label: "Transfer rail-AI to maritime",
  prompt: "Does our rail-AI evidence transfer to maritime?",
  group: "decide",
  description: "Four-lane transfer board with evidence states.",
  model: transferModel,
  lastRoute: "explore",
  messages: [
    msg("user", "Does our rail-AI evidence transfer to maritime?"),
    msg(
      "assistant",
      "Mixed verdict across 6 claims. **Inspection-AI travels as-is** — MCA pilots confirm equivalent failure modes. **Crowd-flow and GPS-denied navigation need reframing** (different operational assumptions). **Signalling won't transfer** — collision physics differ by 2 orders of magnitude. **One unknown** worth scoping: underwater hull-defect detection. The Indicative tier reflects the thinner maritime corpus.",
      {
        reasoning: {
          content:
            "Loaded rail-AI claim ledger (n=14) → maritime-corpus (n=7) → ran transferability check per claim. Verdict heuristics: assumption-overlap + regulatory-overlap + evidence-density.",
          duration: 2800,
        },
      },
    ),
  ],
};

// ===========================================================================
// 07 — Economic case for autonomous freight
// ===========================================================================

const econModel = baseModel({
  artifact_id: "demo-econ-freight",
  decision_spine: {
    recommendation:
      "Pursue — NPV positive at £18.4m; sensitive to signalling-integration risk",
    decision: "Economic case for autonomous freight in 2027",
    summary:
      "Five Case scores positive across strategic, economic, financial. Commercial is the weakest case — gated on signalling-integration contract.",
    confidence_tier: "Supported",
    confidence_cap_reason:
      "NPV uses Green Book 3.5% STPR; 60% of benefits are quantified from comparator schemes.",
    score: 0.74,
  },
  blocks: [
    {
      id: "econ-case",
      type: "EconomicCase",
      visual: "npv_waterfall",
      state: "core",
      headline: "Five Case appraisal — autonomous freight 2027",
      role: "focus",
      content: {
        verdict: "positive",
        verdict_summary:
          "NPV £18.4m at 3.5% STPR over 10 years; BCR 2.1. Sensitive to signalling-integration cost.",
        confidence_tier: "Supported",
        confidence_cap_reason:
          "Commercial Case relies on 1 yet-to-be-signed signalling-integration contract.",
        npv_value: 18_400_000,
        bcr: 2.1,
        discount_rate: 0.035,
        appraisal_period_years: 10,
        section_scores: [
          {
            case: "strategic",
            label: "Strategic Case",
            score: 0.84,
            summary:
              "Aligns with DfT freight decarbonisation strategy + Rail Industrial Strategy.",
            evidence_state: "verified",
          },
          {
            case: "economic",
            label: "Economic Case",
            score: 0.78,
            summary:
              "NPV positive across central + low scenarios; negative only in pessimistic case.",
            evidence_state: "self-reported",
          },
          {
            case: "commercial",
            label: "Commercial Case",
            score: 0.55,
            summary:
              "Signalling-integration contract not yet signed — single point of failure.",
            evidence_state: "inferred",
          },
          {
            case: "financial",
            label: "Financial Case",
            score: 0.72,
            summary:
              "Funding profile fits Innovate UK + RSSB co-funding pattern; cash-flow positive Y3.",
            evidence_state: "verified",
          },
          {
            case: "management",
            label: "Management Case",
            score: 0.69,
            summary:
              "Existing programme team has freight experience; governance via RSSB-CPC steering group.",
            evidence_state: "self-reported",
          },
        ],
        value_drivers: [
          {
            name: "Reduced fuel + driver cost",
            description: "Autonomous operation removes 1 driver per train; reduces dwell.",
            direction: "benefit",
            magnitude: "high",
            quantified_value: 24_000_000,
            evidence_state: "verified",
          },
          {
            name: "Signalling integration capex",
            description:
              "One-off integration with ETCS / TMS; comparator schemes ran 15% over budget.",
            direction: "cost",
            magnitude: "high",
            quantified_value: -9_200_000,
            evidence_state: "self-reported",
          },
          {
            name: "Increased path-utilisation",
            description:
              "Tighter following moves enable +12% peak-hour freight paths.",
            direction: "benefit",
            magnitude: "medium",
            quantified_value: 7_100_000,
            evidence_state: "inferred",
          },
          {
            name: "Safety case + assurance overhead",
            description:
              "Initial 24 months of additional assurance load; declines after.",
            direction: "cost",
            magnitude: "medium",
            quantified_value: -3_500_000,
            evidence_state: "verified",
          },
          {
            name: "Carbon co-benefit",
            description: "Modal shift from road; modest at first.",
            direction: "benefit",
            magnitude: "low",
            evidence_state: "inferred",
          },
        ],
        npv_waterfall: [
          {
            label: "Driver + fuel saving",
            value: 24_000_000,
            type: "benefit",
            evidence_state: "verified",
          },
          {
            label: "Path-utilisation uplift",
            value: 7_100_000,
            type: "benefit",
            evidence_state: "inferred",
          },
          {
            label: "Signalling integration capex",
            value: -9_200_000,
            type: "cost",
            evidence_state: "self-reported",
          },
          {
            label: "Safety case overhead",
            value: -3_500_000,
            type: "cost",
            evidence_state: "verified",
          },
          {
            label: "NPV (3.5% STPR, 10y)",
            value: 18_400_000,
            type: "npv",
            evidence_state: "self-reported",
          },
        ],
        assumptions: [
          {
            name: "Signalling integration cost overrun",
            value: "15% above point estimate",
            sensitivity: "high",
            evidence_state: "self-reported",
            note: "Flips verdict to negative if overrun exceeds 35%.",
          },
          {
            name: "Path-utilisation uplift",
            value: "+12% peak-hour paths",
            sensitivity: "medium",
            evidence_state: "inferred",
          },
          {
            name: "Discount rate",
            value: "3.5% STPR (Green Book)",
            sensitivity: "low",
            evidence_state: "verified",
          },
        ],
        sensitivity_note:
          "Signalling integration cost is the single biggest swing factor. A 35%+ overrun flips NPV negative; everything else is recoverable.",
        corpus_citations: [
          {
            id: "rssb-freight-2025",
            title: "RSSB Freight Pathways 2030 — economic appraisal",
            organisation: "RSSB",
            score: 0.88,
          },
          {
            id: "nr-etcs-cost-2024",
            title: "Network Rail ETCS rollout — actual vs estimate",
            organisation: "Network Rail",
            score: 0.81,
          },
        ],
        skills_applied: ["green-book", "evidence-triage"],
      },
    },
  ],
});

const econScenario: DemoScenario = {
  id: "economic-case",
  label: "Economic case for autonomous freight",
  prompt: "Build a Five Case economic appraisal for autonomous freight in 2027",
  group: "decide",
  description: "EconomicCase block with NPV waterfall, Five Case scores.",
  model: econModel,
  lastRoute: "economic_analysis",
  messages: [
    msg(
      "user",
      "Build a Five Case economic appraisal for autonomous freight in 2027",
    ),
    msg(
      "assistant",
      "**Verdict: positive** — NPV £18.4m at 3.5% STPR over 10 years, BCR 2.1. Strategic, Economic, Financial cases all score above 0.7. **Commercial Case is the weakness** — it relies on a signalling-integration contract that hasn't been signed. The single biggest swing factor is signalling-integration cost overrun; >35% over and the NPV flips negative. Everything else is recoverable.",
      {
        reasoning: {
          content:
            "Applied Green Book skill (3.5% STPR, 10y appraisal). Pulled benefits + cost components from RSSB Freight Pathways 2030 + Network Rail ETCS actuals. Ran sensitivity against 3 scenarios (central, low, pessimistic). NPV positive in central + low; negative only in pessimistic.",
          duration: 4100,
        },
      },
    ),
  ],
};

// ===========================================================================
// 08 — Brief snapshot (multi-block composite)
// ===========================================================================

const briefModel = baseModel({
  artifact_id: "demo-brief",
  decision_spine: {
    recommendation:
      "Pursue autonomous freight with EV-to-grid partnership track in parallel",
    decision: "Strategy brief — CPC priority bids 2026-2027",
    summary:
      "Two parallel tracks: autonomous freight (economic case strong) and EV-to-grid partnership (8 candidates). Two critical gaps to close before bidding.",
    confidence_tier: "Supported",
    confidence_cap_reason: "Brief composes 4 supporting analyses.",
    score: 0.79,
  },
  blocks: [
    {
      id: "brief-rec",
      type: "RecommendationConfidence",
      visual: "decision_card",
      state: "core",
      headline: "Strategic recommendation",
      role: "focus",
      content: {
        decision:
          "Pursue autonomous freight; pursue EV-to-grid partnership in parallel",
        summary:
          "Two parallel tracks with distinct funder paths. Close critical gaps before bidding.",
        score: 0.79,
        confidence_tier: "Supported",
        confidence_cap_reason: "Brief composes 4 supporting analyses.",
      },
    },
    {
      id: "brief-evidence",
      type: "EvidenceStateSummary",
      visual: "evidence_state_bar",
      state: "core",
      headline: "Evidence backing this brief",
      role: "context",
      content: {
        counts: {
          verified: 32,
          "self-reported": 14,
          inferred: 11,
          unknown: 4,
          contested: 2,
        },
        total_claims: 63,
        cap_reason: "2 contested claims hold the tier at Supported.",
      },
    },
    {
      id: "brief-gaps",
      type: "DimensionGap",
      visual: "source_target_gap_rows",
      state: "core",
      headline: "Two critical gaps to close first",
      role: "context",
      content: [
        {
          id: "brief-gap-1",
          gap_type: "Capability",
          title: "Urban realtime telemetry partnerships",
          magnitude: "large",
          severity: "critical",
          description:
            "Smart-cities bid contingent on a real-time data partnership with a major UK city.",
          provenance: "stored",
          evidence_state: "verified",
          what_would_change:
            "Standing MOU with Manchester, Bristol, or Greater Cambridge.",
        },
        {
          id: "brief-gap-2",
          gap_type: "Capability",
          title: "EV-to-grid pilot infrastructure",
          magnitude: "large",
          severity: "critical",
          description:
            "No active V2G pilot under CPC oversight. 3 partners cite this as joint-bid precondition.",
          provenance: "derived",
          evidence_state: "self-reported",
          what_would_change:
            "Joint venture with a DNO to host a 50-vehicle pilot.",
        },
      ],
    },
    {
      id: "brief-action",
      type: "ActionPlan",
      visual: "gap_to_action_timeline",
      state: "core",
      headline: "Action plan — first 90 days",
      role: "reference",
      content: [
        {
          action: "Approach Octopus Energy on V2G partnership",
          linked_gap: "EV-to-grid pilot infrastructure",
          owner: "CPC Energy lead",
          sequence: 1,
        },
        {
          action: "Initiate signalling-integration scoping with Network Rail",
          linked_gap: "Commercial Case for autonomous freight",
          owner: "CPC Rail lead",
          sequence: 2,
        },
        {
          action: "Open MOU discussion with Greater Cambridge",
          linked_gap: "Urban realtime telemetry partnerships",
          owner: "CPC Cities lead",
          sequence: 3,
        },
        {
          action: "Commission outcomes-tracking pilot on 3 closed projects",
          linked_gap: "Outcomes tracking on closed projects",
          owner: "CPC Insights team",
          sequence: 4,
        },
      ],
    },
  ],
  snapshot: {
    title: "CPC priority bids 2026-2027 — strategy brief",
    included_blocks: ["brief-rec", "brief-evidence", "brief-gaps", "brief-action"],
    must_include: ["brief-rec", "brief-gaps"],
  },
});

const briefScenario: DemoScenario = {
  id: "brief",
  label: "Build me a brief",
  prompt: "Compose a strategy brief — priority bids 2026-2027",
  group: "decide",
  description: "Composite brief — recommendation + evidence + gaps + actions.",
  model: briefModel,
  lastRoute: "propose",
  messages: [
    msg("user", "Compose a strategy brief — priority bids 2026-2027"),
    msg(
      "assistant",
      "Composed a brief with 4 blocks: **recommendation**, **evidence coverage** (63 claims), **2 critical gaps** to close before bidding, and a **90-day action plan**. Two parallel tracks: autonomous freight (NPV positive) and EV-to-grid (8 partnership candidates). The brief is ready to export via the snapshot button — JSON download is enabled.",
      {
        reasoning: {
          content:
            "Composed from the autonomous freight Economic Case + the partnerships scoring + the gap analysis. Pulled the 2 critical-severity gaps; surfaced the 4 first-90-day actions that unblock them.",
          duration: 3400,
        },
      },
    ),
  ],
};

// ===========================================================================
// Scenario registry
// ===========================================================================

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  [topQuestionsScenario.id]: topQuestionsScenario,
  [swotScenario.id]: swotScenario,
  [gapsScenario.id]: gapsScenario,
  [partnersScenario.id]: partnersScenario,
  [railAiScenario.id]: railAiScenario,
  [transferScenario.id]: transferScenario,
  [econScenario.id]: econScenario,
  [briefScenario.id]: briefScenario,
};

export const DEMO_SCENARIO_ORDER: string[] = [
  topQuestionsScenario.id,
  swotScenario.id,
  gapsScenario.id,
  partnersScenario.id,
  railAiScenario.id,
  transferScenario.id,
  econScenario.id,
  briefScenario.id,
];

export const DEFAULT_DEMO_SCENARIO_ID = topQuestionsScenario.id;

export function getDemoScenario(id: string | null | undefined): DemoScenario {
  const normalised = id && DEMO_SCENARIOS[id] ? id : DEFAULT_DEMO_SCENARIO_ID;
  return DEMO_SCENARIOS[normalised];
}
