# Subagent B — Composition Variants

> **Status: PASTE-ABLE PROMPT.** This document is a self-contained mission. Drop it into a fresh agent (Cursor cloud agent, another machine, ChatGPT, Claude.ai, etc.). Do not assume any prior conversation context.

---

## Mission

You are an autonomous UI/UX research agent. Your job is to take Atlas 5's **existing 14-block component library as a fixed constraint** and explore **3 different stylistic and compositional variants** of the workbench. Run the same 50 high-value CPC strategist questions through each variant, then produce a side-by-side comparison so a human reviewer can decide which direction Atlas 5's UI should adopt.

You are NOT here to invent new block types. That is Subagent A's job. You are here to **explore the design space within the existing components** — different typography systems, layouts, density, hierarchy, animation, interactions, and composition rules.

The output of your work will be used to pick a UI direction for Atlas 5 v0.6.

---

## What Atlas 5 is (one paragraph)

Atlas 5 is a multi-agent strategic intelligence platform for Connected Places Catapult (CPC), a UK research organisation working on connected places, smart cities, and connected transport. A CPC strategist asks a question and four specialist LangGraph agents (ATLAS, JARVIS, CICERONE, HYVE) route, retrieve evidence from a live Supabase corpus, and produce a structured brief with citations and a confidence tier. The system renders the result in chat + a "workbench" canvas of typed blocks. Stack is locked: Next.js 15 + React 19 frontend, LangGraph Python agents, Anthropic Claude Sonnet 4.6, Supabase with pgvector, tldraw for canvas. Do not propose stack changes.

---

## Repo coordinates

- GitHub: `https://github.com/DayoOdunlami/Atlas-v0.5` (branch `main`)
- Read `CLAUDE.md` at repo root for architecture anchor.
- Current production workbench lives in `src/components/workbench/` and `src/app/workbench/page.tsx`.
- Current demo (8 pre-baked scenarios) at `src/app/workbench/demo/page.tsx` + `src/data/demo-fixtures/index.ts`.
- The 14 block components are in `src/components/workbench/blocks/`. Do not change their props or output schema.
- Read `experiments/ui-discovery/golden-questions.json` for the 50 questions you will use to populate each variant.

---

## Available MCP servers

Same allowlist as Subagent A. You primarily need:
- `user-supabase` for raw answer generation (to populate variants with real content).
- `user-mcp-server-chart` for chart specs inside blocks.
- `user-Notion` if you can authenticate, to read CPC design language documents.

Web research (`user-exa`, `user-firecrawl`) is allowed for inspiration only — do NOT copy any external company's design wholesale. Take patterns, not chrome.

---

## The 3 variants

You will build three side-by-side stylistic forks of `/workbench/demo`. Each fork loads the same demo fixtures but renders them with a completely different design system.

### Variant 1 — Focus (Linear-inspired)
- **Hypothesis:** The current UI overwhelms with parallel blocks. Strategists need *one* answer at a time, with crisp typography, dense single-screen layouts, and deliberate progressive disclosure.
- Single primary block at any given time, others collapsed to chips at the top.
- Keyboard-driven navigation between blocks (J/K, arrow keys).
- Greys-and-accent palette, no decoration. 14px base, 18px headlines, 20px h1.
- Cmd-K palette for jumping between blocks and questions.
- Inline citations as superscript numbers; footnote panel slides up.
- Route: `/workbench/demo?variant=focus` and `experiments/ui-discovery/runs/B/focus/`

### Variant 2 — Narrative (Notion-inspired)
- **Hypothesis:** Strategists want to *read* a report, not parse a dashboard. The chat + canvas split is the wrong metaphor — it should be one continuous document with inline interactive elements.
- Single scrolling document. Each block embedded inline at the point in the narrative where it's referenced.
- Block components compress to inline cards inside paragraphs.
- "Outline" panel on the left with auto-generated h1/h2/h3 from block headlines.
- Chat slides in from the right; questions append paragraphs to the document.
- Serif headlines (e.g. Charter / Lora), sans-serif body, 16px base, 22px headlines.
- Route: `/workbench/demo?variant=narrative` and `experiments/ui-discovery/runs/B/narrative/`

### Variant 3 — Dense Console (Stripe / Bloomberg-inspired)
- **Hypothesis:** Power users want maximum information density. The current UI wastes screen real estate on whitespace and chrome.
- Multi-column grid (3-4 columns at xl), all blocks visible simultaneously, no scrolling primary blocks.
- Sticky filter bar at top: lens chips, agent chips, route mode chip, citation density.
- Tables wherever possible, not cards.
- Mono accents on numbers and IDs. 12px base, 14px labels, 16px headlines.
- Live evidence ticker on the right (last 10 citations added).
- Route: `/workbench/demo?variant=dense` and `experiments/ui-discovery/runs/B/dense/`

---

## Your workflow

