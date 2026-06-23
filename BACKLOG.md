# Atlas 5 — Backlog (post-MVP / human-call items)

> Items deferred during MVP build. Each has a **trigger** for when to pull in.

## Security (human decision required)

| Item | Why deferred | Trigger |
|------|--------------|---------|
| Enable RLS on 88 Supabase tables | Enabling without policies blocks all client access | Before any public anon-key exposure beyond current dev/preview |

## Surfaces (post-MVP)

| Item | Why deferred | Trigger |
|------|--------------|---------|
| Generative viz (`ATLAS5_GENERATIVE_VIZ_V1`) | Second validation problem on top of matcher | Sameer asks for chart variety in demo follow-up |
| Canvas / tldraw re-wiring | Different rendering surface; blocks + document sufficient for MVP | User asks to explore visually on canvas |
| Brief artifact panel (CLAUDE D7) | Document mode covers export need for MVP | Buyer asks for Word/PDF export beyond document mode |
| Additional buyer lenses (CPC mode lead, funder, MSA) | North Star sequences SME first | After SME validation lands |
| Sector-split CPC passports | Single canonical passport + scope filter is sufficient | Cross-org passport model needed |

## Design (human taste)

| Item | Why deferred | Trigger |
|------|--------------|---------|
| Claim-states UI primitives (Open Decision #4) | Block-level vocabulary exists; pixel design TBD | Claim states feel illegible in Dayo verification |
| Brand voice / copy polish | Functional copy only for MVP | Commercial launch prep |

## Ops

| Item | Why deferred | Trigger |
|------|--------------|---------|
| Notion harmonisation | MCP was offline | Notion MCP restored |
| Harmonized external evidence (D4.6) | Built (v2.1) | — |

## Blue Ocean (Sprint 3+ — prototype after high-value backbone)

> Higher-risk, higher-differentiation. Build with prose / existing-block reuse first; only add dedicated UI after the logic proves valuable.

| Idea | What it is | Surface | UI cost | Trigger |
|------|-----------|---------|---------|---------|
| **A. Provenance as the product** | Interactive evidence graph (corpus ↔ external ↔ synthesized), click a claim to see what produced it | New tab on workbench artifact panel | Contained — reuse NetworkMap primitive; Phase 1 = enriched list + badges | After D6 backbone |
| **C. Bid-readiness simulation** | Run matcher in reverse: "what would make CPC fit?" — missing evidence, partners, metrics | New `prepare` outcome mode on workbench | Low — new format-pass recipe over ActionPlan + DimensionGap + prose | After A |
| **E. Red-team / counterfactual** | "Steelman the opposite" button → disconfirming external search → rewrite under strongest counter-evidence (reuse `spine/falsification.py`) | Button on existing artifact panel | Lowest — button + reuse ObjectionResponse/RecommendationConfidence | Do FIRST in Sprint 3 |
| **D. Cross-org passport network** | Many passports (partners, SMEs, funders); Atlas brokers matches — two-sided evidence marketplace | **New `/network` page** (Sprint 4) + new data model | High — phase it: prove with a 2nd passport + prose on workbench first | After C validates |

**Blue-ocean build order:** E (button) → A (provenance tab) → C (prepare mode) → D phase-1 (2nd passport, prose) → D phase-2 (`/network` page, Sprint 4).

**Also deferred (from sprint analysis):**

| Item | Why | Trigger |
|------|-----|---------|
| Proactive opportunity radar (nightly external scan + alerts) | Needs scheduler + alert UX | After ingest loop (D6.1) stable |
