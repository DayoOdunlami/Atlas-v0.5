/**
 * Atlas 5 — Shared artefact fixture data (Tier 1 + Tier 2 + future Tier 3)
 *
 * These fixtures are used by:
 *   1. /api/atlas5/fixture  — Tier 1 fixture injection endpoint (dev-only)
 *   2. eval/playwright/recipe-smoke.spec.ts — Playwright smoke tests
 *   3. eval/tier1.test.ts   — Vitest source-code / contract checks
 *   4. (future) Tier 3 agent eval golden-set comparisons
 *
 * IMPORTANT:
 * - UUIDs are SYNTHETIC — they are NOT verified against Supabase.
 *   Real agent responses must contain UUIDs that exist in atlas.projects /
 *   hive.articles. These fixtures are for render/contract validation only.
 * - Do NOT import server-only modules here — this file is used in both
 *   server (Next.js API route) and test runner (Playwright/Vitest) contexts.
 *
 * Security: no service-role keys, no auth secrets.
 */

import type { ArtifactBlock } from "../../src/lib/atlas5/artifact-store";
import type {
  AtlasRoutingGap,
  DecisionSpine,
} from "../../src/lib/atlas5/types";

// ---------------------------------------------------------------------------
// Shared Decision Spine — can be attached to any recipe
// ---------------------------------------------------------------------------

export const FIXTURE_DECISION_SPINE: DecisionSpine = {
  decision: "Proceed with Phase 1 autonomous freight pilot on A14 corridor",
  recommendation:
    "Commission a 6-month pilot with 3 operators covering the 200 km A14 stretch, " +
    "targeting 15% emission reduction and £2.4m logistics cost savings.",
  confidence_tier: "Indicative",
  key_assumption:
    "DfT regulatory sandbox approval granted within 90 days of application.",
  next_action: "Submit sandbox application to DfT by end of Q2 2026.",
  framework: "HM Treasury Green Book",
  strongest_objection:
    "Trade union resistance to automation-driven freight job displacement.",
  would_change_if:
    "Cost-benefit ratio drops below 1.5:1 under revised optimism bias scenario.",
};

// ---------------------------------------------------------------------------
// Routing gaps — representative gaps for the A14 brief fixture
// These use the lane/provider/tool shape (NOT CICERONE's HAVE/PARTIAL/MISSING).
// Note: DfT docs are on GOV.UK but provider is DfT; tool is govuk_search.
//       Exa is the tool for market_discovery; provider is the real publisher
//       when known, or "Exa" when no specific publisher can be identified.
// ---------------------------------------------------------------------------

export const FIXTURE_ROUTING_GAPS: AtlasRoutingGap[] = [
  {
    type: "corpus_gap",
    topic:
      "Direct project precedent for open-road autonomous HGV corridor trials",
    severity: "high",
    reason:
      "Corpus returned adjacent freight/AV projects but no open-road platooning " +
      "trial with similarity >= 0.70. Relevant IUK/CCAV programme records not ingested.",
    recommended_action:
      "Search Innovate UK CAM and Freight Innovation Fund programme records; " +
      "mark relevant sources for corpus ingestion.",
    recommended_source_lane: "funding",
    recommended_provider: "InnovateUK",
    available_tool: "live_calls",
    can_lift_confidence: true,
    citation_status: "candidate",
  },
  {
    type: "corpus_gap",
    topic: "DfT Future of Freight strategy and A14 corridor policy alignment",
    severity: "medium",
    reason:
      "Policy evidence below ADJACENT threshold (0.55). DfT strategy documents " +
      "and CCAV CAM 2025 guidance exist on GOV.UK but are not fully ingested.",
    recommended_action:
      "Review DfT Future of Freight plan and CCAV CAM 2025 guidance via GOV.UK search.",
    recommended_source_lane: "official_policy",
    // DfT is the source identity — govuk_search is the access route
    recommended_provider: "DfT",
    available_tool: "govuk_search",
    can_lift_confidence: true,
    citation_status: "background",
  },
  {
    type: "landscape_gap",
    topic:
      "Operator demand and willingness to pay for autonomous freight corridor services",
    severity: "high",
    reason:
      "No operator demand survey or WTP data found in corpus. CPC and IUK corpus " +
      "does not cover commercial demand studies for AV freight corridors.",
    recommended_action:
      "Use Exa to locate recent operator demand evidence, then commission " +
      "primary survey to close this gap.",
    recommended_source_lane: "market_discovery",
    // No specific government publisher — Exa is the tool AND best available provider
    recommended_provider: "Exa",
    available_tool: "exa_search",
    can_lift_confidence: true,
    citation_status: "candidate",
  },
];

// ---------------------------------------------------------------------------
// FIXTURE 1 — brief_five_case
// ---------------------------------------------------------------------------

