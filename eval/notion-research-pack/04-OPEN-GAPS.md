# ATLAS — Open Gaps & Backlog

**Last updated:** 2026-06-03  
**Priority for external research**

---

## P0 — Product quality (still open)

| Gap | Symptom | Desired outcome |
|-----|---------|-----------------|
| Weak-signal queries | "Strange market signals" → 0 corpus hits, Speculative, thin artifact | Controlled external scout lane OR better query expansion; honest tier preserved |
| Citation/tier mismatch | Supported language with 0–2 weak citations | Consistency guard in graph + UI badge |
| Act > Orient visually | Act has Five Case + NPV blocks; Orient can still feel less compelling on thin corpus | Better empty states + block gallery; retrieval depth for landscape queries |
| CopilotKit batching | Progress steps may arrive in bursts vs per-node | Transport-level streaming improvements OR accept workflow trace |

---

## P1 — Sprint 4B / 5 (planned, not built)

| Item | Description |
|------|-------------|
| **External scout lane** | Open Deep Research / GPT Researcher / Sigint-style workflow as subgraph after internal search; feature-flagged; separate web_citations vs corpus_citations |
| **Artifact QA panel** | UI surface showing Content/Evidence %, critical gaps (eval already conceptually knows this) |
| **Block gallery** | `/lab/blocks` — render all visual block types with golden data for regression |
| **Pin to artifact** | UI for `artifact.appendix[]` — merge chat prose into durable artifact |
| **Falsification node** | Adversarial disconfirming search after verify (Sigint pattern) |
| **Screenshot gates** | Tier-2 visual regression on 5 canonical queries |
| **Live CI gate** | `test_artifact_contract_live.py --live` in pipeline with API keys |

---

## P2 — Architecture exploration

- Schema-driven block registry (generative UI → stable components)
- Claim graph / entity passport enrichment
- GraphRAG for multi-hop CPC corpus (VeritasGraph / Citadel patterns)
- MCP allowlist + security review for new tools
- Single transport (merge CopilotKit + assistant-ui paths) — only if clear win

---

## Explicit non-goals (do not recommend without strong evidence)

- Migrating LangGraph → CrewAI / AutoGen
- Replacing ATLAS with generic market-research repo
- Unbounded open-web reports without confidence tiers
- Model chain-of-thought tokens in user-facing UI
- Second competing report format (markdown PDF as primary output)

---

## Research should answer

1. What **external lane** best fills weak-signal / open-web gap?
2. What **UI library or chat shell** improves maturity vs current CopilotKit + assistant-ui?
3. What **RAG verification** repo improves citation/claim linking?
4. What **eval harness** prevents empty/weak artifacts in CI?
5. What **low-hanging UI wins** (<1 week) beat building custom components?
