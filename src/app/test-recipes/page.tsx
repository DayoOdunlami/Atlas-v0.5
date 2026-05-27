/**
 * Visual recipe validation page — NOT for production.
 * Navigate to /test-recipes to see all four surfaces with rich mock data.
 */
import { ArtifactPanel } from "@/components/dashboard/layout/artifact-panel";
import { TrustRail } from "@/components/dashboard/layout/trust-rail";
import { DecisionSpineCard } from "@/components/dashboard/layout/decision-spine";
import type { ArtifactBlock, DecisionSpine } from "@/lib/types";

// ── Mock data ────────────────────────────────────────────────────────────────

const BRIEF_ARTIFACT: ArtifactBlock = {
  type: "brief",
  confidence_tier: "Supported",
  sections: {
    "Strategic Case":
      "Autonomous freight corridors represent a significant strategic opportunity for CPC. Three comparable R&D programmes (TRL 4–6) demonstrate strong alignment with UKRI freight decarbonisation priorities. The Green Book strategic case is strengthened by DfT's Freight Carbon Review 2023 target of 20% modal shift by 2035.",
    "Economic Case":
      "Indicative BCR of 2.4:1 based on corpus analogues from the connected logistics programme (2021-23). Key economic benefits: journey-time savings (£34m NPV), reduced road maintenance costs (£12m NPV), CO₂ abatement at £85/tonne consistent with BEIS carbon values.",
    "Commercial Case":
      "Open funding calls identified from Innovate UK and UKRI Smart Mobility Challenge (total available: £18m). Commercial structure precedent: consortium-led with CPC as convenor, industry matched at 30-50%. Two active operators have expressed intent to participate.",
    "Financial Case":
      "Recommended programme cost: £8-12m over 36 months. Funding mix: Innovate UK (50%), industry match (30%), CPC programme budget (20%). Year 1 commitments achievable within existing CPC budget envelope.",
    "Management Case":
      "Delivery model: programme management via CPC Innovation team with external technical advisory board. Precedent: Connected Places Catapult Smart Mobility Programme (2020-22) delivered to time and budget.",
  },
  corpus_citations: [
    { id: "aaa00001-0000-0000-0000-000000000001", title: "Connected and Autonomous Vehicle R&D — Phase 3", organisation: "Connected Places Catapult", score: 0.91, source_type: "project" },
    { id: "bbb00002-0000-0000-0000-000000000002", title: "UKRI Smart Mobility Challenge — Open Call 2024", funder: "UKRI", score: 0.85, source_type: "live_call" },
    { id: "ccc00003-0000-0000-0000-000000000003", title: "Freight Decarbonisation Policy Evidence Base", publisher: "DfT", score: 0.78, source_type: "knowledge_doc" },
  ],
  npv_value: 46_000_000,
  discount_rate: 3.5,
};

const BRIEF_SPINE: DecisionSpine = {
  decision: "Should CPC commission a Phase 1 autonomous freight corridor programme?",
  recommendation: "Proceed to scoping. Evidence base is sufficient for an Indicative investment case. Recommend 6-week discovery with 3 anchor industry partners before committing programme budget.",
  confidence_tier: "Supported",
  key_assumption: "DfT freight decarbonisation targets remain in place through 2030.",
  next_action: "Convene industry workshop — identify 3 anchor operators for scoping phase.",
  framework: "Green Book / Five Case Model",
  strongest_objection: "Technology readiness remains at TRL 4-5; commercial deployment unlikely before 2031.",
  would_change_if: "Evidence of successful corridor pilots in comparable European geographies.",
};

const EVIDENCE_ARTIFACT: ArtifactBlock = {
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
};

const EVIDENCE_SPINE: DecisionSpine = {
  decision: "Active travel evidence base depth in CPC corpus",
  recommendation: "Strong evidence base exists across 4 source types. 6 verified citations with top similarity 0.93. Sufficient for Robust assessment.",
  confidence_tier: "Robust",
  key_assumption: "Active travel policy landscape remains stable.",
  next_action: "Filter by modes='walking,cycling' for more targeted brief.",
};

const STATS_ARTIFACT: ArtifactBlock = {
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
};

const STATS_SPINE: DecisionSpine = {
  decision: "Is CPC's EV charging portfolio geographically balanced?",
  recommendation: "No. 73% urban concentration suggests strategic gap in rural coverage. Recommend LEVI Fund targeting as next funding vehicle.",
  confidence_tier: "Supported",
  key_assumption: "Rural EV adoption follows urban trend with 3-year lag.",
  next_action: "Map underserved regions against LEVI Fund eligibility criteria.",
};

