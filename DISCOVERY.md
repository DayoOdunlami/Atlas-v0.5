# DISCOVERY.md — Atlas 5 UX Sprint

Sprint date: 2026-06-01. Pre-loaded context confirmed; key files read before building.

---

## Surface inventory

| Path | What it does | Rating | Reason |
|------|-------------|--------|--------|
| `src/app/lab/langgraph/page.tsx` | Three-column resizable shell: ThreadList + chat + artifact panels. NPV display, radar/bar charts, Five Case sections, confidence badge, decision spine. assistant-ui runtime. | **PROMOTE** | Pre-designated anchor per brief. Layout is complete and production-ready. Extended rather than replaced. |
| `src/app/test-recipes/page.tsx` | Recipe surface showcase — renders all 4 original recipes + CPC intelligence recipes + live corpus section + Visual Director section. Rich mock data. Uses ArtifactPanel + TrustRail + DecisionSpineCard from dashboard layout. | **EXTEND** | Already wires fixtures to rendered surfaces. Added new recipe blocks here for validation. |
| `src/components/atlas5/artifact-pane.tsx` | Recipe router: routes `artifact.recipe` → the correct recipe surface component. Has save brief, loading/empty states, legacy BriefView fallback. | **EXTEND** | Central dispatch point for all recipe surfaces. Added ORIENT / CONNECT / DIAGNOSE / ACT / DEFEND routes. |
| `src/components/atlas5/trust-rail.tsx` | Confidence tier bar, citation counts, lane-separated citations (Internal CPC / Official Policy / HIVE / External web), routing gaps. | **EXTEND** | Added `ClaimStateBadge` to `CitationRow` for Principle 3 compliance. |
| `src/components/atlas5/recipes/brief-five-case.tsx` | Five Case sections, NPV card, confidence badge. Simple accordion layout. | **EXTEND (ACT)** | Replaced NPV simple card with waterfall ComposedChart; added visual weight via `getConfidenceStyles`; added claim state badges; added progressive disclosure + canvas escalation stub. |
| `src/components/atlas5/recipes/evidence-panel.tsx` | Citation cards with source badge + score bar. | **EXTEND (DIAGNOSE)** | Full restructure: HeadlineCard → Gap matrix → Value translation → Entry friction → Recommended move → Escalation → Defend pack. |
| `src/components/atlas5/recipes/stats-dashboard.tsx` | Recharts chart renderer (bar/line). | **REFERENCE** | Not modified in this sprint. |
| `src/components/atlas5/recipes/scenario-stress-test.tsx` | Assumption strength tags (Fragile/Unverified/Held). | **REFERENCE** | Not modified in this sprint. |
| `src/components/atlas5/chat-pane.tsx` | Chat message list + input bar. | **EXTEND** | Added ColdSessionEntry with three prompt chips (visible when `thread_id` is null and no messages). Fades out once user messages exist. |
| `src/components/atlas5/decision-spine.tsx` | Recommendation card, tier-coloured. | **REFERENCE** | Not modified — already sufficient. |
| `src/components/lab/echarts-chart.tsx` | ECharts wrapper — Sankey, Radar, Heatmap, Gauge. | **USE** | Used by ORIENT domain heatmap. Not modified. |
| `src/components/ui/chart.tsx` | Recharts wrapper (ChartContainer, ChartTooltip). | **REFERENCE** | Not used for new surfaces — ACT waterfall uses ComposedChart from recharts directly. |
| `eval/fixtures/artifact-blocks.ts` | Shared fixture data for all recipe surfaces. | **EXTEND** | Added `claim_state` to existing fixtures; added FIXTURE_ORIENT, FIXTURE_CONNECT, FIXTURE_DEFEND (+ spine variants). |
| `src/lib/atlas5/artifact-schema.ts` | Zod schemas for artifact contract. | **EXTEND** | Added `ClaimStateSchema`, `claim_state` + `claim_rationale` to citations, new recipe types (orient/connect/diagnose/act/defend), surface-specific field schemas. |
| `src/lib/atlas5/types.ts` | TypeScript interfaces for all Atlas 5 types. | **EXTEND** | Added `ClaimState` type, new `RecipeType` values, `claim_state`/`claim_rationale` on `CorpusCitation` and `HiveCitation`. |

