/**
 * EntityProfile fixtures — Sprint: Connect the Moat, Phase 2 (fixtures only).
 *
 * Synthetic-but-realistic data for the three EntityProfileSurface configurations
 * rendered on /lab/blocks. NOT wired to the live graph (that is Phase 3).
 *
 * Every claim row carries a claim_state + confidence_reason — the moat rule:
 * never render a claim without its state, and label self-reported claims as such.
 */

import type {
  EntityProfileData,
  EvidenceAwareSwotData,
} from "./block-vocabulary";
import type {
  EntityProfileSurfaceProps,
} from "@/components/atlas5/recipes/entity-profile-surface";

// ── Config 1: Passport ──────────────────────────────────────────────────────

const PASSPORT_GROUPS: EntityProfileData["claim_groups"] = [
  {
    domain: "capability",
    claims: [
      {
        text: "Operates autonomously on GPS-denied suburban routes",
        claim_state: "inferred",
        confidence_reason: "Self-reported by the entity — not independently verified",
      },
      {
        text: "Carries combined passenger and light-goods payloads in one run",
        claim_state: "inferred",
        confidence_reason: "Self-reported by the entity — not independently verified",
      },
    ],
  },
  {
    domain: "certification",
    claims: [
      {
        text: "ISO 26262 ASIL-B functional safety compliance",
        claim_state: "inferred",
        confidence_reason: "Self-reported by the entity — not independently verified",
      },
      {
        text: "PAS 1881 assured operation framework adopted",
        claim_state: "inferred",
        confidence_reason: "AI-inferred from documents — certificate not yet sighted",
      },
    ],
  },
  {
    domain: "evidence",
    claims: [
      {
        text: "12-week pilot covering 1,400 autonomous kilometres",
        claim_state: "inferred",
        confidence_reason: "Self-reported by the entity — not independently verified",
      },
    ],
  },
  {
    domain: "performance",
    claims: [
      {
        text: "Mean time between disengagements > 350 km",
        claim_state: "unknown",
        confidence_reason: "No supporting evidence found in the corpus",
      },
    ],
  },
];

export const PASSPORT_CONFIG: EntityProfileSurfaceProps = {
  subject_type: "passport",
  identity: {
    name: "GoShuttle X1",
    subtitle: "GoShuttle Ltd · TRL 6 · Automotive → Public transport",
    confidence_tier: "Indicative",
  },
  claim_groups: PASSPORT_GROUPS,
  escalations: [
    { label: "Find opportunities", target: "connect" },
    { label: "Diagnose gaps", target: "diagnose" },
  ],
};

// ── Config 2: SWOT (every cell claim-stated) ─────────────────────────────────

const SWOT_DATA: EvidenceAwareSwotData = {
  strengths: [
    {
      text: "Proven combined passenger + goods autonomy",
      claim_state: "stated",
      confidence_reason: "Verified in trial report",
    },
    {
      text: "Lowest-cost-per-km in its TRL band",
      claim_state: "inferred",
      confidence_reason: "Self-reported — not independently verified",
    },
  ],
  weaknesses: [
    {
      text: "No open-road HGV precedent in the corpus",
      claim_state: "stated",
      confidence_reason: "Corpus search returned zero direct matches",
    },
    {
      text: "Disengagement rate unproven at scale",
      claim_state: "unknown",
      confidence_reason: "No evidence found",
    },
  ],
  opportunities: [
    {
      text: "A14 corridor regulatory sandbox window open",
      claim_state: "inferred",
      confidence_reason: "Derived from a live funding call — match, not direct claim",
    },
  ],
  threats: [
    {
      text: "Union resistance to automation narrative",
      claim_state: "contested",
      confidence_reason: "Sources conflict on workforce impact",
    },
  ],
};

export const SWOT_CONFIG: EntityProfileSurfaceProps = {
  subject_type: "swot",
  identity: {
    name: "GoShuttle X1 — Strategic Position",
    subtitle: "Evidence-aware SWOT · strengths from passport, opportunities from matches",
    confidence_tier: "Indicative",
  },
  swot: SWOT_DATA,
  escalations: [
    { label: "Find opportunities", target: "connect" },
    { label: "Defend position", target: "defend" },
  ],
};

// ── Config 3: Organisation (same skeleton, corpus entity data) ───────────────

const ORG_GROUPS: EntityProfileData["claim_groups"] = [
  {
    domain: "capability",
    claims: [
      {
        text: "National convening power across freight innovation programmes",
        claim_state: "stated",
        confidence_reason: "Curated CPC capability profile",
      },
      {
        text: "Cross-modal evidence corpus spanning rail, road and air",
        claim_state: "inferred",
        confidence_reason: "Derived from corpus density — not an explicit claim",
      },
    ],
  },
  {
    domain: "evidence",
    claims: [
      {
        text: "8 verified CAV projects across 3 business units",
        claim_state: "stated",
        confidence_reason: "Counted from verified atlas.projects rows",
      },
    ],
  },
  {
    domain: "performance",
    claims: [
      {
        text: "Open-road HGV trial delivery track record",
        claim_state: "unknown",
        confidence_reason: "No direct corpus evidence found",
      },
    ],
  },
];

export const ORGANISATION_CONFIG: EntityProfileSurfaceProps = {
  subject_type: "organisation",
  identity: {
    name: "Connected Places Catapult",
    subtitle: "Transport Innovation Capability Profile · corpus-derived",
    confidence_tier: "Supported",
  },
  claim_groups: ORG_GROUPS,
  escalations: [
    { label: "Find opportunities", target: "connect" },
    { label: "Diagnose gaps", target: "diagnose" },
  ],
};

// ── Empty (regression) variants — honest skeleton, no fabricated claims ──────

export const PASSPORT_EMPTY: EntityProfileSurfaceProps = {
  subject_type: "passport",
  identity: { name: "Unknown entity", subtitle: "No passport on file", confidence_tier: "Speculative" },
  claim_groups: [],
  escalations: [{ label: "Upload passport", target: "diagnose" }],
};

export const SWOT_EMPTY: EntityProfileSurfaceProps = {
  subject_type: "swot",
  identity: { name: "No SWOT yet", confidence_tier: "Speculative" },
  swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
};

export const ORGANISATION_EMPTY: EntityProfileSurfaceProps = {
  subject_type: "organisation",
  identity: { name: "Unresolved organisation", confidence_tier: "Speculative" },
  claim_groups: [],
};

export const ENTITY_PROFILE_CONFIGS: Array<{
  key: string;
  title: string;
  golden: EntityProfileSurfaceProps;
  empty: EntityProfileSurfaceProps;
}> = [
  { key: "passport", title: "Passport", golden: PASSPORT_CONFIG, empty: PASSPORT_EMPTY },
  { key: "swot", title: "SWOT", golden: SWOT_CONFIG, empty: SWOT_EMPTY },
  { key: "organisation", title: "Organisation", golden: ORGANISATION_CONFIG, empty: ORGANISATION_EMPTY },
];