const SCENARIO_ARTIFACT: ArtifactBlock = {
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
      "Conditional Go — commercial viability by 2032 is plausible but depends on regulatory clarity (assumption 1). Recommend a 6-month regulatory watch before committing programme budget.",
  },
  corpus_citations: [
    { id: "aaa00001-0000-0000-0000-000000000001", title: "Motorway Platooning Trials — Phase 2 Results", organisation: "Highways England", score: 0.87, source_type: "project" },
    { id: "bbb00002-0000-0000-0000-000000000002", title: "Autonomous Freight Regulatory Readiness — DVSA", publisher: "DVSA", score: 0.74, source_type: "knowledge_doc" },
  ],
};

const SCENARIO_SPINE: DecisionSpine = {
  decision: "Should CPC commit programme budget to autonomous freight corridors for 2025-27?",
  recommendation: "Hold. Regulatory assumption is fragile. Recommend 6-month watch period with quarterly regulatory review.",
  confidence_tier: "Indicative",
  key_assumption: "DfT Level 4 autonomy roadmap published before Q2 2025.",
  next_action: "Set regulatory review trigger: fast-track scoping if DfT publishes Level 4 roadmap.",
  strongest_objection: "No confirmed regulatory timeline — programme risk is unacceptable without it.",
  would_change_if: "DfT publishes Level 4 autonomy roadmap with confirmed 2026 implementation date.",
};

// ── CPC mock data ────────────────────────────────────────────────────────────

const CPC_CAPABILITY_ARTIFACT: ArtifactBlock = {
  type: "brief",
  recipe: "cpc_capability_assessment",
  confidence_tier: "Supported",
  sections: {
    Summary:
      "CPC has a meaningful evidence base in autonomous freight technology, with 12 active R&D projects across 3 business units. Programme-level claims (L2) are well-supported, but strategic outcome claims (L3) are thin — only one Indicative L3 claim is verified. Evidence is sufficient for a partnership case with a lead technology operator.",
  },
  corpus_citations: [
    {
      id: "aaa00001-0000-0000-0000-000000000001",
      title: "Autonomous Freight Corridor Trials — Phase 2",
      organisation: "CPC Future Mobility / Highways England",
      score: 0.92,
      source_type: "project",
    },
    {
      id: "bbb00002-0000-0000-0000-000000000002",
      title: "Connected Logistics: Last Mile Automation",
      organisation: "CPC Future Mobility",
      score: 0.87,
      source_type: "project",
    },
    {
      id: "ccc00003-0000-0000-0000-000000000003",
      title: "Intelligent Transport Systems — R&D Fund 2022",
      organisation: "CPC Innovation",
      score: 0.81,
      source_type: "project",
    },
  ],
  cpc_claims: [
    {
      id: "c1",
      text: "CPC has designed and delivered three motorway freight platooning trials with industry partners since 2020.",
      level: 2,
      confidence_tier: "Supported",
      source_project: "Autonomous Freight Corridor Trials",
      source_excerpt:
        "Phase 2 results demonstrate 8% fuel efficiency gain across 3 pilot corridors.",
    },
    {
      id: "c2",
      text: "CPC convened a cross-sector logistics consortium of 14 industry partners for the LEVI charging programme.",
      level: 2,
      confidence_tier: "Supported",
      source_project: "Connected Logistics",
    },
    {
      id: "c3",
      text: "CPC operational programme team has delivered 2 multi-partner freight projects on time and within budget.",
      level: 1,
      confidence_tier: "Robust",
      source_project: "Intelligent Transport Systems",
    },
    {
      id: "c4",
      text: "Connected logistics R&D contributed to a 12% reduction in urban delivery emissions in the Bristol pilot zone.",
      level: 3,
      confidence_tier: "Indicative",
      source_project: "Connected Logistics",
      source_excerpt: "2022 interim results; not yet independently validated.",
    },
    {
      id: "c5",
      text: "CPC participates in HorizonEurope AutoFreight consortium as UK convenor.",
      level: 1,
      confidence_tier: "Supported",
    },
  ],
  cpc_gaps: [
    {
      area: "No Level 3 strategic outcome claims verified",
      severity: "high",
      description:
        "Only one L3 claim exists and it is Indicative — insufficient for a Robust strategic case.",
      claim_count: 1,
    },
    {
      area: "No partner performance data",
      severity: "medium",
      description:
        "Corpus contains no validated FTE, cost, or productivity data from freight partners.",
      project_count: 0,
    },
    {
      area: "Rural corridor evidence thin",
      severity: "medium",
      description:
        "All 3 projects cover urban or motorway freight only. Rural last-mile coverage not evidenced.",
      project_count: 1,
    },
    {
      area: "No validated outcome metrics for platooning",
      severity: "low",
      description:
        "Phase 2 results are interim and not yet independently verified.",
      project_count: 1,
    },
  ],
  recommendation_action: "partner",
  recommendation_rationale:
    "Evidence base supports a partnership role for CPC as technical convenor. Do not lead programme budget without additional L3 strategic claims.",
};

