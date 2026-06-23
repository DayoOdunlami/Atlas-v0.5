# Atlas v5 — Gen UI minimal stack (build handoff)

**Status:** Approved sequence — execute in order; do not gold-plate.  
**Method:** Turn on free composition behind a dev overlay; watch failures; harden only what the overlay proves you need.  
**Supersedes:** Installing `atlas-visual-composition` skill v2 alone (skill has nowhere to land without pieces 1–3).

---

## Problem statement

Two bugs share one root cause:

1. **Over-update** — substantive-ish chat re-posts the orient blob (same canvas, same template feel).
2. **Under-update** — conservative routing keeps canvas frozen when a patch or full recompose was right.

**Root cause:** The system decides *whether* to touch the canvas with a cheap router fork (`chat | clarify | substantive`), then always runs full skeleton assembly for substantive turns. It never asks: *chat only · hybrid · canvas-primary · patch · replace · clear · degrade to prose.*

**Architecture fix:** **Disposition sits above composition.** Composition (skill v2) runs only when disposition says canvas wins.

Reference (do not port graph): workbench `agents/orchestrator/presentation.py` — `chat_surface`: `artifact_primary | hybrid | chat_only | chat_primary`.

---

## What to build now (five pieces, strict order)

```
1. KeyedFigureIndex     ← vocabulary for merge + gate
2. merge + gate + sanitised render
3. TurnDispositionOutput
4. Install visual-composition skill + AnswerSpec canvas field
5. Dev overlay
```

**Stop after #5.** Ship behind overlay. Do not build AST compiler, two-phase deep pass, partial-patch client merge, or retry-with-feedback until overlay data says so.

---

## Piece 1 — KeyedFigureIndex

**File:** `agents/atlas_v5/keyed_figures.py`

**Job:** Deterministic namespace from `WidePassResult` + orient/connect skeleton. Raw `EvidenceBag` lists are not bindable; this is the prerequisite for `{{key}}` and `{{scale(key, policy=…)}}`.

### Canonical key schema (v1 — extend only when overlay shows gaps)

| Key | Source | Material | Notes |
|-----|--------|----------|-------|
| `stats.project_count` | SQL | owned | int |
| `stats.funding_floor_gbp` | SQL | owned | float; floor not total |
| `stats.null_funding_count` | SQL | owned | |
| `stats.org_count` | SQL | owned | |
| `stats.live_since_2024` | SQL | owned | |
| `web.programme_upper_gbp` | skeleton instrument / policy | borrowed | candidate; only if in bag or labelled candidate |
| `graph.node_count` | connect graph | owned | connect turns only |
| `graph.edge_count` | connect graph | owned | |
| `corpus.citation_count` | skeleton | owned | |
| `retrieval.external_count` | bag meta | owned | |
| `retrieval.candidate_count` | bag meta | owned | |

Each entry:

```python
@dataclass
class KeyedFigure:
    key: str
    value: float | int | str
    unit: Literal["count", "gbp", "ratio", "id", "text"]
    material: Literal["owned", "borrowed", "inferred", "absent"]
    provenance: str  # e.g. "atlas.projects aggregate"
    floor: bool = False  # under-count semantics
```

**Lane caveat (binding):** `web.*` keys (e.g. `web.programme_upper_gbp`) are **absent** when
`external_skipped` is true / lane is corpus-only. Compositions needing borrowed web figures
must **degrade honestly** (prose, single-tier, broken-axis label) — never fabricate a
`web.*` hole value. Correct degradation is not gate failure; overlay should show
`web.* absent (corpus-only lane)`.

**API:**

```python
def build_keyed_index(wide: WidePassResult, skeleton: AnswerSpec) -> KeyedFigureIndex:
    """Deterministic. Same wide+ skeleton → same keys every time."""

class KeyedFigureIndex:
    def get(self, key: str) -> KeyedFigure | None: ...
    def keys(self) -> list[str]: ...
    def as_merge_dict(self) -> dict[str, str]: ...  # display strings for {{key}} holes
```

**Tests:** `agents/test_keyed_figures.py` — J1T1 mock stats produce stable keys; connect adds graph keys; empty wide pass → empty or minimal index (feeds honest degradation).

---

## Piece 2 — Merge, gate, sanitised render

**Files:**

- `agents/atlas_v5/composition_merge.py` — fill `{{key}}` and `{{scale(key, policy=…)}}` holes
- `agents/atlas_v5/composition_gate.py` — diff rendered output vs index; reject orphans
- `agents/atlas_v5/scale_policies.py` — **scale is code, not model prose**
- `src/components/atlas/composition/composition-canvas.tsx` — sanitised render (mouth)

### Merge

- Input: raw markup string with holes + `KeyedFigureIndex`
- Replace `{{stats.project_count}}` → formatted display from index (mono formatting rules in merge, not model)
- Replace `{{scale(stats.funding_floor_gbp, policy=compressed_bar_v1)}}` → pixel/% via policy registry
- Output: merged markup + `merge_log` (key → rendered value) for overlay

### Scale policy registry (v1)

**File:** `agents/atlas_v5/scale_policies.py`

