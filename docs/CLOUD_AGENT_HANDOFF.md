# Cloud agent handoff — Atlas v5 demo-ready baseline

> **For:** Cursor Cloud / autonomous agents with several hours of runway  
> **Branch:** merge `feat/atlas5-stage1` → `main` after MOT green (see below)  
> **North star:** [`docs/ATLAS_V5_BLUEPRINT.md`](ATLAS_V5_BLUEPRINT.md) — do not swap stack (LangGraph + CopilotKit + AnswerSpec)

---

## What the human is asking for

1. **A demo that works end-to-end** — entry → session → multi-turn → threads persist — recordable on video without surprise crashes.
2. **3–5 golden chains** at ~60% quality that pass MOT and look credible in a demo (curated paths, live brain).
3. **Canvas that tells one story** — not “designed header + random AI HTML tail”.
4. **Passport / case-file angle** validated as SME workflow (claims, SWOT, promote, refactor) — separate agent OK.
5. **Stop whack-a-mole** — fix root causes, add regression tests, don’t patch symptoms only.

---

## Canvas cohesion — the real issue (read first)

The canvas is **not one unified layout**. It is **stacked layers** from one `AnswerSpec`, rendered in fixed order in `atlas-answer-surface.tsx`:

| Index | Component | Source | Design system |
|-------|-----------|--------|---------------|
| 0 | Stat strip | SQL wide pass | Locked tokens (`StatStripSubordinate`) |
| 1–2 | Verdict + blindspot | Sonnet judgement | Locked (`VerdictHero`, `AnswerabilityCard`) |
| 3+ | Charts | `attach_visuals()` — query-scoped | Locked (`ChartCanvas` + ECharts) |
| 4 | **Tail block** | Recipe **OR** `free_compose` HTML | **Two different worlds** |

**Why the tail looks like “AI went off-piste”:**

- **`ATLAS_V5_FREE_COMPOSE=1` (default)** — Sonnet emits raw HTML into `canvas.merged_markup`, rendered via `CompositionCanvas` + `dangerouslySetInnerHTML`. It is **not** constrained to the same React components as the spine.
- **Recipes** (`IncommensurableMagnitudes`, `NetworkMap`, etc.) use locked React in `src/components/atlas/recipes/`.
- **`composition_policy.py`** only locks recipes when `ATLAS_V5_RECIPE_LOCK=1` (usually off).

**So the human’s observation is correct:** spine = product design; tail = generative HTML unless recipe lock wins. This is intentional in code but **not** intentional in product — fix direction below.

**Recommended fix (agent task A1):**

1. Set `ATLAS_V5_RECIPE_LOCK=1` on preview/prod for demo period **OR** disable free compose (`ATLAS_V5_FREE_COMPOSE=0`) so tail always uses recipes/templates.
2. Extend `visual_templates.py` / recipes for **defend** and **find_path** modes — don’t rely on free HTML for demo golden chains.
3. Gate `CompositionCanvas`: if markup fails design lint (fonts/colors not from token allowlist), fall back to recipe skeleton.
4. Optional: one “narrative scaffold” — every canvas ends with `soWhat` rendered in locked UI (`StatStrip`-style blocks), not only in chat rail.

**Does the canvas tell a cohesive story today?**  
Spine yes (stats → verdict → gap). Tail often no — it’s a second author. Charts are gated by `visual/opportunity.py` (story + rejection metadata) — good logic, weak integration with free-compose tail.

---

## Agent roles (can run as 3 cloud jobs)

### Agent 1 — Atlas demo & infrastructure (“bring it home”)

**Goal:** Green MOT + 5‑minute screen recording script with zero console errors.

**Commands:**

```bash
npm run dev                    # UI :3005 + agents :8000
npm run eval:baseline-v06
npm run eval:mot:brain         # → eval/out/mot-latest.md
npm run eval:mot               # Playwright — needs dev up
```

**Golden chains (define in `eval/atlas_v5_trajectories.yaml`, expect in MOT):**

| ID | Journey | Turns |
|----|---------|-------|
| G1 | Entry bootstrap | `/atlas` → type question → auto-send → canvas loads |
| G2 | Rail orient | “State of play on rail decarbonisation” |
| G3 | Connect | “Map the hydrogen supply chain ecosystem” |
| G4 | Meta defend | Existence / value proposition (CPC scope, not rail default) |
| G5 | Thread switch | Two threads in sidebar, URL `?thread=` stable, no snap-back |

**Playwright additions:**

- `MOT-0` — `/atlas?q=` mounts without ReferenceError (already added)
- `MOT-4` — thread list shows new thread after first turn saves
- `MOT-5` — no duplicate assistant bubble on bootstrap

**Shell bugs to hunt (known pain):**

