# Atlas v5 — Session persistence, history UI, and turn logging

> **Status:** Plan — ready to build  
> **Scope:** One foundation (threads + turns) serving product (resume, history sidebar) and future optimisation (layout harvesting).  
> **Out of scope (later):** Cluster/promote recipes from logged layouts; CopilotKit E2E on Vercel preview.

---

## Problem

Today `/atlas/session`:

- CopilotKit `thread_id` lives in **sessionStorage** only — lost on new device, unclear after refresh.
- **No thread list** — “New question” rotates id and sends user to `/atlas` entry.
- LangGraph uses **MemorySaver** — agent state dies on Railway restart.
- Chat (CopilotKit messages) and canvas (`AnswerSpec`) are not **persisted together**.
- Legacy tables (`atlas.briefs`, `atlas.canvas_scenes`) target old shapes — **do not repurpose**.

---

## Goal

Claude/Cursor model:

| Concept | Implementation |
|---------|----------------|
| **Thread** | One strategist conversation (`atlas.threads`) |
| **Turn** | User message + assistant reply + `answer_spec` snapshot + dev meta (`atlas.turns`) |
| **UI** | Collapsible history column + canvas + SoWhatRail chat |
| **New chat** | New thread row + new CopilotKit thread id |
| **Resume** | Select thread → load turns → hydrate canvas + chat |
| **Logging** | Same turn write includes `layout_signals` for future recipe promotion |

**Trust rule:** Persist snapshots for resume; never reuse prior turn figures as live data. Shape hints (later) route to recipes; numbers always from this turn’s wide pass.

---

## Architecture

```
Browser (/atlas/session?thread=<uuid>)
  ├ AtlasThreadSidebar     ← GET /api/atlas/threads
  ├ AtlasAnswerSurface     ← answer_spec from co-agent or GET …/threads/[id]
  └ SoWhatRail             ← CopilotKit messages (+ hydrate from turns on load)

Next.js API (auth via getSession)
  ├ POST /api/atlas/threads
  ├ GET  /api/atlas/threads
  ├ GET  /api/atlas/threads/[id]
  └ POST /api/atlas/threads/[id]/turns   ← idempotent append per turn_index

Python (agents/atlas_v5)
  └ finalize_turn / synthesize_turn → optional POST persist (or client posts after co-agent sync)

Postgres (atlas schema)
  ├ atlas.threads
  └ atlas.turns
```

**Write path (choose one primary — recommend client + server validation):**

1. **Client write (v1):** `AtlasClientShell` detects envelope `status: final` → POST turn + PATCH thread title.
2. **Agent write (v1.1):** Python `persist_turn()` behind `ATLAS_V5_TURN_PERSIST=1` for eval/trajectory parity.

Both can coexist; single source of truth is Postgres.

---

## Database

**Migration:** `supabase/migrations/YYYYMMDD_atlas_v5_threads_turns.sql`

### `atlas.threads`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Same as CopilotKit / LangGraph `thread_id` |
| owner_id | uuid | From `getSession().user.id` |
| title | text | First query truncated or async-generated |
| lens | text | Default `CPC` |
| created_at | timestamptz | |
| updated_at | timestamptz | Bump on each turn |
| archived_at | timestamptz | Nullable — soft delete |

Indexes: `(owner_id, updated_at DESC)`.

### `atlas.turns`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| thread_id | uuid FK → threads.id | |
| turn_index | int | 0-based, unique per thread |
| user_message | text | |
| assistant_reply | text | |
| route | text | chat \| substantive \| … |
| outcome_hint | text | Nullable |
| answer_spec | jsonb | Full snapshot; null for chat-only |
| answer_dev_meta | jsonb | route, stage_ms, disposition, gate |
| layout_signals | jsonb | See below |
| latency_ms | int | Nullable |
| created_at | timestamptz | |

Unique: `(thread_id, turn_index)`.

### `layout_signals` (jsonb on each turn)

```json
{
  "composition_mode": "free_compose",
  "instrument_recipe": "OpportunityList",
  "visual_form": "swot",
  "markup_hash": "sha256…",
  "markup_bytes": 4200,
  "keyed_key_count": 12,
  "gate_status": "pass",
  "fallback_rung": "rendered"
}
```

Optional later: `markup_skeleton` (structure with keys redacted) for clustering — not required for v1.

**RLS:** Owner can read/write own threads; service role for agent writes if needed.

**Do not use:** `atlas.briefs`, `atlas.canvas_scenes` for this feature.

---

## API routes

All under `src/app/api/atlas/threads/` — pattern matches `src/app/api/atlas/health/route.ts` (nodejs runtime, `getSession`).