const CPC_CAPABILITY_SPINE: DecisionSpine = {
  decision: "Does CPC have sufficient capability evidence to support a lead role in an autonomous freight R&D programme?",
  recommendation:
    "Partner — not lead. CPC has verified L2 programme claims but no Robust L3 strategic outcomes. Partner with a logistics operator as the industry prime.",
  confidence_tier: "Supported",
  key_assumption:
    "At least one major logistics operator is willing to take the lead applicant role in an Innovate UK bid.",
  next_action:
    "Identify 2-3 potential lead operators; prepare a CPC capability statement drawing on the 3 verified L2 claims.",
  framework: "CPC Capability Intelligence",
  strongest_objection:
    "No independently validated outcome data — L3 claim is Indicative only.",
  would_change_if:
    "Phase 2 platooning results receive independent validation and a new Robust L3 claim can be generated.",
};

const CPC_PORTFOLIO_ARTIFACT: ArtifactBlock = {
  type: "chart",
  recipe: "cpc_portfolio_comparison",
  confidence_tier: "Supported",
  sections: {
    Summary:
      "Portfolio comparison across 5 CPC business units shows significant concentration in Future Mobility (31 projects) and Digital Infrastructure (18 projects). Active Travel and Rural Connectivity are underserved relative to the current funding landscape. Claims depth is strongest in Future Mobility (L2/L3 coverage) but absent in Rural Connectivity (L1 only).",
  },
  cpc_portfolio: [
    {
      name: "Future Mobility",
      project_count: 31,
      claim_count: 42,
      l1_claims: 12,
      l2_claims: 22,
      l3_claims: 8,
      evidence_links: 78,
    },
    {
      name: "Digital Infrastructure",
      project_count: 18,
      claim_count: 28,
      l1_claims: 9,
      l2_claims: 15,
      l3_claims: 4,
      evidence_links: 41,
    },
    {
      name: "Places & Growth",
      project_count: 11,
      claim_count: 14,
      l1_claims: 6,
      l2_claims: 7,
      l3_claims: 1,
      evidence_links: 23,
    },
    {
      name: "Active Travel",
      project_count: 7,
      claim_count: 8,
      l1_claims: 5,
      l2_claims: 3,
      l3_claims: 0,
      evidence_links: 12,
    },
    {
      name: "Rural Connectivity",
      project_count: 4,
      claim_count: 4,
      l1_claims: 4,
      l2_claims: 0,
      l3_claims: 0,
      evidence_links: 6,
    },
  ],
  cpc_gaps: [
    {
      area: "Rural Connectivity: no L2 or L3 claims",
      severity: "high",
      description:
        "4 projects in corpus but only delivery-level claims. Cannot support a programme or strategic investment case.",
      project_count: 4,
      claim_count: 4,
    },
    {
      area: "Active Travel: underweight vs. funding landscape",
      severity: "medium",
      description:
        "7 projects vs. £340m available from Active Travel England in 2024-25. Significant gap between CPC capability and market opportunity.",
      project_count: 7,
    },
    {
      area: "Cannot compare FTE or productivity across units",
      severity: "low",
      description:
        "Corpus compares project volume and evidence coverage only. No resource or cost-per-outcome data is available.",
    },
  ],
};