export const FIXTURE_BRIEF_FIVE_CASE: ArtifactBlock = {
  type: "brief",
  recipe: "brief_five_case",
  confidence_tier: "Indicative",
  sections: {
    "Strategic Case":
      "Autonomous freight corridors align directly with CPC's Connected Infrastructure " +
      "priority and the DfT Future of Freight plan. The A14 pilot addresses a £1.2bn " +
      "annual logistics inefficiency in the East Midlands supply chain. Three previous " +
      "CPC projects (Freight Innovation Fund rounds 1–3) demonstrate stakeholder readiness.",
    "Economic Case":
      "At a 3.5% STPR, the programme generates a positive NPV across all three modelled " +
      "scenarios. Central case: +£46.8m NPV over 10 years. Sensitivity analysis shows " +
      "break-even at a 34% reduction in projected benefits before NPV turns negative. " +
      "Optimism bias of 15% applied per Green Book supplementary guidance for novel technology.",
    "Commercial Case":
      "Three lead operators (Freightliner, Eddie Stobart, XPO Logistics) have signed " +
      "letters of intent. Vehicle OEMs (Einride, Scania) committed to provide trial " +
      "hardware at cost price. Insurance underwriting agreed with Tokio Marine at " +
      "standard HGV rates subject to sandbox approval.",
    "Financial Case":
      "Total programme cost: £42m over 3 years. Funding profile: £28m DfT Future of " +
      "Freight grant, £9m operator co-investment, £5m CPC programme management. " +
      "Contingency: 12% of total (Green Book standard for novel technology).",
    "Management Case":
      "Delivery led by CPC programme management office. Key milestones: sandbox " +
      "approval Q2 2026, vehicle deployment Q4 2026, interim evaluation Q2 2027, " +
      "final report Q4 2027. Governance: CPC Board quarterly review with DfT observer.",
  },
  npv_value: 46_800_000,
  discount_rate: 3.5,
  optimism_bias: 0.15,
  corpus_citations: [
    {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d1",
      title:
        "Freight Innovation Fund Round 3 — Autonomous Corridors Evaluation",
      organisation: "Connected Places Catapult",
      score: 0.91,
      source_type: "project",
    },
    {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d2",
      title: "Future of Freight: A Long Term Plan",
      organisation: "Department for Transport",
      score: 0.84,
      source_type: "knowledge_doc",
      publisher: "DfT",
    },
    {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d3",
      title: "Autonomous Vehicle Regulation Sandbox — Phase 2 Outcomes",
      organisation: "Centre for Connected and Autonomous Vehicles",
      score: 0.78,
      source_type: "knowledge_doc",
      publisher: "CCAV",
    },
  ],
  // ATLAS routing gaps — lane/provider/tool shape
  routing_gaps: FIXTURE_ROUTING_GAPS,
};

// ---------------------------------------------------------------------------
// FIXTURE 2 — evidence_panel
// ---------------------------------------------------------------------------

export const FIXTURE_EVIDENCE_PANEL: ArtifactBlock = {
  type: "evidence",
  recipe: "evidence_panel",
  confidence_tier: "Supported",
  sections: {
    Context:
      "Evidence landscape for urban electric vehicle charging infrastructure, " +
      "covering R&D projects, open funding calls, and policy knowledge in the CPC corpus.",
  },
  corpus_citations: [
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e1",
      title: "Zero Emission Freight Demonstrator — Phase 2",
      organisation: "InnovateUK",
      score: 0.93,
      source_type: "project",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e2",
      title: "EV Charging Infrastructure Fund — Round 4",
      funder: "Office for Zero Emission Vehicles",
      score: 0.88,
      source_type: "live_call",
      deadline: "2026-07-31",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e3",
      title: "Urban Mobility Electrification: Guidance Note 2025",
      publisher: "DfT",
      score: 0.82,
      source_type: "knowledge_doc",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e4",
      title: "HIVE Case Study: Bristol EV Fleet Transition",
      score: 0.76,
      source_type: "hive_chunk",
    },
  ],
};

// ---------------------------------------------------------------------------
// FIXTURE 3 — stats_dashboard (with inline chart_specs)
// ---------------------------------------------------------------------------

