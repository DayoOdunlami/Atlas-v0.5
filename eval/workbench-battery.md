# Workbench Agent — Expected Behaviour Battery

Use this checklist for manual QA or to extend automated evals. Each case defines
**input**, **expected route**, and **pass criteria**.

## Prerequisites

```bash
npm run dev:lg    # LangGraph on :2024
npm run dev:ui    # Next.js on :3005
```

Restart LangGraph after agent changes. Use a **new chat thread** when testing patch flow.

## Automated (no LLM)

```bash
npm run eval:workbench
node scripts/python-bin.mjs agents/test_workbench_patch.py
```

## Test cases

| ID | User prompt | Route | Chat | Artifact |
|----|-------------|-------|------|----------|
| **H1** | (open `/workbench` with no params) | — | Empty state with starter chips | Home canvas — hero + 5 starter cards |
| **H2** | (on Home) click starter `Explore the CPC corpus` chip | — | Composer fills with prompt | — |
| **H3** | (on Home) `hi` | conversational | "Hi there!" stays in chat | No card |
| **H4** | (on Home) `what is in the CPC corpus?` | explore | Short narration + "see X on canvas" | ContextCard auto-added to Home canvas with full body |
| **H5** | After H4, press Ctrl+Z | — | — | ContextCard removed |
| **H6** | (on Home) `tell me what you can do` | conversational | Short narration + pointer | ContextCard with capability summary |
| W1 | `add a SWOT on CPC to the artifact` | propose | Prose only, no JSON | ComparisonMatrix quadrant block appears; undo toast |
| W2 | `what projects are in the CPC corpus?` | explore | Short narration + pointer (Tier 1B) | ContextCard with corpus overview + citations strip |
| W3 | `why is confidence capped?` | explain | Short narration + pointer (Tier 1B) | ContextCard with explanation |
| W4 | `what is the NPV?` | economic_analysis | Prose summary | EconomicCase block OR graceful fallback |
| W5 | Pin a block → `rewrite that block` | propose | — | Hard-confirm sheet (not auto-apply) |
| W6 | After W1, press Ctrl+Z | — | — | SWOT block removed |

## Round 2 polish — visual richness + no-results suppression

| ID | User prompt | Expected | Pass criteria |
|----|-------------|----------|---------------|
| **V1** | `SWOT the UK rail innovation portfolio` | SWOT card with **rendered** bold + lists | No literal `**` characters. Quadrants colour-coded: green strengths, amber weaknesses, sky opportunities, rose threats. |
| **V2** | (on Home) `Show me maritime decarbonisation projects` (where corpus is empty for this topic) | Chat-only polite "couldn't find" message | **No card** added to canvas. Chat suggests rewording. |
| **V3** | (on Home) `what projects are in the CPC corpus?` | Corpus **table** card | ComparisonMatrix with project titles, organisations, scores. Short chat narration ("Found N projects..."). No prose dump. |
| **V4** | (after V3) inspect the card title | Clean headline | Title reads "Corpus results — what projects are in the CPC corpus?" — no mid-sentence cut, no `**`. |
| **V5** | (single-result corpus hit, e.g. very specific query) | ContextCard with markdown body | Bold, lists, headings render properly. Citation chips visible at the bottom of the card with `[icon] Title 87%`. |
| **V6** | Open `/workbench` on a wide monitor | Chat ~360px, canvas takes the rest | Canvas never feels cramped; chat caps at 28% of viewport width. |

## M3 — Stage model (Tier 2)

| ID | User prompt | Expected stage move | Pass criteria |
|----|-------------|---------------------|---------------|
| **S1** | (on match view) `add a SWOT on CPC` | `extend` | New ComparisonMatrix lands in **Focus** zone alongside existing blocks. No archived count, no branch chip. |
| **S2** | After S1, `now let's focus on next steps` | `pivot` | ActionPlan appears as the new Focus; the SWOT (and recommendation) demote to **Context** strip with reduced opacity. 200ms morph animation. |
| **S3** | After S2, `actually, let's look at maritime decarbonisation projects` | `branch` | **Amber chip** at top: "Branching to maritime decarbonisation · keep this view?" with countdown bar. Wait 3 seconds → all current focus/context blocks move to **archived** (footer count appears), new maritime ContextCard becomes sole Focus. |
| **S4** | Repeat S3 but click "Keep this view" within 3 seconds | (cancelled) | Branch chip dismisses, nothing changes on canvas, no new blocks added. |
| **S5** | After S3 succeeded, open the **stage breadcrumb** (above canvas) | restore | Click "Previous stage" link → previous composition (pre-branch) restored, toast confirms "Restored: ..." |
| **S6** | After S1, press Cmd/Ctrl+Z | undo | The SWOT add reverses; if it was a stage-role change, the role flips back. |
| **S7** | Open `/workbench` (Home) → ask anything substantive → check sidebar | — | New auto-wrapped cards land as Focus with full body. Cmd+Z removes them. |

## Pass criteria (global)

- **No raw JSON** in chat panel for any route
- **model_patch** reaches canvas via `onValues` (top-level or `last_output`)
- **Additive patches** auto-apply with sonner undo toast
- **Branch patches** show 3-sec auto-confirm chip (never instant)
- **Pivot patches** show 200ms morph animation between zones
- **Invalid block types** (e.g. `swot`) rejected with helpful message
- **Default entry** opens Home canvas (not GPS-Denied match)
- **Short answers** (greetings, ≤120 chars) stay in chat — no card spawned
- **Substantive answers** (>120 chars or with structure) become ContextCards on the canvas
- **Every patch has stage_intent + stage_narration** (defaults applied server-side if absent)
- **New blocks have role="focus"** unless agent explicitly sets otherwise

## Diagnostic shortcuts

- **Reasoning trace ticker** in chat header shows the latest active step (e.g. "Analysing proposed change")
- **Stage intent** appears in the reasoning trace once propose completes (e.g. "Stage intent: pivot")
- **Branch chip** has its own visible countdown bar — verifies the 3-sec window
- **Stage breadcrumb** above the canvas indicates how many previous stages are available

## Known limitations (not failures)

- Patches are client-side only — page refresh loses agent-added blocks
- LLM may need a second attempt on complex economic_analysis patches
- `cq.home` blocks clear when switching CQ tab (use stage breadcrumb to restore after a branch instead)
- Pivot/branch routing depends on the LLM's stage_intent decision in propose_node — explicit phrasing helps ("switch focus to", "let's look at instead of")