const CPC_PORTFOLIO_SPINE: DecisionSpine = {
  decision:
    "Which CPC business units have the strongest evidence base to support 2025-26 funding bids?",
  recommendation:
    "Future Mobility and Digital Infrastructure are bid-ready (L2/L3 coverage). Active Travel has emerging evidence. Rural Connectivity and Places & Growth require corpus enrichment before any strategic case is supportable.",
  confidence_tier: "Supported",
  key_assumption:
    "Corpus coverage is representative — no major unpublished projects exist that would change the unit rankings.",
  next_action:
    "Commission retrospective outcome studies for Rural Connectivity and Active Travel to generate L2/L3 claims.",
  framework: "CPC Capability Intelligence",
};

const CPC_MARKET_ALIGNMENT_ARTIFACT: ArtifactBlock = {
  type: "evidence",
  recipe: "cpc_market_alignment",
  confidence_tier: "Indicative",
  sections: {
    Summary:
      "Three live funding calls show strong alignment with CPC's Future Mobility and Digital Infrastructure portfolios. UKRI Smart Mobility Challenge (£22m, closes Nov 2024) is the highest-priority match. CPC evidence base covers 8 of 11 required capability areas for the lead applicant role.",
  },
  corpus_citations: [
    {
      id: "lc1",
      title: "UKRI Smart Mobility Challenge — Open Call 2024",
      funder: "UKRI",
      deadline: "2024-11-30",
      score: 0.91,
      source_type: "live_call",
    },
    {
      id: "lc2",
      title: "Innovate UK Connected Places Round 5",
      funder: "Innovate UK",
      deadline: "2024-12-15",
      score: 0.84,
      source_type: "live_call",
    },
    {
      id: "lc3",
      title: "DfT Future of Freight Innovation Fund",
      funder: "Department for Transport",
      deadline: "2025-01-31",
      score: 0.76,
      source_type: "live_call",
    },
    {
      id: "p1",
      title: "Autonomous Freight Corridor Trials — Phase 2",
      organisation: "CPC Future Mobility",
      score: 0.89,
      source_type: "project",
    },
    {
      id: "p2",
      title: "Connected Logistics: Last Mile Automation",
      organisation: "CPC Future Mobility",
      score: 0.84,
      source_type: "project",
    },
    {
      id: "p3",
      title: "Urban Air Mobility Regulatory Sandbox",
      organisation: "CPC Innovation",
      score: 0.78,
      source_type: "project",
    },
  ],
  cpc_claims: [
    {
      id: "mc1",
      text: "CPC can demonstrate end-to-end smart mobility programme delivery from TRL 4 to TRL 7.",
      level: 2,
      confidence_tier: "Supported",
      source_project: "Autonomous Freight Corridor Trials",
    },
    {
      id: "mc2",
      text: "CPC has built and managed cross-sector consortia of ≥10 partners in mobility R&D programmes.",
      level: 2,
      confidence_tier: "Robust",
    },
    {
      id: "mc3",
      text: "CPC has convened regulatory sandbox environments for novel transport technologies.",
      level: 2,
      confidence_tier: "Supported",
      source_project: "Urban Air Mobility Regulatory Sandbox",
    },
  ],
  cpc_gaps: [
    {
      area: "Insufficient evidence for 3 UKRI capability requirements",
      severity: "high",
      description:
        "UKRI requires: (1) commercial deployment track record, (2) international consortium links, (3) Level 4 autonomy regulatory experience. CPC corpus evidences none at L2 or above.",
      claim_count: 0,
    },
    {
      area: "No evidence of CPC as lead applicant on >£10m programme",
      severity: "medium",
      description:
        "All verified projects show CPC as convenor or delivery partner, not lead applicant for major funding.",
      project_count: 0,
    },
    {
      area: "DfT Freight call: corpus coverage partial",
      severity: "low",
      description:
        "3 relevant projects matched but evidence covers only 6 of 9 DfT assessment criteria.",
      project_count: 3,
    },
  ],
  recommendation_action: "bid",
  recommendation_rationale:
    "UKRI Smart Mobility is the strongest match. Recommend CPC as technical lead with an industry prime. Prepare a capability statement drawing on 3 verified L2 claims.",
};

const CPC_MARKET_ALIGNMENT_SPINE: DecisionSpine = {
  decision:
    "Should CPC prepare a bid response for the UKRI Smart Mobility Challenge 2024?",
  recommendation:
    "Bid — as technical lead with industry prime. Evidence base is sufficient for 8 of 11 UKRI criteria. Address the 3 missing criteria in the bid application via planned consortium partners.",
  confidence_tier: "Indicative",
  key_assumption:
    "A logistics operator with commercial deployment experience is willing to join the consortium as industry prime.",
  next_action:
    "Approach 2 target operators this week; confirm interest before bid preparation begins.",
  framework: "CPC Capability Intelligence",
  strongest_objection:
    "No commercial deployment evidence — UKRI may downgrade CPC's track record assessment.",
  would_change_if:
    "A second operator with a live commercial deployment joins the consortium.",
};

