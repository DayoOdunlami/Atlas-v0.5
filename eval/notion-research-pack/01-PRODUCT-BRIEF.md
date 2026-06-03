# ATLAS — Product Brief & Outcomes

**Owner:** Connected Places Catapult (CPC)  
**Product:** ATLAS v5 — Decision Intelligence Workstation  
**Last updated:** 2026-06-03

---

## One-line definition

ATLAS is an **evidence-backed analyst workstation** for UK transport and innovation strategy — not a generic market-research chatbot or PDF generator.

---

## What makes ATLAS different

Most open-source "market research agents" produce long markdown reports from open web search. ATLAS combines:

- **Internal CPC corpus** (pgvector) + optional controlled external search
- **Verified citations** with claim states (stated / inferred / unknown)
- **Confidence tiers:** Speculative → Indicative → Supported → Robust
- **Mode-specific decision surfaces** (not one report format)
- **Structured artifacts** (JSON contract) — product owns layout and UX
- **Chat + artifact split** — dialogue in chat, durable analysis in right panel
- **Evaluation gates** — golden fixtures, parity tests, artifact contract tests

---

## North star UX

User reaches the answer in **under 3 seconds** (headline + dominant visual). Everything else supports that verdict.

---

## Artifact waterfall (mandatory order)

1. **headline** — one-sentence verdict (max ~30 words, active voice)
2. **insight_card** — 2–3 sentences: why the headline is true
3. **dominant_visual** — one primary chart/table/graph block
4. **supporting_body** — mode sections (collapsed by default)
5. **evidence_strip** — verified sources (collapsed)
6. **action** — one primary next step (escalation to next surface)

---

## Mode surfaces (analyst journey)

| Surface | User question | Typical outputs |
|---------|---------------|-----------------|
| **Orient** | What is the landscape? | Heatmap, knowledge graph, key players, CPC position |
| **Diagnose** | Can we credibly play here? What's missing? | Gap matrix, value translation, friction tags |
| **Connect** | Where are routes, partners, funders? | Options comparison, funding flow, opportunity routes |
| **Act** | What should we do / invest? | Five Case sections, NPV, radar, recommendation |
| **Defend** | Can we justify this under scrutiny? | Evidence bar, objections, claim audit |

Surfaces are **lenses**, not separate products. Users escalate: Orient → Diagnose → Connect → Act.

---

## Chat behaviour (lane-aware)

| Lane | When | Chat | Artifact |
|------|------|------|----------|
| **Clarify** | "What is NPV?", "Explain this gap" | Full conversational answer | Unchanged |
| **Refine** | "Add key players", "Sharpen headline" | Short ack + pointer | Patched in place |
| **Analyze** | New decision / cold session | Verdict + sources + tier | Full waterfall |

Chat is **not** artificially short for clarify turns. Analyze turns avoid duplicating full matrices in chat.

---

## Governance rules (non-negotiable)

- LLM fills structured fields; **product owns UX**
- No fabricated citation IDs
- Weak evidence → honest Speculative tier, not confident prose
- External web results ≠ verified corpus citations unless separately labelled
- Horsemen eval gates (honesty, attribution, CPC-inward) are **CI checks**, not runtime personality

---

## Success criteria for the product

Stakeholders should experience ATLAS as:

- A **controlled analyst template** filled by AI — like a Bloomberg/OpenBB workspace with governed outputs
- **Trustworthy** when evidence is thin ( says so explicitly)
- **Compelling** when corpus hits are strong (rich visuals + citations)
- **Multi-turn** — clarify and refine without rerunning 35-second full pipeline every message

---

## What ATLAS is NOT

- Not a replacement for Palantir or full ontology platform (yet)
- Not a slide deck generator
- Not an unconstrained deep-research PDF bot
- Not a CrewAI demo with SWOT and no citation verification