export const FIXTURE_STATS_DASHBOARD: ArtifactBlock = {
  type: "chart",
  recipe: "stats_dashboard",
  confidence_tier: "Indicative",
  npv_value: 127_000_000,
  discount_rate: 3.5,
  sections: {
    Analysis:
      "3D printing adoption across CPC's smart manufacturing portfolio shows " +
      "compound annual growth of 23% (2021–2025). Investment concentration in " +
      "aerospace and medical device sectors. 14 active projects, £42m total programme " +
      "value, 3 projects exited to scale-up within 24 months.",
    "Methodology Note":
      "Investment by type sourced from atlas.projects filtered by technology_area = " +
      "'additive_manufacturing'. NPV calculated at 3.5% STPR over 10-year horizon.",
  },
  chart_specs: [
    {
      type: "bar",
      title: "Investment by Technology Area (£m)",
      x: "area",
      y: "investment_m",
      data: [
        { area: "Aerospace", investment_m: 12.4 },
        { area: "Medical", investment_m: 9.1 },
        { area: "Automotive", investment_m: 7.8 },
        { area: "Construction", investment_m: 5.2 },
        { area: "Consumer", investment_m: 3.6 },
      ],
    },
    {
      type: "line",
      title: "Project Count Over Time",
      x: "year",
      y: "projects",
      data: [
        { year: "2021", projects: 4 },
        { year: "2022", projects: 7 },
        { year: "2023", projects: 10 },
        { year: "2024", projects: 13 },
        { year: "2025", projects: 14 },
      ],
    },
  ],
  corpus_citations: [
    {
      id: "c3d4e5f6-a7b8-4c5d-8e1f-a3b4c5d6e7f1",
      title: "Smart Manufacturing Portfolio Review 2025",
      organisation: "Connected Places Catapult",
      score: 0.89,
      source_type: "project",
    },
  ],
};

// ---------------------------------------------------------------------------
// FIXTURE 4 — scenario_stress_test
// ---------------------------------------------------------------------------

export const FIXTURE_SCENARIO_STRESS_TEST: ArtifactBlock = {
  type: "scenario",
  recipe: "scenario_stress_test",
  confidence_tier: "Indicative",
  sections: {
    Hypothesis:
      "Autonomous freight corridors will achieve commercial viability on UK motorways " +
      "by 2030, enabling CPC to position a £50m portfolio of enabling infrastructure projects.",
    "Supporting Evidence":
      "• UK AV Act 2024 provides legal framework for self-driving vehicles at motorway speeds\n" +
      "• Einride Vera operating commercially in Sweden at 90% of HGV speed limits since 2023\n" +
      "• DfT Freight Innovation Fund Round 3 results show 78% of operators willing to trial AV",
    "Challenging Evidence":
      "• Insurance market remains immature — Tokio Marine is only willing underwriter at scale\n" +
      "• DVSA enforcement guidance not expected until late 2027 at earliest\n" +
      "• Trade union opposition (Unite, GMB) has delayed two planned pilots indefinitely",
    "Key Assumptions":
      "• Regulatory sandbox approval within 90 days [FRAGILE]\n" +
      "• Three operator commitments hold through pilot phase [HELD]\n" +
      "• Insurance market deepens with second underwriter by 2027 [UNVERIFIED]\n" +
      "• Public acceptance does not require additional legislation [HELD]",
    Verdict:
      "Hypothesis is plausible but time-bound risk is high. Recommend proceeding with " +
      "a conditional 6-month feasibility phase gated on regulatory clarity by Q3 2026.",
  },
  corpus_citations: [
    {
      id: "d4e5f6a7-b8c9-4d5e-8f2a-b4c5d6e7f8a1",
      title: "Automated Vehicles Act 2024 — Implementation Guidance",
      publisher: "DfT",
      score: 0.86,
      source_type: "knowledge_doc",
    },
    {
      id: "d4e5f6a7-b8c9-4d5e-8f2a-b4c5d6e7f8a2",
      title: "Einride Commercial Operations Report — Gothenburg Corridor 2023",
      score: 0.71,
      source_type: "hive_article",
    },
  ],
};

// ---------------------------------------------------------------------------
// FIXTURE 5 — legacy_brief (lowercase keys, no recipe — triggers BriefView fallback)
// ---------------------------------------------------------------------------

export const FIXTURE_LEGACY_BRIEF: ArtifactBlock = {
  type: "brief",
  // NOTE: no recipe field — detectRecipe() will return null → legacy BriefView
  confidence_tier: "Speculative",
  sections: {
    strategic:
      "Legacy ATLAS output using lowercase section keys from pre-recipe agent versions.",
    economic: "NPV analysis pending. Discount rate: 3.5% STPR.",
    commercial: "Operator engagement at early stage.",
    financial: "Budget envelope TBC.",
    management: "Programme governance to be confirmed.",
  },
  npv_value: null,
  discount_rate: 3.5,
  corpus_citations: [],
};

// ---------------------------------------------------------------------------
// Named map — used by fixture API route
// ---------------------------------------------------------------------------

export const FIXTURE_MAP = {
  brief_five_case: FIXTURE_BRIEF_FIVE_CASE,
  evidence_panel: FIXTURE_EVIDENCE_PANEL,
  stats_dashboard: FIXTURE_STATS_DASHBOARD,
  scenario_stress_test: FIXTURE_SCENARIO_STRESS_TEST,
  legacy_brief: FIXTURE_LEGACY_BRIEF,
} as const;

export type FixtureName = keyof typeof FIXTURE_MAP;
