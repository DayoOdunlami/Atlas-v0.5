# DESIGN_DECISIONS.md — Atlas 5 UX Sprint

Sprint date: 2026-06-01

---

## Five Governing Design Principles — Implementation Notes

### Principle 1 — The Waterfall

Every surface implements the four-level waterfall:

| Level | Implementation |
|-------|---------------|
| HEADLINE | `data-testid="*-headline-card"` — always rendered, never collapsible |
| INSIGHT | NPV waterfall chart (ACT) / terrain summary (ORIENT) / "N opportunities" (CONNECT) |
| EVIDENCE | Collapsed by default — toggle opens citation list |
| DETAIL | "Show full analysis" toggle (ACT) / "Show evidence trail" (DIAGNOSE) |

### Principle 2 — Visual weight signals confidence

`src/lib/atlas5/confidence-styles.ts` exports `getConfidenceStyles(tier)` returning:
- `container` — opacity class applied to outermost wrapper
- `body` — opacity + font weight for secondary text
- `border` — `border-dashed` (Speculative/Indicative) vs `border-solid` (Supported/Robust)
- `headline` — opacity + font weight for key numbers
- `badge` — colour class for confidence tier badge

Applied to: ACT, DIAGNOSE, ORIENT, CONNECT, DEFEND containers.

### Principle 3 — Claim states are first-class citizens

`src/components/atlas5/claim-state-badge.tsx`:

| State | Symbol | Colour | Italic |
|-------|--------|--------|--------|
| stated | ✓ | Teal | No |
| inferred | ~ | Amber | Yes |
| unknown | ? | Grey | No |
| contested | ⚠ | Red-amber | No |

Applied to: trust-rail citation rows, ACT evidence section, DIAGNOSE gap matrix, DEFEND evidence tree, ORIENT top evidence, CONNECT opportunity cards.

### Principle 4 — Charts earn their place

| Chart | Surface | Condition | Library |
|-------|---------|-----------|---------|
| NPV Waterfall | ACT | ≥ 2 NPV components present AND `npv_value` not null | Recharts `ComposedChart` |
| Domain Heatmap | ORIENT | `orient_domains.length >= 3` | ECharts via `EChartsChart` |
| Bridge score bar | CONNECT | `connect_bridge` present | Tailwind progress bar (1 data point — prose + bar) |

Fallbacks:
- ACT: if `npv_value == null`, renders prose: "NPV not available — economic case requires further evidence."
- ORIENT: if `< 3` domains, heatmap is not rendered.

### Principle 5 — Surfaces are workspaces

| Action | Type | Surface | Notes |
|--------|------|---------|-------|
| "Open in canvas →" | [NEEDS BACKEND] | ACT | Stub logs to console. Endpoint: `POST /api/atlas5/canvas/escalate` |
| "Build the Five Case for this →" | [FRONTEND] | DIAGNOSE | Switches to ACT surface via surface gateway |
| "Find opportunities →" | [FRONTEND] | ORIENT | Switches to CONNECT surface |
| "Diagnose fit →" | [FRONTEND] | CONNECT | Switches to DIAGNOSE with opportunity context |

---

## Cold Session Entry

- Visible when: `surface.thread_id === null` AND `messages.length === 0`
- Three chips: "Explore the innovation landscape" / "Assess a capability or product" / "Build an investment case"
- Chips populate input only — no auto-submit
- Component fades in with `animate-in fade-in` Tailwind class
- Component disappears as soon as first message appears in list

---

## Fixture gaps

- `FIXTURE_ORIENT` domain heatmap has 6 domains (> minimum 3) — sufficient for chart.
- `FIXTURE_CONNECT` has 4 opportunity cards (maximum 5) — sufficient.
- `FIXTURE_DEFEND` uses `confidence_tier: "Speculative"` as required to test low visual weight.
- All new fixtures have `claim_state` on all citations.
- Existing fixtures (BRIEF_FIVE_CASE, EVIDENCE_PANEL) updated with `claim_state` on all citations.

---

## Recipe routing

`artifact-pane.tsx detectRecipe()` returns the `recipe` field verbatim. New recipes `orient / connect / diagnose / act / defend` are routed in `RecipeView`:

```
recipe === "orient"    → OrientSurface
recipe === "connect"   → ConnectSurface
recipe === "diagnose"  → EvidencePanelRecipe  (DIAGNOSE = extended evidence panel)
recipe === "act"       → BriefFiveCaseRecipe  (ACT = extended Five Case)
recipe === "defend"    → DefendSurface
```

The engine sprint sets `artifact_block.recipe` to these values when live. Until then, surfaces render against static fixtures.

---

## What was NOT done

- Playwright smoke test extensions for new surfaces: the existing spec tests `/atlas5-test` which does not yet route new fixtures by name. The fixture API (`/api/atlas5/fixture`) will need to be updated to accept `orient`, `connect`, `defend` as recipe names. The FIXTURE_MAP update in `artifact-blocks.ts` is in place; the API route that reads it needs to be verified.
- Notion spec pages were not fetched — built against brief inline spec. Gap matrix structure is extensible if Notion spec contains additional fields.
- The `diagnose` recipe name is wired but the original `evidence_panel` recipe continues to work — backward compatible.