| Method | Path | Behaviour |
|--------|------|-----------|
| POST | `/api/atlas/threads` | Create thread `{ id?: uuid }` — default generate uuid; set owner |
| GET | `/api/atlas/threads` | List for owner, `?limit=50`, order `updated_at desc` |
| GET | `/api/atlas/threads/[id]` | Thread + turns (or turns paginated) — verify owner |
| POST | `/api/atlas/threads/[id]/turns` | Append turn — validate monotonic `turn_index` |
| PATCH | `/api/atlas/threads/[id]` | Update title / archive |

**Library:** `src/lib/atlas/thread-store.ts` — pg Pool (same as canvas route) or Supabase service client with explicit `schema('atlas')`.

---

## Python hooks

| File | Change |
|------|--------|
| `agents/atlas_v5/graph_nodes.py` | `finalize_turn` / `synthesize_turn` — include `turn_index` in pipeline if needed |
| `agents/atlas_v5/persist_turn.py` | **New** — build turn payload + layout_signals from spec/dev_meta |
| `agents/atlas_v5/run_turn.py` | Optional persist after response when env set |

Env: `ATLAS_V5_TURN_PERSIST=0` (default off in dev until migration applied).

---

## Frontend

### New components

| Component | Path | Role |
|-----------|------|------|
| `AtlasThreadSidebar` | `src/components/atlas/shell/atlas-thread-sidebar.tsx` | Collapsible list, New question, relative time |
| `AtlasSessionLayout` | `src/components/atlas/shell/atlas-session-layout.tsx` | Grid: `[sidebar?] canvas rail` |

Reuse ideas from:

- `src/components/atlas5/atlas-workspace.tsx` — panel collapse
- `src/components/ui/sidebar.tsx` — icon collapse mode
- **Not** `workbench/app-sidebar.tsx` CQ nav

### Modified files

| File | Change |
|------|--------|
| `src/app/atlas/session/page.tsx` | Accept `?thread=` and `?q=`; pass `threadId` to shell |
| `src/components/atlas/atlas-client-shell.tsx` | Create thread on first send; persist on final envelope; load on mount |
| `src/components/atlas/atlas-answer-surface.tsx` | Wrap in session layout with sidebar |
| `src/components/copilotkit-provider.tsx` | Sync thread id from URL / thread store, not only sessionStorage |
| `src/lib/atlas/session.ts` | Add `ATLAS_V5_ACTIVE_THREAD_KEY`; deprecate query-only rotation |
| `src/components/atlas/shell/atlas-session-nav.tsx` | New question → create thread + navigate |

### URL contract

| URL | Meaning |
|-----|---------|
| `/atlas` | Entry — new question |
| `/atlas/session?thread=<uuid>` | Resume thread |
| `/atlas/session?thread=<uuid>&q=…` | New thread bootstrap (create + first message) |

---

## Build phases

### Phase 0 — Gate (parallel, no persistence code)

- [ ] Run `python -m atlas_v5.calibration_eval` — record ship/tune/broken for cal_04, cal_05
- [ ] Confirm agent online locally + preview (`/api/atlas/health` ok)
- [ ] Document baseline `stage_ms` with `bench_turn_stages.py`

**Exit:** Known voice quality before layering infra.

---

### Phase 1 — Database + write path (no UI)

**Deliverables**

1. Migration `atlas.threads` + `atlas.turns`
2. `thread-store.ts` + POST turn API
3. Client: on `answer_spec_envelope.status === 'final'`, POST turn (fire-and-forget)
4. Create thread on first user message if none in URL

**Tests**

- `src/lib/atlas/thread-store.test.ts` — turn_index monotonic
- Python `agents/test_persist_turn.py` — layout_signals extraction

**Exit:** Rows appear in DB after a substantive CopilotKit turn.

---

### Phase 2 — Resume + CopilotKit sync

**Deliverables**

1. GET thread + turns API
2. On load `?thread=`: fetch turns → set spec from last substantive turn → hydrate chat messages in SoWhatRail
3. Set CopilotKit `threadId` from URL (replace sessionStorage-only)
4. Pass `thread_id` through co-agent state for case file persist (`ATLAS_V5_CASEFILE_PERSIST`)

**Tests**

- Trajectory eval: same thread_id across turns, reload simulation via `run_turn` + stored spec

**Exit:** Refresh page restores canvas + chat for same thread.

---

### Phase 3 — History sidebar UI

**Deliverables**

1. `AtlasThreadSidebar` — collapsed by default, sessionStorage `atlas-sidebar-open`
2. GET threads list on mount; highlight active
3. Click thread → `router.push(/atlas/session?thread=…)`
4. New question → POST thread + navigate (stay in session layout, optional blank canvas)

**Tests**

- Playwright: create two threads, switch between, canvas differs

**Exit:** Claude-like history column without breaking canvas/rail proportions.

---

### Phase 4 — LangGraph durability (optional but recommended)