- Bootstrap flash: empty canvas / “Chat-first” before spec arrives — tune copy or hold canvas until first envelope partial.
- CopilotKit remount on thread switch — URL must lead, not `setAtlasV5ThreadId` before navigation.
- Persist on Vercel — `POSTGRES_URL` + migrations applied (`npm run db:migrate:atlas`).

**Deliverables:**

- `eval/out/mot-latest.md` all green
- `docs/DEMO_SCRIPT.md` — step-by-step for recording (agent may create)
- Short screen recording or Playwright trace attached to PR

**Do not:** rebuild on Better Chat, OpenAI agents SDK, or new chat framework.

---

### Agent 2 — Answer quality & canvas cohesion

**Goal:** Golden chains read well; canvas tail matches spine.

**Read:**

- `agents/atlas_v5/deep_synthesis.py` — disposition, free_compose vs recipe
- `agents/atlas_v5/composition_policy.py`
- `skills/atlas-chart-encoding.md`, `skills/evidence-triage.md`
- `agents/eval/behavioral_grader.py`

**Tasks:**

1. For each golden chain, run brain eval and score with behavioral grader; tune prompts/disposition until ≥60% on rubric (honesty, citations, cohesion).
2. Implement **recipe-first demo mode** (env flag or per-route) for G2–G4.
3. Ensure chart `story` fields appear in UI near each chart (already in spec — wire in `ChartCanvas` if missing).
4. Chat rail on substantive turns: prepend one-line verdict from spec (reduce “generic essay” feel).

**Deliverables:**

- Updated trajectories with `reply_contains` / `min_reply_chars` tightened
- Before/after samples in `eval/out/golden-samples.md`

---

### Agent 3 — Passport / case file SME

**Goal:** Demonstrate claims lifecycle on `/atlas` case file panel (not legacy `/passport` route).

**Read:**

- `docs/ATLAS_V5_CASE_FILE_PLAN.md`
- `src/components/atlas/shell/case-file-panel.tsx`
- `src/lib/passport/claim-extractor.ts`
- `agents/atlas_v5/case_file.py`

**Scenario script:**

1. Start session, attach/create case entity.
2. Paste SME blurb → declared claims extracted.
3. Ask “SWOT for CPC” → claims merge, canvas defend mode.
4. Follow-up refactor claim → case file updates, canvas reflects.
5. Delete/archive entity — UI clears.

**Deliverables:**

- Playwright spec `eval/playwright/atlas-case-file.spec.ts` (smoke)
- Fix gaps found; do **not** revive `/passport` as primary surface (blueprint: `/atlas` only)

---

## Merge & deploy checklist

**One line of truth:** GitHub `main` → Vercel **production** (`atlas-v0-5.vercel.app`).  
Feature branches → **preview URLs** only. Local `npm run dev` → your machine (:3005).

There is no separate “production codebase” — production is whatever is on `main` after merge.

1. `npm run eval:mot` green locally.
2. PR `feat/atlas5-stage1` → `main` (production Vercel tracks `main`).
3. Vercel env: `PYTHON_AGENTS_URL`, `POSTGRES_URL`, `ANTHROPIC_API_KEY`, Supabase keys — see `CLAUDE.md`.
4. Run migrations on production DB if not done.
5. Preview smoke 10 min, then merge.

**Current branch tip:** `6a1014b` (defend canvas for meta questions, MOT-0, thread fixes).

---

## Repo swap research (only if Agent 1 fails after 8h)

**Do not swap preemptively.** If demo still unstable:

| Option | Verdict |
|--------|---------|
| CopilotKit + LangGraph (current) | Matches blueprint — keep |
| Better Chat / Vercel AI SDK chat shell | UI only; still need AnswerSpec + Python brain |
| Full greenfield Next template | Loses 6+ months corpus/routing work |

Research task: document “borrow patterns from X” (e.g. shadcn dashboard shells, tldraw canvas) — **not** replace agent runtime.

---

## Autonomy rules for cloud agents

- Follow `CLAUDE.md` stack locks.
- Every bug fix → test (pytest or Playwright or trajectory).
- Prefer recipe/template over free HTML for demo paths.
- Small PRs per agent role; one merge train to `main`.
- If blocked on env/secrets, document exact variable — don’t stub fake data in prod paths.

---

## Success = human can record this video once

1. Open `/atlas` — entry screen loads.
2. Type golden question #1 — lands on session, auto-sends, canvas builds (spine + coherent tail).
3. Follow-up turn #2 — canvas updates, thread in sidebar.
4. New thread — switch back — history intact.
5. Case file — one claim visible.
6. No white-screen, no “Application error”, no unrelated rail charts on CPC meta question.

When that works, the product is **demoable at 60%** — human judges prose quality; agents handle stability.
