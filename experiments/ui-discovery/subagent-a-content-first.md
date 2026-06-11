# Subagent A — Content-First UI Discovery

> **Status: PASTE-ABLE PROMPT.** This document is a self-contained mission. Drop it into a fresh agent (Cursor cloud agent, another machine, ChatGPT, Claude.ai, etc.). Do not assume any prior conversation context.

---

## Mission

You are an autonomous UI/UX research agent. Your job is to **discover what visual treatments a real CPC strategist actually needs** by running 50 high-value questions through the live Atlas 5 system, capturing raw outputs, and then **designing the rendering for each answer from first principles** — as if the existing block component library did not exist.

The output of your work will be used to decide whether Atlas 5's current 14-block component library is the right shape, what's missing, what's over-engineered, and what composition patterns the agent should learn.

You are NOT here to make the existing UI prettier. That is Subagent B's job. You are here to **let the data shape the UI**, bottom-up.

---

## What Atlas 5 is (one paragraph)

Atlas 5 is a multi-agent strategic intelligence platform for Connected Places Catapult (CPC), a UK research organisation working on connected places, smart cities, and connected transport. A CPC strategist asks a question and four specialist LangGraph agents (ATLAS, JARVIS, CICERONE, HYVE) route, retrieve evidence from a live Supabase corpus (atlas + hive schemas), and produce a structured brief with citations and a confidence tier. The system renders the result in chat + a "workbench" canvas of typed blocks. Stack is locked: Next.js 15 + React 19 frontend, LangGraph Python agents, Anthropic Claude Sonnet 4.6, Supabase with pgvector, tldraw for canvas. Do not propose stack changes.

---

## Repo coordinates

- GitHub: `https://github.com/DayoOdunlami/Atlas-v0.5` (branch `main`)
- Read `CLAUDE.md` at repo root for full architecture anchor.
- Read `src/lib/workbench/atlas-render-model.ts` for the current 14 block types: `RecommendationConfidence`, `EvidenceStateSummary`, `DimensionGap`, `MatchBench`, `ClaimLedger`, `ActionPlan`, `ObjectionResponse`, `ProvenanceTrace`, `ComparisonMatrix`, `OpportunityList`, `NetworkMap`, `TransferLanes`, `ContextCard`, `EconomicCase`.
- Read `experiments/ui-discovery/golden-questions.json` for the 50 questions you will run.

---

## Available MCP servers (use these instead of building from scratch)

Your environment exposes the following MCP servers. Use them for live data retrieval, web research, and visualisation. Do NOT scrape or call APIs directly when an MCP equivalent exists.

| MCP server | Use for |
|---|---|
| `user-supabase` / `plugin-supabase-supabase` | **Primary.** Read CPC corpus from `atlas` and `hive` schemas. Always qualify schema: `.schema('atlas').from('projects')` etc. |
| `user-govuk` | 33 UK government APIs (Companies House, DfT data, ONS pass-through, etc.). Use for cross-referencing UK gov sources. |
| `user-uk-ons` | UK Office for National Statistics — population, mobility, economic stats. |
| `user-osm` | OpenStreetMap geographic data. |
| `user-exa` / `user-firecrawl` | Web search and scraping for evidence outside the corpus. |
| `user-paper-search` | Academic literature. |
| `user-mcp-server-chart` | Generate chart specs (line, bar, pie, network, etc.). |
| `user-tldraw-canvas` | Render canvas-scale visualisations. |
| `plugin-notion-workspace-notion` / `user-Notion` | Read CPC's canonical product spec if Dayo authorises access. |

If a server requires auth and isn't authenticated, log the gap and proceed with what's available. Do not block on auth.

---

## Live agent endpoint

Atlas 5's live agent backend runs via Next.js at `http://localhost:3005/api/copilotkit` (CopilotKit runtime) → FastAPI at `http://localhost:8000/agents/<agent_name>` → LangGraph graphs.

Programmatic invocation (Python):
```python
import httpx
r = httpx.post(
    "http://localhost:8000/agents/jarvis",
    json={"query": "<question text>"},
    timeout=60.0,
)
print(r.json())
```

Or hit each agent individually:
- `POST http://localhost:8000/agents/atlas`
- `POST http://localhost:8000/agents/jarvis`
- `POST http://localhost:8000/agents/cicerone`
- `POST http://localhost:8000/agents/hyve`

If the live agent backend is unavailable (firewall, no API key), **use the MCP servers directly** to assemble a comparable raw answer. Log the degradation in your output.

---

## Your workflow (sequential)

### Step 1 — Read context (~10 min)
1. Read `CLAUDE.md` and `experiments/ui-discovery/golden-questions.json`.
2. Open `src/lib/workbench/atlas-render-model.ts` and `src/components/workbench/blocks/` to understand what the system currently renders.
3. Skim `src/data/demo-fixtures/index.ts` for examples of what "good" block content looks like today.

