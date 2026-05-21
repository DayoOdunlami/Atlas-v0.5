/**
 * Rich mock states for visual recipe validation.
 * Usage: import { MOCK_BRIEF, MOCK_EVIDENCE, MOCK_STATS, MOCK_SCENARIO } from "@/lib/test-states";
 * Swap into initialState in types.ts to test each recipe in isolation.
 * NOT imported in production code.
 */
import { AgentState } from "@/lib/types";

export const MOCK_BRIEF: Partial<AgentState> = {
  artifact_block: {
    type: "brief",
    confidence_tier: "Supported",
    sections: {
      "Strategic Case":
        "Autonomous freight corridors represent a significant strategic opportunity for CPC. Three comparable R&D programmes in the corpus (TRL 4–6) demonstrate strong alignment with UKRI freight decarbonisation priorities. The Green Book strategic case is strengthened by DfT's Freight Carbon Review 2023 target of 20% modal shift by 2035.",
      "Economic Case":
        "Indicative BCR of 2.4:1 based on corpus analogues from the connected logistics programme (2021-23). Key economic benefits: journey-time savings (£34m NPV), reduced road maintenance costs (£12m NPV), CO₂ abatement at £85/tonne consistent with BEIS carbon values. Sensitivity: BCR drops to 1.6:1 under pessimistic demand scenario.",
      "Commercial Case":
        "Open funding calls identified from Innovate UK and UKRI Smart Mobility Challenge (total available: £18m). Commercial structure precedent: consortium-led with CPC as convenor, industry matched at 30-50%. Two active operators (identified from corpus live_calls) have expressed intent to participate.",
      "Financial Case":
        "Recommended programme cost: £8-12m over 36 months. Funding mix: Innovate UK (50%), industry match (30%), CPC programme budget (20%). Year 1 commitments achievable within existing CPC budget envelope. Phased milestones reduce financial exposure at TRL 5 gate.",
      "Management Case":
        "Delivery model: programme management via CPC Innovation team with external technical advisory board. Precedent: Connected Places Catapult Smart Mobility Programme (2020-22) delivered to time and budget. Key risk: technology readiness — mitigated by phased gate reviews at TRL 5 and TRL 7.",
    },
    corpus_citations: [
      { id: "aaa00001-0000-0000-0000-000000000001", title: "Connected and Autonomous Vehicle R&D — Phase 3", organisation: "Connected Places Catapult", score: 0.91, source_type: "project" },
      { id: "bbb00002-0000-0000-0000-000000000002", title: "UKRI Smart Mobility Challenge — Open Call 2024", funder: "UKRI", score: 0.85, source_type: "live_call" },
      { id: "ccc00003-0000-0000-0000-000000000003", title: "Freight Decarbonisation Policy Evidence Base", publisher: "DfT", score: 0.78, source_type: "knowledge_doc" },
    ],
    npv_value: 46_000_000,
    discount_rate: 3.5,
  },
  decision_spine: {
    decision: "Should CPC commission a Phase 1 autonomous freight corridor programme?",
    recommendation: "Proceed to scoping. Evidence base is sufficient for an Indicative investment case. Recommend 6-week discovery with 3 anchor industry partners before committing programme budget.",
    confidence_tier: "Supported",
    key_assumption: "DfT freight decarbonisation targets remain in place through 2030.",
    next_action: "Convene industry workshop — identify 3 anchor operators for scoping phase.",
    framework: "Green Book / Five Case Model",
    strongest_objection: "Technology readiness remains at TRL 4-5; commercial deployment unlikely before 2031.",
    would_change_if: "Evidence of successful corridor pilots in comparable European geographies.",
  },
};

export const MOCK_EVIDENCE: Partial<AgentState> = {
  artifact_block: {
    type: "evidence",
    confidence_tier: "Robust",
    sections: {
      "Query": "What evidence does the CPC corpus have on active travel and urban mobility innovation?",
    },
    corpus_citations: [
      { id: "aaa00001-0000-0000-0000-000000000001", title: "Active Travel England — Innovation Programme Phase 2", organisation: "Active Travel England", score: 0.93, source_type: "project" },
      { id: "bbb00002-0000-0000-0000-000000000002", title: "Urban Cycling Infrastructure Fund — Round 3", funder: "Active Travel England", deadline: "2024-09-30", score: 0.88, source_type: "live_call" },
      { id: "ccc00003-0000-0000-0000-000000000003", title: "E-bike Adoption: Evidence Review 2023", publisher: "Transport Research Laboratory", score: 0.84, source_type: "knowledge_doc" },
      { id: "ddd00004-0000-0000-0000-000000000004", title: "Micro-mobility Pilots: Shared Scooter Schemes", organisation: "Bristol City Council", score: 0.81, source_type: "project" },
      { id: "eee00005-0000-0000-0000-000000000005", title: "Walking Infrastructure: 15-Minute City Case Studies", article_id: "fff00006-0000-0000-0000-000000000006", score: 0.76, source_type: "hive_chunk" },
      { id: "fff00006-0000-0000-0000-000000000006", title: "Pop-up Cycling Infrastructure — COVID Response Review", publisher: "UCL Transport Institute", score: 0.74, source_type: "knowledge_doc" },
    ],
  },
  decision_spine: {
    decision: "Active travel evidence base depth in CPC corpus",
    recommendation: "Strong evidence base exists across 3 source types. 6 verified citations with top similarity 0.93. Sufficient for Robust assessment.",
    confidence_tier: "Robust",
    key_assumption: "Active travel policy landscape remains stable.",
    next_action: "Filter by modes='walking,cycling' for more targeted brief.",
  },
};

