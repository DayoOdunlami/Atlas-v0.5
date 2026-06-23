# Atlas v5 — Cursor Build Brief
### Two-stack dispatch: GenUI mouth (Vercel) + LangGraph brain (Python), new `/atlas` route

**Read this whole brief before writing any code. Then execute phase by phase, halting at each GATE for approval. Do not skip ahead. Do not refactor the existing workbench — `/atlas` is a NEW parallel route; the current workbench stays untouched and working as the reference to compare against.**

---

## 0 · What you are building and the one rule that governs it

Atlas renders analytical answers for the CPC transport-innovation corpus. The product principle is absolute: **never show a claim without showing how much to trust it.** That principle is not decoration — it is the moat, and it is the reason for the single most important architectural rule in this brief:

> **GenUI owns the composition. The spine owns the contract.**
> Everything on the canvas — layout, prose, instrument choice, which blocks appear — is generated freely per answer. BUT the trust-carrying elements (confidence ceiling, provenance trace, source/trust badges, the answer-spec schema) are FIXED PRIMITIVES that GenUI *calls*, never redraws. If the model generates its own provenance badge, it will eventually be inconsistent or silently absent — and a beautiful-but-wrong answer is the one failure this product cannot survive.

Hold that line through every phase.

## Architecture (two deploys, talking over one protocol)

- **Mouth** — Next.js 15 / React 19 / ECharts, deployed on **Vercel**. The `/atlas` route, the render layer, the spine primitives, the GenUI surface. This is most of the work.
- **Brain** — Python / **LangGraph**, deployed separately (LangGraph Platform or a container — Render/Railway/Fly). The agent loop, tool-routing, corpus access, the answer-spec emission. Do NOT try to move this into Vercel API routes; LangGraph is Python and the reasoning is long-running and stateful. Vercel is wrong for it.
- **The seam** — the brain emits a typed **answer-spec** (JSON, schema in Phase 0). The mouth consumes it over the existing `@assistant-ui/react-langgraph` streaming protocol. This contract is the most important interface in the system: build it first, freeze it, both sides code to it.

```
  user → /atlas (Vercel, Next.js)
           │  assistant-ui streaming
           ▼
        LangGraph brain (Python, separate deploy)
           │  reasons, grounds from corpus + web, applies answer-quality skill
           ▼
        emits ANSWER-SPEC (typed JSON)  ──────────► render layer maps to
                                                     spine primitives + GenUI + recipes
```

## Stack (locked — do not substitute)
Next.js 15 · React 19 · ECharts · LangGraph + assistant-ui (`@assistant-ui/react-langgraph`) · Supabase (`atlas` schema, project `afysgjiczzptubonbuxs`) · Nomic embeddings · `claude-sonnet-4-6` for inference. **CopilotKit is parked — do not introduce it.** ECharts graphs are ALWAYS `layout:'none'` — never force-directed (it manufactures false density).

---

## PHASE 0 — The contract + the trust primitives (build first, smallest, unblocks everything)

Nothing renders until this exists. Keep it tiny.

**0.1 — Answer-spec schema (the brain↔mouth contract).** A TypeScript type (mouth) + a Pydantic model (brain), kept in sync. Minimum shape:
```ts
type AnswerSpec = {
  object: string;                    // "Transport decarbonisation"
  scope: string;                     // "CORPUS + WEB · 595 OBJECTS · ORIENT"
  mode: 'Orient'|'Connect'|'Diagnose'|'Act'|'Defend';
  tier: 'Indicative'|'Supported'|'Robust';   // drives the ceiling height — DERIVED, not decorative
  verdict: { sentence: string; tail: string };       // full sentence carrying nuance + condition
  stats?: { value: string; label: string; provId?: string }[];
  blindspot?: { sign: 'undercount'|'absence'; gap: string; closable?: string; secondary?: string };
  instrument?: { recipe: string; data: object };     // e.g. recipe:'NetworkMap', recipe:'IncommensurableMagnitudes'
  claims: { id: string; text: string; source: 'corpus'|'web'; trust: string; tier: string; caveat?: string }[];
  provenance: Record<string, { ref:string; scope:string; trust:'corpus'|'web'; trustNote:string; row:string }>;
  soWhat: { lookingAt:string; oneDecision:string; gate:string; primaryAction:string; turn:string };
};
```
GATE 0a: post the final schema for approval before either side builds against it.