const CPC_EVIDENCE_GAPS_ARTIFACT: ArtifactBlock = {
  type: "evidence",
  recipe: "cpc_evidence_gaps",
  confidence_tier: "Indicative",
  sections: {
    Summary:
      "Evidence gap analysis reveals 9 significant gaps across the CPC corpus. 3 high-severity gaps relate to missing L3 strategic claims in Rural Connectivity, Active Travel, and Freight. Immediate enrichment priorities: commission 2 retrospective outcome studies and ingest 4 unpublished programme evaluations.",
  },
  cpc_claims: [
    { id: "eg-c1", text: "CPC delivered a £6m freight platooning programme within 5% of budget.", level: 1, confidence_tier: "Robust" },
    { id: "eg-c2", text: "CPC convened the National Active Travel Innovation Forum (2022-23).", level: 1, confidence_tier: "Supported" },
    { id: "eg-c3", text: "CPC Future Mobility portfolio contributed to DfT's Freight Carbon Review evidence base.", level: 2, confidence_tier: "Supported" },
    { id: "eg-c4", text: "CPC programme influenced DfT freight decarbonisation policy through corpus-cited work.", level: 3, confidence_tier: "Indicative" },
    { id: "eg-c5", text: "CPC active travel programme demonstrated 15% uptake in participating boroughs.", level: 3, confidence_tier: "Speculative" },
  ],
  cpc_portfolio: [
    { name: "Future Mobility", project_count: 31, claim_count: 42, l1_claims: 12, l2_claims: 22, l3_claims: 8, evidence_links: 78 },
    { name: "Digital Infrastructure", project_count: 18, claim_count: 28, l1_claims: 9, l2_claims: 15, l3_claims: 4, evidence_links: 41 },
    { name: "Places & Growth", project_count: 11, claim_count: 14, l1_claims: 6, l2_claims: 7, l3_claims: 1, evidence_links: 23 },
    { name: "Active Travel", project_count: 7, claim_count: 8, l1_claims: 5, l2_claims: 3, l3_claims: 0, evidence_links: 12 },
    { name: "Rural Connectivity", project_count: 4, claim_count: 4, l1_claims: 4, l2_claims: 0, l3_claims: 0, evidence_links: 6 },
  ],
  cpc_gaps: [
    { area: "Rural Connectivity: no strategic outcome claims", severity: "high", description: "4 projects, 0 L2/L3 claims. Cannot support any programme-level or strategic investment case.", project_count: 4, claim_count: 0 },
    { area: "Active Travel: missing impact outcomes", severity: "high", description: "7 projects but no validated impact data. Speculative L3 claim only — not citable in a funding bid.", project_count: 7, claim_count: 1 },
    { area: "Freight: no commercial deployment evidence", severity: "high", description: "All freight R&D is TRL 4-6. No evidence of commercial-scale deployment or follow-on investment.", project_count: 3, claim_count: 0 },
    { area: "Places & Growth: thin policy connection", severity: "medium", description: "14 claims but only 1 reaches L3. Missing link between CPC projects and planning/growth outcomes.", project_count: 11, claim_count: 1 },
    { area: "No partner outcome data in corpus", severity: "medium", description: "CPC projects lack partner-specific outcome data. Cannot support claims about partner commercial benefits.", project_count: 0 },
    { area: "Resource/FTE data absent across all units", severity: "medium", description: "No programme has validated FTE or cost-per-outcome data. Cannot support efficiency or value-for-money claims." },
    { area: "Digital Infrastructure: no international citations", severity: "low", description: "18 projects with no international comparators cited. Limits UKRI and EU funding eligibility.", project_count: 0 },
    { area: "Only 2 knowledge docs ingested post-2023", severity: "low", description: "Policy knowledge base is outdated. 4 DfT/CCAV documents from 2024 not yet ingested.", claim_count: 0 },
    { area: "No Level 3 claims for Active Travel or Rural Connectivity", severity: "high", description: "Two entire business units have zero verified strategic outcome claims." },
  ],
};