---

## Net-new files created

| File | Purpose |
|------|---------|
| `src/components/atlas5/claim-state-badge.tsx` | Inline badge component for 4 claim states (Principle 3) |
| `src/lib/atlas5/confidence-styles.ts` | Tailwind class sets per confidence tier (Principle 2) |
| `src/components/atlas5/recipes/orient-surface.tsx` | ORIENT recipe surface |
| `src/components/atlas5/recipes/connect-surface.tsx` | CONNECT recipe surface |
| `src/components/atlas5/recipes/defend-surface.tsx` | DEFEND recipe surface |

---

## Promoted pages

- `src/app/lab/langgraph/page.tsx` — **PROMOTE** (pre-designated): no structural changes made; new recipe surfaces flow through artifact-pane which is already wired here.

---

## Schema additions (claim_state)

The following was added to `artifact-schema.ts` and `types.ts`:

```typescript
// types.ts
type ClaimState = "stated" | "inferred" | "unknown" | "contested";

// On CorpusCitation and HiveCitation:
claim_state?: ClaimState;
claim_rationale?: string;  // tooltip text for inferred/contested
```

`claim_state` was absent before this sprint. Added before building any surface that renders claim state badges.

---

## Actions marked [NEEDS BACKEND]

| Action | Stub location | Endpoint needed |
|--------|--------------|-----------------|
| "Open in canvas →" (ACT) | `brief-five-case.tsx` `EscalationBar.handleOpenCanvas` | `POST /api/atlas5/canvas/escalate` — body: `{ artifact_block, thread_id }`, returns `{ canvas_scene_id, redirect_url }` |

---

## Actions marked [FRONTEND]

| Action | Location | Notes |
|--------|---------|-------|
| "Build the Five Case for this →" (DIAGNOSE) | `evidence-panel.tsx` `EscalationAction` | Wires to surface gateway recipe switch — no backend needed |
| "Find opportunities →" (ORIENT) | `orient-surface.tsx` | Switches to CONNECT surface |
| "Diagnose fit →" (CONNECT cards) | `connect-surface.tsx` | Switches to DIAGNOSE surface with opportunity context |

---

## Notion spec

Notion fetch was not attempted — no Notion MCP calls made. Built against the brief's inline structure spec for DIAGNOSE, which is authoritative for this sprint. If Notion pages contain additional field requirements, they should be layered on top of the gap matrix structure already in place.

---

## Design decisions for Dayo review

1. **ACT waterfall chart**: The waterfall decomposes NPV into Gross Benefits → Optimism Bias Adjustment → Net Present Value. Optimism Bias is derived as 18% of NPV (Green Book default for novel technology). The actual breakdown should come from the agent once live data is wired.

2. **DIAGNOSE gap matrix**: Structured `diagnose_gaps` array drives the matrix. For the existing `evidence_panel` fixture (which has no `diagnose_gaps`), the component gracefully falls back to the citation card grid inside a collapsible "Value translation" section.

3. **Cold session chips**: Three chips populate the input field only — they do not auto-submit. This follows the brief spec ("populate input, do not auto-submit").

4. **Speculative visual weight**: At `opacity-[0.85]` on the container, the Speculative tier difference from Robust is visible but not jarring. Consider tuning to `opacity-75` for more dramatic contrast if stakeholder feedback requires it.

5. **ECharts in ORIENT heatmap**: The domain heatmap uses a 3-row × N-column matrix (CPC Projects / Open Calls / Evidence Items per domain). Empty cells render as near-black (the low end of the `visualMap` color range). This satisfies "empty domains as hollow cells" per the brief.