### Step 2 — Generate raw answers (~90 min)
For each of the 50 questions (Q01–Q50):
1. Call the appropriate agent (specified in each question's `agent` field) via the FastAPI endpoint OR assemble the raw answer via Supabase MCP + GovUK MCP + Exa MCP if the agent backend is unreachable.
2. Capture:
   - Question ID and text
   - Raw text answer (LLM reasoning + conclusion)
   - Raw evidence list (whatever Supabase / GovUK / Exa returned)
   - Citations (project IDs, article IDs, URLs)
   - Any structured data the agent returned (NPV numbers, partner lists, etc.)
3. Save to `experiments/ui-discovery/runs/A/raw/<question_id>.json` with this shape:
```json
{
  "question_id": "Q01",
  "question_text": "...",
  "answer_text": "...",
  "evidence": [{"id": "...", "title": "...", "score": 0.87, "snippet": "..."}],
  "structured": { /* whatever else */ },
  "follow_on_answers": [{ "id": "Q01-f1", "answer_text": "...", "evidence": [...] }],
  "raw_quality_notes": "live agent / mcp-direct / partial / failed",
  "captured_at": "2026-06-11T17:30:00Z"
}
```
Do not skip questions. If one fails, record the failure and continue. Budget ~90 seconds per root question, ~30s per follow-on.

### Step 3 — Pattern extraction (~30 min)
After all 50 are captured, write `experiments/ui-discovery/runs/A/patterns.md`. For each question, classify the **natural shape** of the answer (your own taxonomy — invent terms as needed). Examples of shapes you might see:
- ranked-list-with-evidence
- decision-with-rationale
- network-with-clustering
- matrix-of-rows-and-columns
- timeline-with-events
- multi-step-explanation
- side-by-side-comparison
- numeric-result-with-sensitivity
- evidence-ledger
- gap-statement
- narrative-with-footnotes
- multi-block-composition (when one answer needs 2+ shapes stitched)

Then aggregate: how many questions wanted each shape? Cross-reference against the 14 existing block types. Explicitly call out:
- Shapes the existing library handles well
- Shapes the existing library handles poorly or not at all
- Block types in the library that NO question wanted
- Composition patterns (e.g. "5 questions wanted a list + a confidence chip + a NetworkMap") that the existing single-block architecture cannot express

### Step 4 — Render from scratch (~120 min)
Pick **10 questions** that span the most diverse shape categories. For each:
1. Design the rendering **as if no block library existed**. You may invent new components, layouts, animations, interactions. Free hand.
2. Implement in React + TypeScript + Tailwind. Put them in `experiments/ui-discovery/runs/A/renderings/<question_id>.tsx`. Each file should be a self-contained component that takes the captured `raw answer` as props.
3. Mount them all in `experiments/ui-discovery/runs/A/gallery/page.tsx` so they can be viewed side-by-side via `npm run dev:ui` at `http://localhost:3005/experiments/ui-discovery-a-gallery`.

Style guidance:
- Match Atlas 5's design tokens (tailwind config, neutral palette, geist font) — you are a researcher, not a brand designer.
- But you are FREE to break the 13-block component pattern if a question's answer clearly needs something different.
- Density target: 13-14px base, 16-18px headlines, max 75ch line length. (Same as the production system.)

### Step 5 — Recommendations memo (~30 min)
Write `experiments/ui-discovery/runs/A/RECOMMENDATIONS.md`:
1. **Library refactor candidates** — block types to add, merge, split, or remove.
2. **Composition layer proposal** — how should the agent compose multi-block answers? Concrete API sketch.
3. **The "Top 5 surprises"** — questions whose answer shape was wildly different from what the current library produces.
4. **The "Top 3 invariants"** — patterns that consistently worked well across many questions; these should be hardened, not changed.
5. **Specific code changes** — concrete file paths in the production codebase where work should land if Dayo approves the recommendations.

### Step 6 — Commit + push
Create branch `experiment/ui-discovery-a` from `main`. Commit your raw runs, renderings, gallery page, and memo. Push to origin. Open a draft PR titled `experiment(ui): content-first discovery — Subagent A` with the RECOMMENDATIONS.md content as the PR description.

Do NOT modify production code (`src/components/workbench/blocks/`, `src/lib/workbench/`, etc.). All your work lives under `experiments/ui-discovery/runs/A/` and `src/app/experiments/ui-discovery-a-gallery/`.

---

## Success criteria

Your work is successful if a reviewer can read your `RECOMMENDATIONS.md` and see:
- Concrete, evidence-backed answers to "are we missing block types?" and "are any current blocks dead weight?"
- 10 hand-crafted renderings that make the difference between "designed around data" and "designed top-down" feel obvious.
- A composition-layer proposal that the next sprint could implement.

You have failed if:
- You make the existing UI "prettier" (that's Subagent B).
- You skip more than 5 questions.
- You don't push code at the end.
- You modify production files.

---

## Things that will trip you up

- **CLAUDE.md constraints are non-negotiable.** Do not switch to OpenAI, AI SDK, MongoDB, Excalidraw, or Brief v2.
- **All Supabase queries must qualify the schema.** `.schema('atlas').from('projects')` or `.schema('hive').from('articles')`. Never bare `.from()`.
- **Citation discipline.** Every claim that uses corpus data must cite a real `atlas.projects.id` (UUID, exists in DB) or `hive.articles.id` (UUID, exists). Not "fake-looking UUIDs," real ones.
- **Confidence tier is mandatory** on every recommendation: `Speculative` / `Indicative` / `Supported` / `Robust`.
- **Do not expose `SUPABASE_SERVICE_KEY` to client bundle.** Only server-side use.

---

## Time budget

Total: ~5 hours of agent time. If you are running cheaply, accept lower output quality. If running on premium tier, take the full budget and produce gallery-quality renderings.
