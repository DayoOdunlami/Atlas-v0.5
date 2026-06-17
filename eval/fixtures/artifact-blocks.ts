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

// Re-exported for typing convenience in tests
export type { DecisionSpine };

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
      claim_state: "stated",
    },
    {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d2",
      title: "Future of Freight: A Long Term Plan",
      organisation: "Department for Transport",
      score: 0.84,
      source_type: "knowledge_doc",
      publisher: "DfT",
      claim_state: "stated",
    },
    {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d3",
      title: "Autonomous Vehicle Regulation Sandbox — Phase 2 Outcomes",
      organisation: "Centre for Connected and Autonomous Vehicles",
      score: 0.78,
      source_type: "knowledge_doc",
      publisher: "CCAV",
      claim_state: "inferred",
      claim_rationale:
        "Regulatory readiness inferred from Phase 2 sandbox scope; no explicit corridor approval cited.",
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
      claim_state: "stated",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e2",
      title: "EV Charging Infrastructure Fund — Round 4",
      funder: "Office for Zero Emission Vehicles",
      score: 0.88,
      source_type: "live_call",
      deadline: "2026-07-31",
      claim_state: "stated",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e3",
      title: "Urban Mobility Electrification: Guidance Note 2025",
      publisher: "DfT",
      score: 0.82,
      source_type: "knowledge_doc",
      claim_state: "stated",
    },
    {
      id: "b2c3d4e5-f6a7-4b5c-9d0e-f2a3b4c5d6e4",
      title: "HIVE Case Study: Bristol EV Fleet Transition",
      score: 0.76,
      source_type: "hive_chunk",
      claim_state: "inferred",
      claim_rationale:
        "HIVE article covers fleet electrification broadly; Bristol-specific charging coverage inferred from scope.",
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
// FIXTURE 6 — orient
// Domain heatmap, terrain summary, CPC position, claim_state on citations
// ---------------------------------------------------------------------------

export const FIXTURE_ORIENT: ArtifactBlock = {
  type: "evidence",
  recipe: "orient",
  confidence_tier: "Supported",
  sections: {
    Headline:
      "The UK smart mobility landscape is moderately saturated in urban freight and " +
      "EV charging, with significant whitespace in rural connectivity and cross-modal integration. " +
      "CPC holds a strong position in urban freight but has limited footprint in emerging " +
      "rural and intermodal sectors.",
    Context:
      "Landscape scan across 6 domain areas using CPC corpus, live funding calls, and " +
      "HIVE knowledge base. 34 relevant corpus items retrieved; 4 active open calls identified.",
  },
  corpus_citations: [
    {
      id: "e1f2a3b4-c5d6-4e7f-8a9b-c1d2e3f4a5b1",
      title: "UK Smart Mobility Landscape Report 2025",
      publisher: "DfT",
      score: 0.91,
      source_type: "knowledge_doc",
      claim_state: "stated",
    },
    {
      id: "e1f2a3b4-c5d6-4e7f-8a9b-c1d2e3f4a5b2",
      title: "Connected Freight Innovation — Phase 4 Portfolio Review",
      organisation: "Connected Places Catapult",
      score: 0.87,
      source_type: "project",
      claim_state: "stated",
    },
    {
      id: "e1f2a3b4-c5d6-4e7f-8a9b-c1d2e3f4a5b3",
      title: "Rural Mobility Gap: Evidence Review 2024",
      publisher: "CCAV",
      score: 0.79,
      source_type: "knowledge_doc",
      claim_state: "stated",
    },
    {
      id: "e1f2a3b4-c5d6-4e7f-8a9b-c1d2e3f4a5b4",
      title: "Cross-Modal Integration: International Case Studies",
      score: 0.72,
      source_type: "hive_chunk",
      claim_state: "inferred",
      claim_rationale:
        "Cross-modal conclusions drawn from adjacent evidence; direct UK application inferred.",
    },
  ],
  // Domain heatmap data — 6 domains × evidence count
  orient_domains: [
    { domain: "Urban Freight", evidence_count: 14, cpc_projects: 8, open_calls: 2, maturity: "high" },
    { domain: "EV Charging", evidence_count: 11, cpc_projects: 6, open_calls: 3, maturity: "high" },
    { domain: "Active Travel", evidence_count: 7, cpc_projects: 3, open_calls: 1, maturity: "medium" },
    { domain: "Rural Connectivity", evidence_count: 4, cpc_projects: 1, open_calls: 0, maturity: "low" },
    { domain: "Cross-Modal", evidence_count: 3, cpc_projects: 1, open_calls: 1, maturity: "low" },
    { domain: "Air Quality", evidence_count: 5, cpc_projects: 2, open_calls: 0, maturity: "medium" },
  ],
  cpc_position: {
    lens: "CPC",
    strongest_domain: "Urban Freight",
    whitespace_domain: "Rural Connectivity",
    summary:
      "CPC has a documented position in Urban Freight (8 projects, 14 evidence items) " +
      "and EV Charging. Rural Connectivity and Cross-Modal are significant whitespace areas " +
      "with no funded CPC programme and only 1 project each.",
  },
} as unknown as ArtifactBlock;

export const FIXTURE_ORIENT_SPINE: DecisionSpine = {
  decision: "What does the smart mobility innovation landscape look like for CPC?",
  recommendation:
    "Urban Freight and EV Charging are well-covered — do not over-invest here. " +
    "Rural Connectivity and Cross-Modal represent the highest-opportunity whitespace " +
    "with minimal CPC footprint and 1 open call each.",
  confidence_tier: "Supported",
  key_assumption:
    "Landscape data reflects CPC corpus as of Q1 2026; new DfT programmes may shift the picture.",
  next_action: "Find opportunities in Rural Connectivity or Cross-Modal — run CONNECT.",
  framework: "Evidence Gap & Value Translation",
};

// ---------------------------------------------------------------------------
// FIXTURE 7 — connect
// Opportunity cards, fit bands, sector bridge, claim_state
// ---------------------------------------------------------------------------

export const FIXTURE_CONNECT: ArtifactBlock = {
  type: "evidence",
  recipe: "connect",
  confidence_tier: "Indicative",
  sections: {
    Headline:
      "4 opportunity routes worth exploring. UKRI Smart Mobility and DfT Rural " +
      "Mobility Fund show strong fit against CPC's evidence base. Two routes require " +
      "evidence enrichment before bidding.",
  },
  corpus_citations: [
    {
      id: "f2a3b4c5-d6e7-4f8a-9b0c-d2e3f4a5b6c1",
      title: "UKRI Smart Mobility Challenge — Open Call 2026",
      funder: "UKRI",
      score: 0.91,
      source_type: "live_call",
      deadline: "2026-09-30",
      claim_state: "stated",
    },
    {
      id: "f2a3b4c5-d6e7-4f8a-9b0c-d2e3f4a5b6c2",
      title: "DfT Rural Mobility Innovation Fund — Round 2",
      funder: "Department for Transport",
      score: 0.84,
      source_type: "live_call",
      deadline: "2026-10-31",
      claim_state: "stated",
    },
    {
      id: "f2a3b4c5-d6e7-4f8a-9b0c-d2e3f4a5b6c3",
      title: "Horizon Europe Cross-Border Freight Corridor Programme",
      funder: "European Commission",
      score: 0.71,
      source_type: "live_call",
      claim_state: "inferred",
      claim_rationale:
        "UK participation status in this Horizon call not confirmed; eligibility inferred from association agreement scope.",
    },
  ],
  // Opportunity cards
  connect_opportunities: [
    {
      id: "op1",
      title: "UKRI Smart Mobility Challenge",
      funder: "UKRI",
      fit_reason:
        "Directly aligned with CPC's Future Mobility portfolio — 4 verified L2/L3 claims applicable.",
      fit_band: "Strong",
      entry_friction_tags: ["consortium_required", "commercial_deployment_evidence"],
      deadline: "2026-09-30",
      value_gbm: 22,
      claim_state: "stated",
    },
    {
      id: "op2",
      title: "DfT Rural Mobility Innovation Fund",
      funder: "DfT",
      fit_reason:
        "Addresses CPC's Rural Connectivity whitespace; requires L2 programme evidence to be generated first.",
      fit_band: "Moderate",
      entry_friction_tags: ["evidence_gap", "rural_delivery_track_record"],
      deadline: "2026-10-31",
      value_gbm: 15,
      claim_state: "inferred",
      claim_rationale:
        "Fit assessed from call specification against CPC evidence base; no prior application data.",
    },
    {
      id: "op3",
      title: "Innovate UK Connected Places — Round 6",
      funder: "Innovate UK",
      fit_reason:
        "Strong overlap with Digital Infrastructure and Active Travel portfolios.",
      fit_band: "Strong",
      entry_friction_tags: ["industry_match_30pct"],
      deadline: "2026-11-15",
      value_gbm: 18,
      claim_state: "stated",
    },
    {
      id: "op4",
      title: "Horizon Europe Cross-Border Freight Corridor",
      funder: "European Commission",
      fit_reason:
        "Freight corridor expertise applicable; UK eligibility under association agreement uncertain.",
      fit_band: "Weak",
      entry_friction_tags: ["eligibility_uncertain", "international_consortium"],
      deadline: null,
      value_gbm: 35,
      claim_state: "contested",
      claim_rationale:
        "Two sources conflict: EC association agreement implies eligibility; DfT guidance suggests project-by-project approval required.",
    },
  ],
  // Cross-modal sector bridge
  connect_bridge: {
    source_sector: "Urban Freight",
    target_sector: "Rural Connectivity",
    bridge_score: 67,
    why_connected:
      "Last-mile logistics innovation from CPC's urban freight portfolio is directly transferable " +
      "to rural first/last-mile delivery challenges. Three urban operators (GNEWT, Zedify, DPD) " +
      "have active rural expansion programmes.",
    evidence_ids: ["f2a3b4c5-d6e7-4f8a-9b0c-d2e3f4a5b6c1", "f2a3b4c5-d6e7-4f8a-9b0c-d2e3f4a5b6c2"],
  },
} as unknown as ArtifactBlock;

export const FIXTURE_CONNECT_SPINE: DecisionSpine = {
  decision:
    "Which opportunity routes should CPC prioritise for the 2026 funding cycle?",
  recommendation:
    "Pursue UKRI Smart Mobility (bid-ready) and Innovate UK Connected Places Round 6 now. " +
    "Generate Rural Connectivity L2 evidence before attempting DfT Rural Mobility Fund. " +
    "Monitor Horizon Europe — do not invest in preparation until eligibility is confirmed.",
  confidence_tier: "Indicative",
  key_assumption:
    "An industry prime with commercial deployment evidence joins UKRI consortium.",
  next_action:
    "Approach 2 logistics operators this week for UKRI. Commission Rural Connectivity outcome study.",
  framework: "Evidence Gap & Value Translation",
  strongest_objection: "CPC has no verified Rural Connectivity L2 claims — DfT call may be unwinnable without them.",
  would_change_if: "Rural Connectivity outcome study delivers 2+ L2 claims within 8 weeks.",
};

// ---------------------------------------------------------------------------
// FIXTURE 8 — defend (Speculative tier — tests low visual weight)
// Evidence tree, objections, assumptions
// ---------------------------------------------------------------------------

export const FIXTURE_DEFEND: ArtifactBlock = {
  type: "evidence",
  recipe: "defend",
  confidence_tier: "Speculative",
  sections: {
    Headline:
      "Evidence base is Speculative. The investment case rests on two assumptions " +
      "that cannot be verified from the current corpus. Proceed with high caution.",
  },
  corpus_citations: [
    {
      id: "a3b4c5d6-e7f8-4a9b-0c1d-e3f4a5b6c7d1",
      title: "Autonomous HGV Trials — Early Feasibility Study 2022",
      publisher: "DfT",
      score: 0.62,
      source_type: "knowledge_doc",
      claim_state: "stated",
    },
    {
      id: "a3b4c5d6-e7f8-4a9b-0c1d-e3f4a5b6c7d2",
      title: "Insurance Market Readiness for AV Freight — Preliminary Assessment",
      score: 0.54,
      source_type: "hive_article",
      claim_state: "contested",
      claim_rationale:
        "Two insurance market reports disagree: Tokio Marine report (2023) says market is ready; Lloyd's Market Association review (2024) says structural barriers remain.",
    },
    {
      id: "a3b4c5d6-e7f8-4a9b-0c1d-e3f4a5b6c7d3",
      title: "Operator Demand Survey: Autonomous Freight UK 2023",
      organisation: "Logistics UK",
      score: 0.48,
      source_type: "knowledge_doc",
      claim_state: "inferred",
      claim_rationale:
        "Survey covers freight operators broadly; demand specifically for autonomous corridor trials inferred from willingness-to-trial responses.",
    },
  ],
  // Evidence tree items
  defend_evidence: [
    {
      id: "ev1",
      claim: "UK regulatory framework supports Level 4 autonomy on public roads by 2028.",
      claim_state: "unknown",
      source: "No confirmed regulatory timeline found in corpus.",
      rationale: "AV Act 2024 provides a legal framework but DfT has not published an implementation roadmap.",
    },
    {
      id: "ev2",
      claim: "Insurance underwriting is available for commercial AV HGV operations.",
      claim_state: "contested",
      source: "Tokio Marine (2023) vs Lloyd's Market Association (2024)",
      rationale: "Tokio Marine willing to underwrite at standard rates; Lloyd's Market Association identifies structural gaps. Neither position is confirmed.",
    },
    {
      id: "ev3",
      claim: "Three operators have expressed commitment to trial participation.",
      claim_state: "inferred",
      source: "CPC stakeholder engagement log Q4 2025",
      rationale: "Letters of intent held by CPC programme team; not yet converted to contractual commitments.",
    },
  ],
  // Objection cards
  defend_objections: [
    {
      id: "obj1",
      objection: "No confirmed regulatory timeline means the programme cannot set a viable delivery date.",
      response:
        "The AV Act 2024 provides the legal basis. DfT is expected to publish implementation guidance by Q4 2026. " +
        "A conditional programme can be scoped with a regulatory gate before deployment commitment.",
      what_would_change:
        "DfT publishes Level 4 autonomy implementation roadmap with confirmed 2027 effective date.",
    },
    {
      id: "obj2",
      objection: "Insurance market is not ready — programme cannot proceed without underwriting certainty.",
      response:
        "Tokio Marine has confirmed in-principle willingness. A pilot programme can be structured within existing HGV " +
        "insurance frameworks while the broader market develops.",
      what_would_change:
        "A second major insurer confirms underwriting capacity, or Lloyd's Market Association publishes updated guidance.",
    },
    {
      id: "obj3",
      objection:
        "Operator commitments are letters of intent only — commercial risk remains unacceptably high.",
      response:
        "Letters of intent are standard at programme feasibility stage. Contractual commitments are scoped for post-sandbox approval.",
      what_would_change:
        "One operator converts letter of intent to a signed collaboration agreement before feasibility phase begins.",
    },
  ],
  // Assumption list
  defend_assumptions: [
    {
      id: "as1",
      text: "DfT regulatory sandbox approval within 90 days of application.",
      confidence_tier: "Speculative",
      basis: "No precedent for sandbox approval timeline found in corpus.",
    },
    {
      id: "as2",
      text: "Three operator commitments hold through pilot phase.",
      confidence_tier: "Indicative",
      basis: "Letters of intent received Q4 2025; operators have confirmed budget allocation for 2026.",
    },
    {
      id: "as3",
      text: "Insurance market provides a second underwriter by 2027.",
      confidence_tier: "Speculative",
      basis: "Lloyd's Market Association assessment is negative; no second underwriter has confirmed.",
    },
    {
      id: "as4",
      text: "Public acceptance does not require additional primary legislation.",
      confidence_tier: "Indicative",
      basis: "AV Act 2024 includes public safety provisions; legal opinion supports current framework.",
    },
  ],
} as unknown as ArtifactBlock;

export const FIXTURE_DEFEND_SPINE: DecisionSpine = {
  decision:
    "Is the evidence base sufficient to defend an investment case for autonomous freight corridors?",
  recommendation:
    "No. Two critical assumptions are Speculative — regulatory timeline and insurance market readiness. " +
    "Do not present to investment committee until at least one assumption is upgraded to Indicative.",
  confidence_tier: "Speculative",
  key_assumption:
    "DfT publishes Level 4 autonomy implementation roadmap before programme commitment.",
  next_action:
    "Set a 3-month evidence watch: DfT roadmap + Lloyd's update. Review at Q3 2026.",
  framework: "Green Book",
  strongest_objection:
    "Regulatory timeline is unknown — no credible delivery date can be stated.",
  would_change_if:
    "DfT Level 4 roadmap published with confirmed 2027 effective date.",
};

// ---------------------------------------------------------------------------
// Sprint 5 — object-layer visual blocks (lab / tier1)
// ---------------------------------------------------------------------------

export const FIXTURE_STAKEHOLDER_MAP_BLOCK = {
  type: "stakeholder_map",
  title: "A14 autonomous freight — stakeholder network",
  data: {
    nodes: [
      { id: "cpc", label: "Connected Places Catapult", role: "Programme lead", influence: "high" },
      { id: "dft", label: "DfT CCAV", role: "Regulator", influence: "high" },
      { id: "nh", label: "National Highways", role: "Infrastructure", influence: "medium" },
      { id: "fleet", label: "Fleet operators", role: "Trial participants", influence: "medium" },
    ],
    edges: [
      { source: "dft", target: "cpc", relationship: "funds" },
      { source: "cpc", target: "fleet", relationship: "commissions" },
      { source: "nh", target: "cpc", relationship: "permits corridor" },
    ],
  },
};

export const FIXTURE_EVIDENCE_AWARE_SWOT_BLOCK = {
  type: "evidence_aware_swot",
  title: "CPC strategic position — evidence-aware SWOT",
  data: {
    strengths: [
      { text: "National connected-mobility convening role", claim_state: "stated" as const },
    ],
    weaknesses: [
      { text: "Thin open-road HGV trial precedent in corpus", claim_state: "stated" as const },
    ],
    opportunities: [
      { text: "A14 regulatory sandbox alignment", claim_state: "inferred" as const },
    ],
    threats: [
      { text: "Workforce automation narrative risk", claim_state: "contested" as const },
    ],
  },
};

// ---------------------------------------------------------------------------
// Organisation profile (Sprint 5 — fixture-only)
// ---------------------------------------------------------------------------

export const FIXTURE_ORGANISATION_PROFILE: ArtifactBlock = {
  type: "brief",
  recipe: "organisation_profile",
  confidence_tier: "Indicative",
  headline: "Connected Places Catapult — organisation profile",
  insight_card:
    "CPC operates as the UK's national convenor for connected-mobility innovation, " +
    "with strongest corpus density in freight automation and urban mobility programmes.",
  sections: {
    Profile:
      "Connected Places Catapult (CPC) is a UK innovation agency focused on connected places, " +
      "transport, and built-environment innovation. This fixture profile is synthetic for lab validation.",
    Capabilities:
      "Programme delivery, evidence synthesis, stakeholder convening, and trial design support " +
      "across rail, highways, and urban mobility.",
    Partnerships:
      "DfT CCAV, Innovate UK, National Highways, and operator consortia feature in recent corpus-linked work.",
  },
  visual_blocks: [
    FIXTURE_STAKEHOLDER_MAP_BLOCK,
    FIXTURE_EVIDENCE_AWARE_SWOT_BLOCK,
  ],
  corpus_citations: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      title: "Freight Innovation Fund — Round 2",
      organisation: "Innovate UK",
      score: 0.82,
      claim_state: "stated",
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      title: "MOVE-UK Programme",
      organisation: "DfT CCAV",
      score: 0.76,
      claim_state: "stated",
    },
  ],
} as unknown as ArtifactBlock;

// ---------------------------------------------------------------------------
// Named map — used by fixture API route
// ---------------------------------------------------------------------------

export const FIXTURE_MAP = {
  brief_five_case: FIXTURE_BRIEF_FIVE_CASE,
  evidence_panel: FIXTURE_EVIDENCE_PANEL,
  stats_dashboard: FIXTURE_STATS_DASHBOARD,
  scenario_stress_test: FIXTURE_SCENARIO_STRESS_TEST,
  legacy_brief: FIXTURE_LEGACY_BRIEF,
  orient: FIXTURE_ORIENT,
  connect: FIXTURE_CONNECT,
  defend: FIXTURE_DEFEND,
  organisation_profile: FIXTURE_ORGANISATION_PROFILE,
} as const;

export type FixtureName = keyof typeof FIXTURE_MAP;