### Step 1 — Read context (~15 min)
1. Read `CLAUDE.md`, `experiments/ui-discovery/golden-questions.json`.
2. Run `npm install` and `npm run dev:ui`. Open `http://localhost:3005/workbench/demo`. Click through all 8 demo scenarios. Understand the **baseline** before you change it.
3. Inspect the existing 14 block components in `src/components/workbench/blocks/`. Note their props interfaces.

### Step 2 — Populate variants with real data (~60 min)
The current `src/data/demo-fixtures/index.ts` has 8 scenarios. You need ~20-25 to give each variant enough content to evaluate. Extend the demo fixtures by running questions from `golden-questions.json` through the live agent (or via Supabase MCP direct retrieval if backend unreachable). Add new fixtures to `experiments/ui-discovery/runs/B/fixtures/` (do not modify the production `src/data/demo-fixtures/index.ts`).

Cover diverse shapes:
- 4 portfolio-diagnosis questions (Q01, Q03, Q05, Q07)
- 4 sector-entry questions (Q09, Q11, Q12, Q14)
- 3 evidence-triage questions (Q17, Q19, Q21)
- 3 gap-analysis questions (Q23, Q25, Q26)
- 3 economic-case questions (Q29, Q31, Q32)
- 3 knowledge-graph questions (Q34, Q36, Q38)
- 2 cross-sector-transfer (Q39, Q41)
- 2 climate-adaptation (Q44, Q47)
- 2 strategic-decision (Q48, Q50)

### Step 3 — Build each variant (~3-4 hours per variant)
Each variant is implemented in its own folder under `src/app/experiments/ui-discovery-b/<variant>/`. Each variant must:
1. Re-use the existing 14 block components (import from `src/components/workbench/blocks/`).
2. Implement its own shell, layout, navigation, typography, and composition rules.
3. Load the same 20-25 demo fixtures.
4. Be fully functional — keyboard navigation works, filters work, animations work.
5. Pass the density audit (`npm run eval:workbench`).

### Step 4 — Side-by-side comparison page (~45 min)
Build `src/app/experiments/ui-discovery-b/compare/page.tsx`:
- Top: a single question selector. Choose any of the 20-25 fixtures.
- Below: three viewports (33% each) showing the SAME question in the three variants simultaneously.
- Above each viewport: variant name + hypothesis tagline.
- Below each viewport: empty space for a reviewer to type comments (use a local-state textarea; no persistence needed).

### Step 5 — Evaluation memo (~45 min)
Write `experiments/ui-discovery/runs/B/EVALUATION.md`:
1. **For each variant**, the strongest 3 questions where it shines and the weakest 3 where it falls down.
2. **Cross-cutting findings** — patterns that worked in all 3, patterns that worked in none.
3. **Recommended direction** — which variant should v0.6 adopt as the default? Defend it.
4. **Migration cost estimate** — for the recommended variant, what production files need to change and how much work.
5. **Hybrid proposal** — could the best ideas from all 3 combine into something better than any one?

### Step 6 — Commit + push
Create branch `experiment/ui-discovery-b` from `main`. Commit all three variants, the compare page, the new fixtures, and the EVALUATION.md. Push to origin. Open a draft PR titled `experiment(ui): composition variants — Subagent B` with the EVALUATION.md content as the PR description.

Do NOT modify the production `/workbench` or `/workbench/demo` routes. All work lives under `experiments/ui-discovery/runs/B/` and `src/app/experiments/ui-discovery-b/`.

---

## Success criteria

Your work is successful if a reviewer can:
- Open `/experiments/ui-discovery-b/compare?q=Q03` and immediately see three meaningfully different treatments of the same SWOT answer.
- Read your EVALUATION.md and understand which variant to bet on for v0.6 and why.
- See concrete code that can be lifted into production if a variant is chosen.

You have failed if:
- All three variants look similar (you've held back on the differences).
- You invent new block types (Subagent A's job).
- You skip more than 5 of the 20-25 question fixtures.
- You don't push code at the end.
- You modify the production workbench routes or `src/data/demo-fixtures/index.ts`.

---

## Things that will trip you up

- **CLAUDE.md constraints are non-negotiable.** Same as Subagent A.
- **The density audit (`eval/density-audit.test.ts`) enforces minimum typography.** If you go below 11px on labels or 14px on body in any variant, the build will fail. Pass the audit per variant.
- **Block components have fixed props.** Don't fork them. Wrap, compose, or restyle around them. If you genuinely cannot achieve a variant without forking a block, document why in EVALUATION.md and flag it for Subagent A's library refactor proposal.
- **Avoid look-alike copying.** "Linear-inspired" means *crisp keyboard-driven density* — not a Linear clone. Same for Notion and Stripe.

---

## Time budget

Total: ~6-8 hours of agent time. Each variant gets ~2-3 hours. The comparison page and memo together are ~2 hours.