| Policy | Use | Behaviour |
|--------|-----|-----------|
| `compressed_bar_v1` | Incommensurable magnitudes | Log-ish compression; ratio > 1000× → refuse numeric width, emit broken-axis token |
| `linear_bar_v1` | Similar-order comparisons | linear map to max 320px |
| `refuse_to_scale_v1` | Any | returns `null` + honesty flag — layout only, no value-encoding |

Policies take `(value, peer_value | None, index) → ScaleResult(pixels | None, honesty_label)`.

Generalises existing `IncommensurableMagnitudes` honesty — do not duplicate bar math in React and Python long-term; v1 may delegate bar display to existing recipe when gate fails.

### Gate (deterministic — NOT model self-check)

**Reject if:**

1. **Orphan figure** — any rendered number/£/count pattern not traceable to a filled `{{key}}` in merge log
2. **Orphan scale** — any `width`/`height`/`r`/`stroke-width` representing a value without `scale(...)` binding in source markup
3. **Hand-typed scale claim** — attribute like `data-to-scale="true"` without corresponding scale binding
4. **Unknown key** — hole references key not in index
5. **Material mismatch** (v1 simple) — element `data-material="owned"` but key is `borrowed`

**Adversarial tests (required before turn-on):** `agents/test_composition_gate.py`

| Test case | Input | Expected |
|-----------|-------|----------|
| Orphan £8.17m | markup contains literal `£8.17m` not from `{{stats.funding_floor_gbp}}` | **REJECT** |
| Hand-typed scale | `width="240px"` + `data-to-scale="true"` on corpus bar | **REJECT** |
| Valid holes | all figures via `{{key}}`, scale via policy | **PASS** |
| Unknown key | `{{funding.total}}` not in index | **REJECT** at merge |
| Empty index | compose with no stats | merge returns empty; gate → **degrade** (no instrument) |

On reject: **do not render raw markup.** Fallback ladder (v1 — only two rungs):

1. Gate fail → existing reference recipe if `instrument.recipe` set on skeleton
2. Still no render → prose-only canvas (verdict + blindspot, no instrument)

No retry-with-feedback to model in v1.

### Sanitised render (pull forward — security, not quality)

**Mouth:** `composition-canvas.tsx`

- Use DOMPurify (or equivalent) with strict allowlist: `svg`, `g`, `rect`, `text`, `line`, `path`, `span`, `div`, `p`; attrs: `class`, `style`, `data-material`, `data-key`, `width`, `height`, `viewBox`, etc.
- **Deny:** `script`, `on*`, `iframe`, `foreignObject`, `href` except provenance ids
- Max markup size: 64KB; max DOM nodes: 500
- Render inside sandboxed container; no `dangerouslySetInnerHTML` without sanitise

---

## Piece 3 — TurnDispositionOutput

**File:** `agents/atlas_v5/disposition_models.py`

Decided in deep pass (same Sonnet call for v1 — one structured schema; split to two-phase
**only if overlay shows latency/quality pain**).

**Prompt ordering (binding):** In one call, the model must **resolve disposition first**
(primary_surface, canvas_action, composition_mode), then judgement fields, then
`canvas_markup` **only if** `composition_mode == free_compose`. If disposition lands on
`chat_only` / `none` / `degrade_prose`, `canvas_markup` must be **null** — never compose
for a turn that will not render canvas.

```python
PrimarySurface = Literal["chat_only", "chat_primary", "hybrid", "canvas_primary"]
CanvasAction = Literal["none", "patch", "replace", "clear"]
CompositionMode = Literal["none", "reference_recipe", "free_compose", "degrade_prose"]

class TurnDispositionOutput(BaseModel):
    primary_surface: PrimarySurface
    canvas_action: CanvasAction
    composition_mode: CompositionMode
    patch_fields: list[str] = []  # when canvas_action == "patch" — v1 may ignore patch, see deferred
    reasoning: str = ""  # dev overlay only
```

### Wiring in `run_turn_response`

```
classify (Haiku) → still cheap pre-filter for empty/greeting
       ↓
wide pass → keyed index + skeleton
       ↓
deep pass → disposition + judgement + optional canvas markup
       ↓
if disposition.canvas_action == "none" → chat reply only, update_canvas=False
if "clear" → clear canvas (existing path)
if "replace" + free_compose → merge → gate → spec.canvas or fallback recipe
if "reference_recipe" → existing assemblers (current behaviour)
```

**Port logic from** `presentation._choose_chat_surface` as **hints in prompt**, not as a Python branch that picks the visual before the model runs.

**Tests:** `agents/test_disposition.py`

- "hello" → `chat_only`, `canvas_action=none`
- "clear the canvas" → `clear`
- "state of play rail decarb" → `canvas_primary`, `replace`, `free_compose` or `reference_recipe`
- "what am I looking at?" with spec present → `hybrid` or `chat_primary`, `canvas_action=none`

---

## Piece 4 — Skill install + contract field

### Skill file

**Path:** `skills/atlas-visual-composition.md` (v2 content — disposition preamble added)

Add to skill top matter:

