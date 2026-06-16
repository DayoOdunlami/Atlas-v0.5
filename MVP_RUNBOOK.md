# Atlas 5 MVP Runbook

> **Status:** Local MVP gate green (2026-06-16). `eval:orchestrator` 85 passed; `eval:mvp-gate` 8 passed. Vercel preview pending push.

## MVP definition

Live `/workbench` on Vercel preview: dynamic multi-turn session anchored on **CPC Passport** (`atlas.passports` capability_profile), passing **five demo scenarios** with evidence-resolving citations, smart chat vs artifact routing, no generic fallbacks.

**Canonical CPC Passport ID:** `67e68525-1da0-4301-8853-04d401107594`

## Pre-flight

```bash
npm run dev:agents   # :8000
npm run dev:ui       # :3005
curl http://localhost:8000/health
open http://localhost:3005/workbench/health
npm run eval:chat-path
npm run eval:mvp-gate
```

Env: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true`

## Five demo scenarios

### S1 — Sector deep-dive
1. "What is CPC good at in rail?"
2. "And in highways?"
3. "Compare them"

**Expect:** Orient claims scoped by sector; comparative insight; artifact updates.

### S2 — Full Sameer journey (flagship)
1. "What's CPC good at in rail?"
2. "Top opportunities for CPC in rail?"
3. "Drill into the second one"
4. "Show value translation"
5. "Should CPC pursue this?"
6. "What could go wrong?"

**Expect:** Orient → Connect → Diagnose (EVTL) → Act → Defend.

### S3 — Opportunity-first
1. "Tell me about [specific live call title fragment]"
2. "Does CPC fit?"
3. "Where are the gaps?"
4. "Worth pursuing?"

### S4 — Cross-sector transfer
1. "CPC has done work in Aviation — could it apply to Rail?"
2. "What would need adapting?"
3. "Show me as a brief"

### S5 — Defend a decision
1. "We're considering pursuing [call X] — back it up or push back"
2. "What evidence would change your mind?"

## Blocks to know

| Block | Meaning |
|-------|---------|
| ContextCard | Query + entity framing |
| ClaimLedger | Claims with evidence states |
| TransferLanes | Value translation labels |
| MatchBench | Fit/gap/risk/move per criterion |
| DimensionGap | Structured gaps |
| RecommendationConfidence | Overall tier |
| ActionPlan | Next move |
| ObjectionResponse | Defend objections |

## External search (corpus-first augmentation)

Atlas never treats web results as corpus citations. Pattern:

| Tier | When | Source | UI |
|------|------|--------|-----|
| 0 (default) | Orient / Connect / most turns | CPC Passport + Supabase only | ClaimLedger citations = real UUIDs |
| 1 (gap-triggered) | Matcher returns gaps or stale call metadata | Targeted Exa scoped to funder/sector | `ProvenanceTrace` / chat sidecar, lower tier |
| 2 (deep + gate) | User confirms research plan | Exa + GovUK MCP | Separate external evidence zone; never merged into ClaimLedger |
| 3 (defend) | Defend / falsification lane | Exa red-team queries | ObjectionResponse block |

**MVP:** deterministic builders are corpus-only; `search_external` runs only on deep LLM loop after HITL gate. Post-MVP: wire Tier-1 gap-triggered Exa on Connect freshness.

## Ready for Dayo

- [x] `npm run eval:mvp-gate` green locally
- [ ] Vercel preview `/workbench/health` all green
- [ ] All five scenarios pass on Vercel preview
- [ ] Citations resolve (real UUIDs in Supabase)
- [ ] Multi-turn memory works (follow-ups reference prior turn)
- [ ] Artifact augments across turns (not blanking each message)
- [ ] No generic "I'm Atlas workbench" menu replies on strategic queries
