# ATLAS — Architecture & Stack

**Last updated:** 2026-06-03  
**Audience:** External researchers (no repo access)

---

## High-level diagram

```
User
  ├── Chat panel (left, ~38–40% width)
  └── Artifact panel (right, ~60–62% width — primary workspace)

Backend: LangGraph StateGraph (Python)
  ├── Turn routing: clarify | refine | analyze
  ├── Analyze pipeline: intent → recipe → corpus search → build → verify → visual blocks
  └── State: artifact_block, reasoning_trace, corpus_citations, confidence_tier

Transports (two UIs, one graph):
  ├── Production: CopilotKit + AG-UI (port 8000 agent service)
  └── Lab: LangGraph SDK + assistant-ui (/lab/langgraph)
```

---

## Orchestration

- **LangGraph** — primary orchestrator (keep unless benchmark proves clear superiority)
- **Nodes (analyze path):** extract query → classify turn → [clarify|refine|full pipeline] → classify intent → select recipe → search corpus → external evidence (conditional) → build mode response → emit partial artifact → visual recipe → verify citations
- **Session memory:** last recipe, last headline, session_has_diagnose (checkpointed)

---

## Retrieval & evidence

- **Primary:** CPC internal corpus via pgvector (projects, live calls, knowledge chunks, CPC internal tables)
- **Citation pipeline:** LLM proposes citations → filter against search results → DB verify → fallback inject top-N if LLM returns zero
- **External search:** gap-triggered (gov.uk, Exa) — never mixed into corpus_citations without review
- **Claim states:** stated / inferred / unknown on evidence items

---

## Structured artifact contract (simplified)

```json
{
  "recipe": "orient | diagnose | connect | act | defend | ...",
  "headline": "string",
  "insight_card": "string",
  "confidence_tier": "Speculative | Indicative | Supported | Robust",
  "sections": { "Landscape Overview": "...", ... },
  "corpus_citations": [{ "id", "title", "organisation", "score", "claim_state" }],
  "visual_blocks": [{ "type": "domain_heatmap | knowledge_graph | gap_matrix | ...", "data": {} }],
  "gap_rows": [],
  "orient_domains": [],
  "cpc_position": { "summary", "strongest_domain", "whitespace_domain" },
  "_run_stage": "search | build | complete",
  "appendix": []
}
```

**Visual block types today:** domain_heatmap, knowledge_graph, gap_matrix, evidence_bar, radar, npv_waterfall, sankey, options_comparison, etc. Selected by deterministic "visual recipe director" from recipe + citation count + sections.

---

## Frontend stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js, React, TypeScript |
| Styling | Tailwind, shadcn-style components |
| Charts | ECharts (primary for blocks), some Recharts legacy |
| Chat (prod) | CopilotKit + custom LabChat panels |
| Chat (lab) | assistant-ui + LangGraph streaming |
| State | Zustand artifact store shared across panes |
| Progress UX | RunProgress component from reasoning_trace (workflow steps, not LLM CoT tokens) |

---

## Progressive artifact (live build)

During analyze runs, artifact assembles in stages:

1. **search** — citation preview, source count
2. **build** — headline, insight_card, sections
3. **complete** — visual_blocks, verified citations, final tier

---

## Agents in scope

- **ATLAS** — primary decision intelligence (this document)
- **JARVIS** — corpus evidence search
- **CICERONE** — cross-sector transferability
- **HYVE** — HIVE climate case studies

---

## MCP / tools (current)

- CPC corpus search tools (internal)
- Passport loader (entity context)
- External: gov.uk search, Exa (conditional)
- Skills loaded as markdown context (surface composition, golden examples per recipe)

---

## Dual-transport constraint for researchers

Do **not** recommend replacing the entire frontend without comparing to:

- CopilotKit + AG-UI on `/`
- assistant-ui + LangGraph on `/lab/langgraph`

Recommend **adopt/adapt/ignore** relative to this setup — not greenfield chat rebuild.

---

## Integration points for external tools

External candidates should integrate as:

- LangGraph subgraph or tool node
- MCP server behind allowlist
- Benchmark-only comparison (no runtime)
- UI component/library adoption (charts, chat primitives, design system)

Never as full replacement of artifact schema or confidence model without migration plan.