**Problem:** MemorySaver lost on restart.

**Options (pick one)**

| Option | Pros | Cons |
|--------|------|------|
| A. Postgres checkpointer | True agent state resume | LangGraph setup work |
| B. Rehydrate from `atlas.turns` only | Simpler — spec + messages enough for v5 | Co-agent internal state may differ |
| C. Hybrid | Turns for UI; checkpointer later | Two sources temporarily |

**Recommendation:** **B for v1** (turns rehydrate UI); **A in Phase 4b** if tool/state replay needed.

---

### Phase 5 — Production smoke

- [ ] Playwright extend `eval/agui_wiring.spec.ts` → `/atlas/session`, send message, assert persist API called
- [ ] Preview: `PYTHON_AGENTS_URL` + migration applied on Supabase
- [ ] Tier-1: no `SUPABASE_SERVICE_KEY` in client bundle

---

### Phase 6 — Layout harvesting (later — gated)

**Prerequisites:** Phase 1 logging live + N≥50 substantive turns + calibration green

1. Offline script: cluster `layout_signals` + optional markup skeleton
2. Promote recurring shapes → recipes / `visual_templates`
3. `ATLAS_V5_RECIPE_LOCK` per promoted fingerprint — shape routing only

**Not in v1 scope.**

---

## Parallel work (safe on unverified 1B)

| Work | Safe? | Why |
|------|-------|-----|
| Migration + turn POST | Yes | Records only |
| Sidebar UI with list | Yes | Read path |
| Recipe promotion | No | Changes composition |
| FREE_COMPOSE=0 default | No | Changes UX — A/B separately |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| CopilotKit messages ≠ persisted turns | Hydrate rail from turns on load; CopilotKit for live send only |
| Duplicate turn writes | Idempotent `(thread_id, turn_index)`; client tracks last persisted revision |
| Auth null in dev | Dev bypass route or allow anonymous threads with flag (dev only) |
| Large answer_spec jsonb | Cap stored markup; layout_signals hash instead of full HTML in v1 |
| Legacy table confusion | Document “do not use briefs/canvas_scenes” in migration COMMENT |

---

## Success criteria

| # | Criterion |
|---|-----------|
| 1 | User refreshes `/atlas/session?thread=X` — canvas + chat restored |
| 2 | “New question” creates new thread; old thread still in sidebar |
| 3 | Each substantive turn produces one `atlas.turns` row with `layout_signals` |
| 4 | No regression on calibration trajectories (route/gates) |
| 5 | Sidebar collapses; canvas remains primary reading surface |

---

## File checklist (implementation order)

```
supabase/migrations/YYYYMMDD_atlas_v5_threads_turns.sql
src/lib/atlas/thread-store.ts
src/lib/atlas/layout-signals.ts
src/app/api/atlas/threads/route.ts
src/app/api/atlas/threads/[id]/route.ts
src/app/api/atlas/threads/[id]/turns/route.ts
agents/atlas_v5/persist_turn.py
agents/test_persist_turn.py
src/components/atlas/shell/atlas-thread-sidebar.tsx
src/components/atlas/shell/atlas-session-layout.tsx
src/components/atlas/atlas-client-shell.tsx          (modify)
src/components/atlas/atlas-answer-surface.tsx        (modify)
src/components/copilotkit-provider.tsx               (modify)
src/app/atlas/session/page.tsx                       (modify)
docs/ATLAS_V5_SESSION_PERSISTENCE_PLAN.md            (this file)
```

---

## Environment

```bash
# Enable thread API in local dev without Supabase auth session:
ATLAS_V5_THREADS_DEV_OPEN=1
ATLAS_V5_DEV_OWNER_ID=00000000-0000-0000-0000-000000000001  # optional

# Python optional server-side persist (client POST is primary):
ATLAS_V5_TURN_PERSIST=0
```

Apply migration:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260622_atlas_v5_threads_turns.sql
```

Run tests:

```bash
npm run eval:v5-threads
```

| Phase | Effort |
|-------|--------|
| 0 Gate | 0.5 day |
| 1 DB + write | 1–2 days |
| 2 Resume | 1–2 days |
| 3 Sidebar UI | 1 day |
| 4 LangGraph durability | 1–2 days (optional) |
| 5 Smoke | 0.5 day |

**Total v1 (phases 0–3 + 5):** ~4–6 days focused work.

---

## Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Legacy tables | Fresh `threads`/`turns` | Same as claims spine — purpose-built |
| Workbench shell | Don't reuse | CQ product, stub history |
| Layout pattern | atlas-workspace collapse + Atlas tokens | Proven mechanics, correct visual language |
| Logging | Column on turns | Free byproduct of persistence |
| Recipe promotion | Phase 6 | Behaviour change — needs data + verified voice |