const CPC_EVIDENCE_GAPS_SPINE: DecisionSpine = {
  decision:
    "What are the highest-priority evidence gaps to close before the next funding round?",
  recommendation:
    "Commission outcome studies for Rural Connectivity and Active Travel immediately. Ingest the 4 outstanding DfT/CCAV 2024 documents. Without these actions, CPC cannot support a strategic case for 2 of its 5 business units.",
  confidence_tier: "Indicative",
  key_assumption:
    "Unpublished programme evaluations exist and can be cleared for corpus ingestion within 8 weeks.",
  next_action:
    "Identify 2 retrospective outcome study candidates; raise corpus ingestion request for 4 outstanding policy documents.",
  framework: "CPC Capability Intelligence",
};

// ── New recipe: CPC Opportunity Fit ──────────────────────────────────────────

const CPC_OPPORTUNITY_FIT_ARTIFACT: ArtifactBlock = {
  type: "evidence",
  recipe: "cpc_opportunity_fit",
  confidence_tier: "Indicative",
  sections: {
    Summary:
      "Three live funding calls assessed against CPC's evidence base. UKRI Smart Mobility is bid-ready — high corpus fit and sufficient L2/L3 claims. Innovate UK Connected Places has strong fit but insufficient evidence depth; enrich before bidding. DfT Future of Freight has strong evidence but lower semantic fit — may need portfolio repositioning.",
  },
  corpus_citations: [
    {
      id: "lc1",
      title: "UKRI Smart Mobility Challenge — Open Call 2024",
      funder: "UKRI",
      deadline: "2024-11-30",
      score: 0.91,
      source_type: "live_call",
    },
    {
      id: "lc2",
      title: "Innovate UK Connected Places Round 5",
      funder: "Innovate UK",
      deadline: "2024-12-15",
      score: 0.84,
      source_type: "live_call",
    },
    {
      id: "lc3",
      title: "DfT Future of Freight Innovation Fund",
      funder: "Department for Transport",
      deadline: "2025-01-31",
      score: 0.71,
      source_type: "live_call",
    },
    {
      id: "lc4",
      title: "Active Travel England Cycling Innovation Round 2",
      funder: "Active Travel England",
      deadline: "2025-02-28",
      score: 0.58,
      source_type: "live_call",
    },
  ],
  cpc_claims: [
    { id: "of-c1", text: "CPC delivered three motorway platooning trials with industry partners.", level: 2, confidence_tier: "Supported" },
    { id: "of-c2", text: "CPC convened cross-sector consortia of ≥10 partners in mobility R&D.", level: 2, confidence_tier: "Robust" },
    { id: "of-c3", text: "CPC has convened regulatory sandboxes for novel transport technologies.", level: 2, confidence_tier: "Supported" },
    { id: "of-c4", text: "Connected logistics R&D contributed to 12% urban delivery emission reduction.", level: 3, confidence_tier: "Indicative" },
  ],
  recommendation_action: "bid",
  recommendation_rationale:
    "UKRI Smart Mobility is the clear priority. Bid as technical lead with an industry prime for commercial deployment evidence.",
};

const CPC_OPPORTUNITY_FIT_SPINE: DecisionSpine = {
  decision: "Which live funding calls should CPC prioritise for 2024-25?",
  recommendation:
    "Bid on UKRI Smart Mobility (91% fit, 4 L2/L3 claims — bid-ready). Enrich evidence before bidding on Innovate UK (84% fit but only 2 supporting claims). Monitor DfT Freight (71% fit, strong evidence — possible repositioning play). Pass on Active Travel England (58% fit — poor match).",
  confidence_tier: "Indicative",
  key_assumption:
    "An industry prime with commercial deployment experience joins the UKRI consortium.",
  next_action: "Approach 2 logistics operators this week; confirm UKRI interest before beginning bid preparation.",
  framework: "CPC Capability Intelligence",
  strongest_objection: "No verified commercial deployment track record for UKRI criterion 3.",
  would_change_if: "A logistics partner with live commercial deployment joins the consortium.",
};

// ── New recipe: CPC Funding Flow ──────────────────────────────────────────────

