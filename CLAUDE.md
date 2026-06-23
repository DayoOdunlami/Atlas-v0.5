# ATLAS5.md — Architecture Anchor

> **Read this at the start of every Cursor session.** Stack is locked. Do not deviate without explicit human approval.

---

## What Atlas 5 is

Atlas 5 is a multi-agent strategic intelligence platform for Connected Places Catapult (CPC). It routes user queries through four specialist LangGraph agents (ATLAS, JARVIS, CICERONE, HYVE), each loading methodology skills and calling MCP tools, surfacing evidence from a live Supabase corpus into three render modes: chat, artifact, and canvas.

**One sentence:** A CPC strategist asks a question and gets a structured brief with real corpus citations, a confidence tier, and optionally a chart or canvas scene in under 8 seconds.

**Atlas v5 runtime blueprint (peer evidence + render fork):** [`docs/ATLAS_V5_BLUEPRINT.md`](docs/ATLAS_V5_BLUEPRINT.md)

---

## Repository and branch

- **Repo:** InnovationAtlas4.0 — full clone, no partial copy
- **Branch:** `feat/atlas5-stage1` — created from main
- **Do not modify** main, brief-v2, or brief-b branches
- **Existing code stays untouched** — Brief v2, old routes, seed files remain as legacy reference
- **Atlas 5 code lives in new directories:** `/app/(atlas5)/`, `/agents/`, `/skills/`, `/eval/`
- **Brief v2 / Run 3** is superseded. Read `src/app/(brief-v2)/PLAN.md` as legacy reference only. Do not extend.
- **Absorb from Brief v2:** `pgBriefV2Repository` schema patterns (avoid migration conflicts), `seed-jarvis.ts` (JARVIS wiring reference). Discard: Tiptap editor, AI SDK chat routes, brief-b routes.

---

## Stack (locked)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 + React 19 | App router — already in repo |
| Agent runtime | LangGraph Python | Graphs only — not LangChain LCEL, not AI SDK |
| UI coordination | CopilotKit + AG-UI | useCoAgent, useCoAgentStateRender, useLangGraphInterrupt |
| LLM | Anthropic claude-sonnet-4-6 | Via Anthropic API only — not OpenAI |
| Primary database | Supabase afysgjiczzptubonbuxs eu-west-1 | atlas + hive schemas |
| Knowledge graph | FalkorDB cloud instance-zwmb4qd17 ap-south-1 | Via Graphiti MCP |
| Embeddings | OpenAI text-embedding-3-small | 1536-dim; used by all ingestion scripts and live query paths. CLAUDE.md previously listed Nomic in error — Nomic is not used anywhere in this repo. |
| Canvas surface | tldraw | Production workspace — not Excalidraw |
| Diagram tool | Excalidraw MCP | Agent-generated diagrams in briefs only |

---

## Runtime transport contract (Python ↔ Next.js)

**Pattern: FastAPI service + CopilotKit LangGraph adapter (CONFIRMED)**

```
Browser (React)
  ↕ AG-UI event stream
Next.js /api/copilotkit/route.ts  (CopilotKit runtime)
  ↕ HTTP  (LangGraph remote graph adapter)
FastAPI service  /agents/server.py  (Python, port 8000)
  ↕ LangGraph graph execution
/agents/*/graph.py  (individual agent graphs)
```

- Python agents run as a single FastAPI service (`/agents/server.py`)
- CopilotKit connects via the LangGraph remote graph adapter (not subprocess, not stdio)
- Event types: `text_delta`, `tool_call`, `tool_result`, `artifact_delta`, `canvas_action`, `interrupt`

---

## MCP invocation from Python agents

**Pattern (CONFIRMED — one pattern only, do not deviate):**

```python
from mcp import ClientSession, StdioServerParameters
from langchain_core.tools import tool

@tool
async def search_projects(query: str, k: int = 5):
    """Search CPC corpus projects by semantic similarity."""
    async with ClientSession(...) as session:
        result = await session.call_tool("search_projects", {"query": query, "k": k})
        return result
```

Single wrapper module: `/agents/mcp_client.py`. Supports both stdio and `streamable_http_client`.

---

## Four agents

**ATLAS — Innovation Strategist**
Loads: Green Book skill, evidence triage skill, analogue method skill
Calls: GovUK MCP, scenario-modeler MCP, Exa MCP
Produces: Five Case Model brief, NPV at 3.5% STPR, confidence tier

**JARVIS — Corpus Explorer**
Loads: Evidence triage skill
Calls: CPC-corpus MCP, wiki-explorer MCP
Produces: Ranked evidence with real atlas.projects IDs and similarity scores

**CICERONE — Cross-Sector Transfer**
Loads: Analogue method skill, Green Book skill
Calls: CPC-corpus MCP, Graphiti MCP
Produces: Transferability score 0-100, sector analogues, HAVE/PARTIAL/MISSING evidence gaps

**HYVE — Climate Adaptation**
Loads: Evidence triage skill
Calls: CPC-corpus MCP (hive schema queries)
Produces: Climate risk with citations and transport mode mapping

---

## Skills — storage and loading

Skills live at `/skills/*.md` in the repo root. The context assembler reads the relevant files and injects them into `context_packet.json` under `active_skills[]` before every agent run. Skills are **never** called as tools.

| File | Loaded for |
|------|-----------|
| /skills/green-book.md | ATLAS, CICERONE |
| /skills/evidence-triage.md | ATLAS, JARVIS, HYVE, CICERONE |
| /skills/analogue-method.md | CICERONE, ATLAS |

---

## HIVE citation model (resolved — locked)

HYVE cites at article level. The CPC-corpus MCP `search_hive` tool returns chunks for retrieval but the agent resolves to the parent article for citation.