**0.2 — The fixed trust primitives** (React components, the ONLY non-GenUI canvas pieces):
- `ConfidenceCeiling` — height derived from `tier` (Indicative 0.44 / Supported 0.66 / Robust 0.88 of frame). Physically caps the canvas.
- `ProvenanceTrace` — peel-open panel; corpus = solid green swatch, web = dashed blue. Reads from `spec.provenance[id]`.
- `TrustBadge` / `SourceBadge` — the corpus-solid / web-dashed material treatment, reused everywhere a claim appears.
- `AnswerabilityCard` — the blind-spot, torn-amber, signed by `spec.blindspot.sign` (undercount ≠ absence).

These four + the schema are Phase 0. Reference implementation for all of them: **`AtlasSurface.jsx`** (provided) — lift the component logic, NOT the inline `DATA` object.

GATE 0b: smoke-test the four primitives render in isolation against a mock spec. Halt for review.

---

## PHASE 1 — The `/atlas` route + GenUI surface against LIVE data (the proving slice)

**Build the new route `/atlas`. Leave the existing workbench alone.**

**1.1 — Shell:** the three-zone surface from the reference files — slim left/scope rail (mode pips Or·Cn·Dg·Ac·Df + object + tier badge), central canvas (60–65%) inside a `ConfidenceCeiling` frame, right so-what chat rail (30–35%). Design tokens are locked in the reference files: canvas `#FBFAF7` on page `#e7e5df`, fonts Newsreader (verdict hero) / Libre Franklin (UI) / IBM Plex Mono (numbers/provenance), epistemic palette corpus `#3F7A52` solid / web `#B6CADB` dashed / gap `#B07A2E` torn.

**1.2 — GenUI renderer:** consumes an `AnswerSpec` and composes the canvas. Hero, StatStrip, connective prose, instrument, so-what rail — all generated/placed from the spec. The renderer CALLS the Phase-0 primitives for every trust element; it does not draw them. Free composition everywhere else.

**1.3 — Live data, not literals.** Wire to Supabase `atlas` schema. The proving query is rail decarbonisation (J1T1), confirmed live this session: `atlas.projects` where `cpc_modes` ∋ rail AND `cpc_themes` ∋ decarbonisation → 55 projects, £8,172,702 known funding, 18/55 null funding (the floor), 27 live since 2024, 30 orgs, Innovate UK 36/55 & £7.9m. **Every number is a query result bound to the spec — zero hardcoded literals on the canvas.** (Schema notes that will save you time: `atlas.projects.funding_amount` is numeric and nullable; `atlas.live_calls.funding_amount` is TEXT; modes/themes are arrays `cpc_modes`/`cpc_themes`; apply `relevance_tag`/`transport_relevance_score` filters at query time.)

**1.4 — One real instrument:** render the J1T1 `IncommensurableMagnitudes` recipe (the two-tier field) from the reference. **Honesty rule, non-negotiable:** never label a visual "to scale" unless geometry is computed from the values. The two-tier field is 1,400× → labelled "axis compressed at the gap", NOT "to scale". (Contrast: a commensurable bar chart like the funding-density surface CAN say "to scale" — the rule is about the data, not the chart type. Reference: `Atlas_FundingDensity_Surface.html`.)

GATE 1: `/atlas` renders J1T1 end-to-end from live data, full spine present, honesty rule held. Halt for product review (Tier 3). This is the slice that proves the whole loop before anything scales.

---

## PHASE 2 — The brain (Python/LangGraph) emitting real answer-specs

Until now the mouth ran on a mock spec. Now build the brain to emit the real thing. **Spec:** `Atlas_Brain_Build_Spec.md` (provided) — read it; this section only states the seam.