const CPC_FUNDING_FLOW_ARTIFACT: ArtifactBlock = {
  type: "chart",
  recipe: "cpc_funding_flow",
  confidence_tier: "Indicative",
  sections: {
    Summary:
      "Funding flows through CPC's Future Mobility and Digital Infrastructure units most strongly. UKRI and Innovate UK are the dominant funder pathways. Evidence pyramid terminates at L3 Strategic level only in Future Mobility and Digital Infrastructure — these are the only units with a complete funding-to-evidence flow. Rural Connectivity and Active Travel have no L2/L3 claims blocking the strategic tier.",
  },
  corpus_citations: [
    { id: "lc1", title: "UKRI Smart Mobility Challenge", funder: "UKRI", score: 0.91, source_type: "live_call" },
    { id: "lc2", title: "Innovate UK Connected Places Round 5", funder: "Innovate UK", score: 0.84, source_type: "live_call" },
    { id: "lc3", title: "DfT Future of Freight Innovation Fund", funder: "DfT", score: 0.71, source_type: "live_call" },
  ],
  cpc_portfolio: [
    { name: "Future Mobility", project_count: 31, claim_count: 42, l1_claims: 12, l2_claims: 22, l3_claims: 8, evidence_links: 78 },
    { name: "Digital Infrastructure", project_count: 18, claim_count: 28, l1_claims: 9, l2_claims: 15, l3_claims: 4, evidence_links: 41 },
    { name: "Places & Growth", project_count: 11, claim_count: 14, l1_claims: 6, l2_claims: 7, l3_claims: 1, evidence_links: 23 },
    { name: "Active Travel", project_count: 7, claim_count: 8, l1_claims: 5, l2_claims: 3, l3_claims: 0, evidence_links: 12 },
    { name: "Rural Connectivity", project_count: 4, claim_count: 4, l1_claims: 4, l2_claims: 0, l3_claims: 0, evidence_links: 6 },
  ],
  cpc_gaps: [
    { area: "Rural Connectivity: no L2/L3 evidence terminus", severity: "high", description: "Funding flows in but no programme or strategic claims exist — the pipeline terminates at delivery only.", project_count: 4, claim_count: 0 },
    { area: "Active Travel: missing L3 strategic claims", severity: "medium", description: "L2 claims exist but no L3 — cannot close the loop to strategic outcome.", project_count: 7, claim_count: 3 },
  ],
  // Agent-provided Sankey with explicit funder→BU→evidence flows
  chart_specs: [
    {
      type: "sankey",
      title: "CPC Funding Flow: Funders → Business Units → Evidence Level",
      source: "source",
      target: "target",
      value: "value",
      data: [
        // Funder → BU
        { source: "UKRI", target: "Future Mobility", value: 12 },
        { source: "UKRI", target: "Digital Infrastructure", value: 7 },
        { source: "Innovate UK", target: "Future Mobility", value: 9 },
        { source: "Innovate UK", target: "Places & Growth", value: 4 },
        { source: "DfT", target: "Future Mobility", value: 6 },
        { source: "DfT", target: "Active Travel", value: 3 },
        { source: "ATE", target: "Active Travel", value: 4 },
        { source: "ATE", target: "Rural Connectivity", value: 2 },
        // BU → evidence level
        { source: "Future Mobility", target: "L3 Strategic", value: 8 },
        { source: "Future Mobility", target: "L2 Programme", value: 14 },
        { source: "Future Mobility", target: "L1 Delivery", value: 5 },
        { source: "Digital Infrastructure", target: "L3 Strategic", value: 4 },
        { source: "Digital Infrastructure", target: "L2 Programme", value: 11 },
        { source: "Digital Infrastructure", target: "L1 Delivery", value: 4 },
        { source: "Places & Growth", target: "L2 Programme", value: 7 },
        { source: "Places & Growth", target: "L1 Delivery", value: 4 },
        { source: "Active Travel", target: "L2 Programme", value: 3 },
        { source: "Active Travel", target: "L1 Delivery", value: 3 },
        { source: "Rural Connectivity", target: "L1 Delivery", value: 4 },
      ],
    },
  ],
};

const CPC_FUNDING_FLOW_SPINE: DecisionSpine = {
  decision: "Which funding pathways does CPC have complete evidence chains for?",
  recommendation:
    "Future Mobility and Digital Infrastructure have complete funding-to-L3 evidence chains — viable for strategic cases. Three other units have broken chains: Places & Growth stops at L2, Active Travel stops at L2, Rural Connectivity stops at L1. Prioritise evidence enrichment for these units to close the strategic pipeline.",
  confidence_tier: "Indicative",
  key_assumption:
    "Funder-to-BU flow weights are derived from corpus citation scores and project counts — not verified funder allocation data.",
  next_action:
    "Commission L3 outcome studies for Active Travel and Rural Connectivity to complete the evidence pipeline.",
  framework: "CPC Capability Intelligence",
};