export const MOCK_STATS: Partial<AgentState> = {
  artifact_block: {
    type: "chart",
    recipe: "stats_dashboard",
    confidence_tier: "Supported",
    sections: {
      "Summary": "CPC has funded 48 EV charging infrastructure projects since 2019, with an aggregate investment of £127m. Corpus analysis shows strong concentration in urban areas (73%) with underserved rural coverage (8%).",
      "Methodology": "Analysis drawn from atlas.projects (n=48 filtered by EV/charging themes), atlas.live_calls open opportunities, and atlas.knowledge_chunks policy evidence base.",
    },
    corpus_citations: [
      { id: "aaa00001-0000-0000-0000-000000000001", title: "EV Charging Infrastructure — Rural Pilots", organisation: "Office for Zero Emission Vehicles", score: 0.89, source_type: "project" },
      { id: "bbb00002-0000-0000-0000-000000000002", title: "LEVI Fund — Rapid Deployment Round 4", funder: "OZEV", score: 0.82, source_type: "live_call" },
    ],
    npv_value: 127_000_000,
    // Charts belong to THIS artefact — they travel with the investment brief.
    // AgentState.charts is for temporary workspace/exploratory charts only.
    chart_specs: [
      {
        type: "bar",
        title: "CPC EV Investment by Year",
        x: "year",
        y: "investment_m",
        data: [
          { year: "2019", investment_m: 12 },
          { year: "2020", investment_m: 18 },
          { year: "2021", investment_m: 24 },
          { year: "2022", investment_m: 31 },
          { year: "2023", investment_m: 42 },
        ],
      },
    ],
  },
  decision_spine: {
    decision: "Is CPC's EV charging portfolio geographically balanced?",
    recommendation: "No. 73% urban concentration suggests strategic gap in rural coverage. Recommend LEVI Fund targeting as next funding vehicle.",
    confidence_tier: "Supported",
    key_assumption: "Rural EV adoption follows urban trend with 3-year lag.",
    next_action: "Map underserved regions against LEVI Fund eligibility criteria.",
  },
};

export const MOCK_SCENARIO: Partial<AgentState> = {
  artifact_block: {
    type: "scenario",
    confidence_tier: "Indicative",
    sections: {
      "Hypothesis": "Autonomous freight corridors will achieve commercial viability on UK motorway network by 2032, enabling CPC to position a funded programme in the 2025-27 window.",
      "Supporting Evidence":
        "- TRL 5-6 platooning trials (Highways England, 2022) demonstrated 8% fuel saving on controlled motorway segments\n- EU AutoFreight programme (2021-24) reached commercial pilot stage in 4 years from equivalent TRL\n- DfT Freight Carbon Review explicitly names autonomous corridors as a priority intervention by 2030",
      "Challenging Evidence":
        "- UK regulatory framework for Level 4 autonomy on public roads has no confirmed timeline (DVSA, 2023)\n- Insurance and liability frameworks for autonomous freight remain unresolved in UK law\n- Only 2 of 11 comparable EU pilots reached commercial scale within 7 years",
      "Key Assumptions":
        "1. DfT regulatory timeline for Level 4 autonomy published by 2026 [FRAGILE]\n2. Insurance market develops appropriate product for autonomous HGV by 2028 [UNVERIFIED]\n3. At least one major logistics operator commits to corridor trial by 2025 [FRAGILE]\n4. CPC can secure Innovate UK co-funding in 2025 window [HELD]",
      "Verdict":
        "Conditional Go — commercial viability by 2032 is plausible but depends on regulatory clarity (assumption 1). Recommend a 6-month regulatory watch before committing programme budget. Revisit if DfT publishes Level 4 roadmap before Q2 2025.",
    },
    corpus_citations: [
      { id: "aaa00001-0000-0000-0000-000000000001", title: "Motorway Platooning Trials — Phase 2 Results", organisation: "Highways England", score: 0.87, source_type: "project" },
      { id: "bbb00002-0000-0000-0000-000000000002", title: "Autonomous Freight Regulatory Readiness — DVSA", publisher: "DVSA", score: 0.74, source_type: "knowledge_doc" },
    ],
  },
  decision_spine: {
    decision: "Should CPC commit programme budget to autonomous freight corridors for 2025-27?",
    recommendation: "Hold. Regulatory assumption is fragile. Recommend 6-month watch period with quarterly regulatory review.",
    confidence_tier: "Indicative",
    key_assumption: "DfT Level 4 autonomy roadmap published before Q2 2025.",
    next_action: "Set regulatory review trigger: if DfT publishes Level 4 roadmap, fast-track scoping.",
    strongest_objection: "No confirmed regulatory timeline — programme risk is unacceptable without it.",
    would_change_if: "DfT publishes Level 4 autonomy roadmap with confirmed 2026 implementation date.",
  },
};