```typescript
hive_citations: Array<{
  article_id: string,   // hive.articles.id — UUID, must exist in DB
  chunk_id?: string,    // hive.document_chunks.id — optional, for provenance
  title: string,        // from hive.articles.project_title (fallback: measure_title)
  score: number         // similarity score
}>
```

This decision is locked. Do not invent an alternative.

---

## JSON contracts (must be consistent across all deliverables)

**surface_state.json**
```typescript
{ mode: 'chat' | 'artifact' | 'canvas', activeAgent: 'ATLAS' | 'JARVIS' | 'CICERONE' | 'HYVE', lens: 'CPC' | 'Atlas' | 'Ecosystem' | 'Funder' | 'Mode', timestamp: string }
```

**context_packet.json**
```typescript
{ thread_id: string, lens: string, active_agent: string, brief_summary: string, prior_citations: Array<{ id: string, type: 'project' | 'article' }>, session_history: Array<{ role: string, content: string }>, active_skills: string[] }
```

**artifact_block.json**
```typescript
{ type: 'brief' | 'evidence' | 'chart', sections?: Record<string, string>, corpus_citations?: Array<{ id: string, title: string, organisation: string, score: number }>, hive_citations?: Array<{ article_id: string, chunk_id?: string, title: string, score: number }>, npv_value?: number, discount_rate?: number, confidence_tier: 'Speculative' | 'Indicative' | 'Supported' | 'Robust', chart_spec?: object }
```

**canvas_scene.json**
```typescript
{ shapes: object[], camera: { x: number, y: number, z: number }, savedAt: string }
```

---

## Canvas persistence (CONFIRMED: atlas.canvas_scenes)

Canvas scenes persist to `atlas.canvas_scenes` (NOT `atlas.blocks`).

```sql
CREATE TABLE atlas.canvas_scenes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  text NOT NULL,
  owner_id   uuid,
  scene_json jsonb NOT NULL,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

This migration is applied at D9 before canvas work begins.

---

## Environment variables (CONFIRMED naming)

```bash
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=https://afysgjiczzptubonbuxs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # server-side only, never client (existing repo convention)
EXA_API_KEY=
FALKORDB_HOST=
FALKORDB_PORT=56454
FALKORDB_PASSWORD=
PYTHON_AGENTS_URL=http://localhost:8000
```

Security check (Tier 1): `grep -r "SUPABASE_SERVICE_KEY" .next/static/` must return no results.

---

## Architecture rules (non-negotiable)

1. Skills loaded into context packet before agent runs — never called as tools
2. MCPs called via the single Python MCP invocation pattern — never improvised per agent
3. Every agent response includes confidence_tier: Speculative / Indicative / Supported / Robust
4. Every corpus citation is a real UUID verified to exist in Supabase — not just UUID format
5. Context packet assembled from Supabase state — never hardcoded strings
6. Canvas state is canvas_scene.json, persisted to atlas.canvas_scenes — never sessionStorage
7. Tests: TypeScript + Playwright (headless) for frontend, Python for LangGraph agents
8. Each deliverable owns its own tests — never deferred to D10
9. Agent refinements proposed as messages, wait for human approval before code
10. No SUPABASE_SERVICE_KEY in client-side code under any circumstances
11. All Supabase queries use explicit schema: `supabase.schema('atlas').from(...)` or `supabase.schema('hive').from(...)`

---

## What NOT to do

- Do not use OpenAI API (Anthropic only)
- Do not use AI SDK as agent runtime (LangGraph + CopilotKit + AG-UI only)
- Do not use LangChain LCEL chains (LangGraph graphs only)
- Do not reference MongoDB (not in live schema)
- Do not build custom vector store (pgvector via Supabase)
- Do not hardcode CPC data as strings — query Supabase
- Do not skip confidence_tier on any agent response
- Do not validate citations by UUID format only — verify existence in Supabase
- Do not use subprocess or stdio as the PRIMARY Python ↔ Next.js transport
- Do not merge to main without Dayo approval
- Do not use Excalidraw as canvas surface (tldraw only)
- Do not extend Brief v2 code (superseded)
- Do not expose SUPABASE_SERVICE_KEY to client bundle
- Do not use `supabase.from()` without a schema qualifier

---

## Key IDs

- Supabase project: afysgjiczzptubonbuxs (eu-west-1)
- FalkorDB instance: instance-zwmb4qd17 (ap-south-1)
- Graphiti group_id: atlas5

---

## Build order (Stage 1)

```
D0  Eval harness scaffold + env setup
D1  Next.js shell + surface gateway
D2  Context assembler
D3  CPC-corpus MCP
D4  JARVIS agent
D5  ATLAS agent
D6  AG-UI wiring
    ⚑ D6 CHECKPOINT — Dayo approval
D7  Brief artifact panel  ← wireframe required
D8  CICERONE + HYVE agents
D9  Canvas mode            ← wireframe required
D10 Eval harness consolidation
    ⚑ Tier 3 — Dayo 30-min product review
```

---

## Seam decisions (Commit 0.5 — approved by Dayo 2026-05-20)

| Seam | Decision |
|------|---------|
| Runtime transport | FastAPI + CopilotKit LangGraph remote-graph adapter |
| MCP invocation | Python `mcp` package + `@tool` wrappers, single wrapper module |
| Schema sharing | Zod (TS) → JSON Schema → Pydantic v2 (Python) via codegen |
| Citation model | atlas.projects.id (corpus), hive.articles.id (HYVE), title := project_title |
| Canvas persistence | atlas.canvas_scenes (new table, migration at D9) |
| Model string | claude-sonnet-4-6 |
| Service role key | SUPABASE_SERVICE_KEY (existing repo convention) |