// ── Recipe block ─────────────────────────────────────────────────────────────

function RecipeBlock({
  label,
  artifact,
  spine,
}: {
  label: string;
  artifact: ArtifactBlock;
  spine: DecisionSpine;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          type=&quot;{artifact.type}&quot; · {artifact.confidence_tier}
        </span>
      </div>
      <DecisionSpineCard spine={spine} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ArtifactPanel artifact={artifact} />
        </div>
        <div className="lg:col-span-1">
          <TrustRail artifact={artifact} />
        </div>
      </div>
    </section>
  );
}

import { CpcLiveSection } from "./live-section";
import { VisualDirectorSection } from "./visual-director-section";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TestRecipesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 space-y-12">
      <div>
        <h1 className="text-lg font-semibold">Atlas Render Recipe Validation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All four surfaces with rich mock data. Not wired to the agent — layout validation only.
        </p>
        <div className="mt-2 flex gap-3 text-xs">
          <a href="#mock" className="text-primary underline underline-offset-2">↓ Mock data</a>
          <a href="#live" className="text-green-600 underline underline-offset-2">↓ Live CPC corpus</a>
          <a href="#director" className="text-indigo-600 underline underline-offset-2">↓ Visual Director</a>
          <a href="#new-recipes" className="text-purple-600 underline underline-offset-2">↓ New recipes</a>
        </div>
      </div>

      <div id="mock" />
      <RecipeBlock label="brief_five_case" artifact={BRIEF_ARTIFACT} spine={BRIEF_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="evidence_panel" artifact={EVIDENCE_ARTIFACT} spine={EVIDENCE_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="stats_dashboard" artifact={STATS_ARTIFACT} spine={STATS_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="scenario_stress_test" artifact={SCENARIO_ARTIFACT} spine={SCENARIO_SPINE} />

      <hr className="border-border" />
      <div className="space-y-2">
        <h2 className="text-base font-semibold">CPC Capability Intelligence Recipes</h2>
        <p className="text-xs text-muted-foreground">
          Four structured recipes for CPC capability, portfolio, market, and gap analysis. Evidence-led — not prose-only.
        </p>
      </div>

      <RecipeBlock label="cpc_capability_assessment" artifact={CPC_CAPABILITY_ARTIFACT} spine={CPC_CAPABILITY_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="cpc_portfolio_comparison" artifact={CPC_PORTFOLIO_ARTIFACT} spine={CPC_PORTFOLIO_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="cpc_market_alignment" artifact={CPC_MARKET_ALIGNMENT_ARTIFACT} spine={CPC_MARKET_ALIGNMENT_SPINE} />
      <hr className="border-border" />
      <RecipeBlock label="cpc_evidence_gaps" artifact={CPC_EVIDENCE_GAPS_ARTIFACT} spine={CPC_EVIDENCE_GAPS_SPINE} />

      {/* ── Live CPC Corpus section ──────────────────────────────────────── */}
      <hr className="border-border border-2" id="live" />
      <CpcLiveSection />

      {/* ── Visual Recipe Director section ──────────────────────────────── */}
      <hr className="border-border border-2" id="director" />
      <VisualDirectorSection />

      {/* ── New recipes: Opportunity Fit + Funding Flow ─────────────────── */}
      <hr className="border-border border-2" id="new-recipes" />
      <div className="space-y-2">
        <h2 className="text-base font-semibold">New Visual Recipes</h2>
        <p className="text-xs text-muted-foreground">
          Two recipes driven by the Visual Director — scatter/quadrant for trade-off analysis,
          Sankey for funding flow.
        </p>
      </div>

      <RecipeBlock
        label="cpc_opportunity_fit"
        artifact={CPC_OPPORTUNITY_FIT_ARTIFACT}
        spine={CPC_OPPORTUNITY_FIT_SPINE}
      />
      <hr className="border-border" />
      <RecipeBlock
        label="cpc_funding_flow"
        artifact={CPC_FUNDING_FLOW_ARTIFACT}
        spine={CPC_FUNDING_FLOW_SPINE}
      />
    </main>
  );
}