**2.1 — Thin LangGraph shell around a strong single-agent hub.** The reasoning lives in a frontier model call inside the hub node, NOT scripted as graph logic (that's the "robotic" failure mode). The graph provides orchestration, tool-routing, state, guardrails — not cognition.

**2.2 — The hub follows the answer-quality skill** (`atlas-answer-quality-SKILL.md`, provided): hear the real task → ground from BOTH corpus and web (web mandatory for relationship/network questions) → judge the answer's shape → emit the answer-spec. The skill is the reasoning contract; the spec is its output format.

**2.3 — Register all four agents in `server.py`** (ATLAS, JARVIS, CICERONE, HYVE). Known prior bug: CICERONE and HYVE silently routed to ATLAS via `COAGENT_NAME` — verify they route distinctly. `_cap_tier` (the confidence ceiling enforcement) must live at MODULE scope in `base.py`, not nested in one agent, so the ceiling is agent-independent.

**2.4 — Confidence tier is computed, never decorative.** Cold Act session caps at Indicative; Diagnose→Act can reach Supported/Robust. The tier the brain emits drives the ceiling height the mouth renders — the contract closes the loop.

GATE 2: brain emits a valid live answer-spec for the J1T1 query; mouth renders it unchanged from Phase 1 (proves the contract holds). Halt.

---

## PHASE 3 — Promote proven recipes (only what recurrence earns)

GenUI stays the default. Promote a composition to a named recipe ONLY when it has recurred across journeys. Per the cross-journey sort (`Atlas_CrossJourney_Sort.md`, provided), recurrence is already measured:

- **`NetworkMap`** — RECURRED 5 turns / 2 journeys → promote first. ECharts `type:'graph'`, `layout:'none'`, roam, edge-width ∝ weight, provenance-in-tooltip, corpus-solid / web-dashed / absent-dotted edges. Honest-degradation ladder built in. (Reference: the `Atlas Turn 3 - NetworkMap (ECharts)` file — lift the `series` option object + tooltip formatter + the `_tryInit` availability/resize guard; strip the `DCLogic`/`x-dc` wrapper.) Check the known casing bug: `cross_modal_bridges.dominant_pair` stores modes Capitalised ("Rail") — lowercase queries return empty.
- **`SensitivityFlip`** (2 journeys), **`ClaimLedger`** (2 journeys), **`RecommendationCard`** (3 journeys) → promote as their journeys come online.
- **Candidates** (`IncommensurableMagnitudes`, `ValueBridge`, `ComparisonMatrix`) — single-journey so far. Leave as GenUI until a second class needs them. Do NOT build speculatively.

GATE 3: each promoted recipe is parameterised (props bound to live query, zero literals) and registered. Halt per recipe.

---

## Standing rules (apply in every phase)

- **Parameterise, don't lift.** The provided `.jsx`/`.html` reference files are the *picture of done*. Every literal (£8.2m, 121·0.80, node coords) is a prop bound to a live query. Never copy the hardcoded data. Never ship the Claude-Design `DCLogic`/`x-dc`/`{{ }}` harness — that is a prototype runtime, not yours.
- **ECharts always `layout:'none'`.** Force-directed is banned — it fabricates the density the network answers exist to refuse.
- **Honesty rule on every visual:** "to scale" only when geometry is computed; otherwise labelled broken/compressed axis. Degrade to prose rather than fake a shape.
- **Confidence ceiling and trust badges are primitives, not GenUI.** (The one rule from §0.)
- **Build the undo stack before any mutating canvas interaction.** Additive vs destructive tiering (auto/soft/hard) per the locked confirmation model.
- **Recon-first, halt-and-ask gates, smoke checks.** This pattern has caught real bugs at every gate. Manual approval is conditional, not optional.

## Build order (dependency-correct, one line)
Answer-spec schema + 4 trust primitives → `/atlas` shell + GenUI renderer → live J1T1 with `IncommensurableMagnitudes` → **[GATE]** → LangGraph brain emits real spec → mouth renders it → **[GATE]** → promote `NetworkMap`, then the other recurred recipes → undo stack before any mutation.

## Provided files and their role
- `AtlasSurface.jsx` — reference render for the spine primitives + the J1T1 surface (lift logic, not data).
- `Atlas_FundingDensity_Surface.html` — reference for a commensurable "to scale" instrument + the Atlas skin in plain HTML/ECharts.
- `atlas-answer-quality-SKILL.md` — the brain's reasoning contract (Phase 2).
- `Atlas_Brain_Build_Spec.md` — the LangGraph brain architecture (Phase 2).
- `Atlas_CrossJourney_Sort.md` — the recurrence evidence governing what becomes a recipe (Phase 3).
- The Atlas v5 North Star (Notion) — the why; absorb, don't render.

**Do not build the whole thing at once. Phase 0, gate. Phase 1, gate. The bigness of this brief is exactly why the gates are non-negotiable.**