```markdown
## Runtime inputs (binding)
- `disposition` from TurnDispositionOutput — do not compose if composition_mode is none/degrade_prose
- `lane_mode`, `external_skipped`, `corpus_thin` from EvidenceBag meta
- `available_keys` from KeyedFigureIndex — only these keys may appear in holes
- `scale_policies` allowlist: compressed_bar_v1, linear_bar_v1, refuse_to_scale_v1
```

Inject into deep pass user block (not a separate graph node). Do not pad with rule branches — skill + evidence keys + disposition.

### AnswerSpec v0.3 field (minimal)

**TS + Python mirror:**

```typescript
canvas?: {
  markup: string;              // holes before merge; merged copy optional in envelope debug
  merged_markup?: string;      // post-merge; mouth renders this
  trust_map?: Record<string, Material>;
  scale_bindings?: Record<string, { key: string; policy: string }>;
  gate_status?: "pass" | "reject" | "fallback_recipe" | "degrade_prose";
  gate_errors?: string[];
};
```

Keep existing `instrument` for reference-recipe fallback. Mouth: if `canvas.merged_markup` passes gate → `CompositionCanvas`; else `renderInstrument(recipe)`.

### Structured output extension

Extend deep pass schema (or parallel `CompositionOutput`) with:

- `TurnDispositionOutput`
- `JudgementFieldsOutput` (existing)
- `canvas_markup: str | None` — only when `composition_mode == free_compose`

---

## Piece 5 — Dev overlay

**File:** `src/components/atlas/shell/dev-overlay.tsx`

Visible when `NODE_ENV=development` or `NEXT_PUBLIC_ATLAS_DEV_OVERLAY=1`.

Show on each turn:

| Field | Source |
|-------|--------|
| `primary_surface` | disposition |
| `canvas_action` | disposition |
| `composition_mode` | disposition |
| `route` / `route_source` | turn classifier |
| `lane_mode` / `external_skipped` | retrieval meta |
| `keys_available` | KeyedFigureIndex count + list (collapsible) |
| `gate_status` / `gate_errors` | composition_gate |
| `fallback_rung` | recipe / prose / rendered |
| `dataSource` | brain / mouth / golden |

Do not expose in production UI.

---

## Explicitly deferred (build ONLY if overlay proves need)

| Item | Trigger to build |
|------|------------------|
| **AST compiler** instead of raw HTML | Gate false-positive rate > ~10% on real turns |
| **Two-phase deep pass** (judgement ∥ compose) | Latency > 8s or compose quality poor when bundled |
| **Partial patch client merge** | Disposition uses `patch` often; full replace feels heavy |
| **Retry-with-feedback** gate rung | Gate rejects > ~30% on valid compositions |
| **Material mismatch rules v2** | Orphans caught but wrong textures slip through |
| **assistant-ui / AG-UI envelope** | REST overlay stable; then unify transport |

---

## Execution checklist for Cursor

- [x] **1.** `keyed_figures.py` + tests
- [x] **2a.** `scale_policies.py` + tests (compressed_bar_v1 at minimum)
- [x] **2b.** `composition_merge.py` + tests
- [x] **2c.** `composition_gate.py` + adversarial tests (orphan £8.17m, hand-typed width)
- [x] **2d.** `composition-canvas.tsx` + minimal sanitiser (DOMPurify optional follow-up)
- [x] **3.** `disposition_models.py`; wire `run_turn_response`; tests
- [x] **4a.** `skills/atlas-visual-composition.md` with runtime preamble
- [x] **4b.** AnswerSpec `canvas` field (TS + Python); extend deep pass output
- [x] **4c.** `run_turn` pipeline: disposition → compose → merge → gate → fallback
- [x] **5.** Dev overlay component wired in `AtlasAnswerSurface`
- [x] Run: `pytest agents/test_keyed_figures.py agents/test_composition_gate.py agents/test_disposition.py agents/test_atlas_v5_run_turn.py -q`
- [ ] Manual: overlay on, fire 4 cases (hello, clear, orient, network)

---

## Anti-patterns (this build)

- Installing skill v2 before KeyedFigureIndex exists
- Letting the model type scale dimensions without `scale(..., policy=...)`
- Using model self-check as the gate
- Building AST compiler before first sanitised HTML generation
- New LangGraph nodes for disposition or composition
- Port orchestrator `outcome_builders` / format_pass block choreography

---

## Success criteria (minimal stack done)

1. Substantive turn with overlay shows disposition + keys + gate result.
2. Orphan £8.17m in test markup is **rejected** before render.
3. Valid hole-filled markup **renders** sanitised on canvas.
4. Gate fail **falls back** to reference recipe without crashing.
5. "hello" does **not** update canvas (`canvas_action=none`).
6. Free compose can be toggled via disposition without breaking J1T1 golden stats.

---

## Related docs

- `contracts/atlas-v5/BRAIN_EXECUTION_CONTRACT.md` — cognition in functions + one deep call
- `contracts/atlas-v5/ANSWER_SPEC_V0_2.md` — extend with `canvas` for v0.3
- Workbench reference: `agents/orchestrator/presentation.py` (disposition hints only)
