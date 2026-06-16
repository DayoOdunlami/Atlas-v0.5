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
| Harmonized external evidence (D4.6) | In plan v2.1 — not yet built | After MVP preview sign-off; Connect + policy first |
