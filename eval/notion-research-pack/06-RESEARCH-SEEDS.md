# ATLAS — Research Seeds & Constraints

**Last updated:** 2026-06-03

---

## 10 research layers (cover all)

1. Backend agents / research lanes  
2. Retrieval / RAG / citation verification  
3. MCP / tools / skills  
4. UI frameworks and chat shells  
5. Generative UI patterns  
6. Dashboard / visual block libraries  
7. Analyst workspace UX references  
8. Evaluation, screenshots, artifact QA  
9. Low-hanging UX/product wins  
10. Replace vs accelerate vs benchmark vs ignore  

---

## Seed repos — backend / research

- https://github.com/langchain-ai/open_deep_research  
- https://github.com/assafelovic/gpt-researcher  
- https://github.com/zircote/sigint  
- https://github.com/bhaveshsonje/competiq  
- https://github.com/Delphictunic/ReasonGraph  
- https://github.com/PSR94/citadel  
- https://github.com/xizhilanre/compete-scope-agent  
- https://github.com/future-house/paper-qa  
- https://github.com/bibinprathap/VeritasGraph  
- https://github.com/inbharatai/phoring  
- https://github.com/argus-engine/argus-ai  

---

## Seed repos — RAG / verification / structured output

- https://github.com/bklieger-groq/RAG-verification  
- https://github.com/RZ-Logic/regulated-rag  
- https://github.com/567-labs/instructor  
- https://github.com/dottxt-ai/outlines  
- Pydantic AI (docs)

---

## Seed — UI / chat / generative UI

- CopilotKit + AG-UI protocol (docs.copilotkit.ai)  
- assistant-ui (already used in ATLAS lab)  
- Vercel AI SDK generative UI  
- LibreChat, Open WebUI (compare — likely benchmark only)

---

## Seed — design / viz / workspace

- shadcn/ui, Tremor, Nivo, Recharts, React Flow / xyflow  
- OpenBB (workspace UX reference)  
- Evidence.dev, Observable (dashboard reference)  
- LangSmith / LangGraph Studio (trace UX)

---

## Seed — orchestration (compare, don't migrate lightly)

- LangGraph (current)  
- CrewAI, Microsoft Agent Framework, LlamaIndex Workflows, Mastra, Pydantic AI  

---

## Seed — MCP

- Official MCP servers registry  
- Tavily, Exa, GitHub, browser, Supabase MCPs  
- Transport/policy/grant data sources (UK public sector)

---

## Hard constraints for researcher

- ATLAS **governed shell stays** unless benchmark proves one layer clearly inferior  
- No generic PDF report bot as replacement  
- Open-web URLs ≠ verified CPC citations  
- Preserve: surfaces, tiers, claim states, artifact waterfall, golden eval concept  
- Assume **Sprint 4 baseline shipped** (see Sprint Status page)  
- Dual transport: CopilotKit + assistant-ui — compare, don't ignore  

---

## Priority integration patterns to evaluate

1. External scout lane (feature-flagged subgraph)  
2. Artifact QA panel (post-composition)  
3. Block gallery + schema-driven renderer  
4. Falsification after verify (Sigint-style)  
5. Citation/confidence consistency guard  
6. MCP allowlist + adapter layer  

---

## Priority low-hanging fruit to evaluate

- Artifact QA badge in UI  
- Citation consistency strip  
- "Why this block appeared" tooltip  
- shadcn/Tremor card polish for empty states  
- Screenshot fixtures for 5 canonical queries  
- assistant-ui primitives vs custom chat (if stronger)  

---

## Traps to flag

- Backend-only focus  
- Orchestrator migration for demo envy  
- Full chat app that fights artifact pane  
- More chart types before empty states fixed  
- MCP without security allowlist  
- Generative UI novelty without artifact contracts  
