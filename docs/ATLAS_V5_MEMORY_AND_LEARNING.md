# Atlas v5 — Memory, learning, and recipe promotion

> **Status:** Phase 1–2 shipped in code; Phase 3+ planned.  
> **Depends on:** `atlas.threads` + `atlas.turns` (see `ATLAS_V5_SESSION_PERSISTENCE_PLAN.md`).

---

## What works now (A + B)

| Capability | Behaviour |
|------------|-----------|
| **Turn persist** | After each completed turn (chat or canvas), client POSTs user message, assistant reply, `answer_spec`, `layout_signals` to Postgres. |
| **Resume** | `?thread=<uuid>` rehydrates chat + last canvas from stored turns. |
| **Session memory (agent)** | On resume, `session_history` is injected into co-agent state; chat/clarify routes use it in prompts. Live turns still use LangGraph `messages` + in-memory checkpoint. |
| **Delete** | Soft-delete (archive) via DELETE `/api/atlas/threads/[id]`; trash icon on session rail. |
| **Visual accountability** | Charts hidden when `visual_suppressed`; visible charts show **Supports verdict** caption from `chart.story` / role. |

**Local dev:** persistence auto-enables when `POSTGRES_URL` is set and `NODE_ENV=development` (unless `ATLAS_V5_THREADS_DEV_OPEN=0`).

---

## Memory model (recommended)

```
┌─────────────────────────────────────────────────────────┐
│  Within session (live)                                   │
│  LangGraph messages + answer_spec_envelope per thread_id │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Across refresh / device (Postgres)                      │
│  atlas.turns → rehydrate UI + session_history → agent    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Cross-session strategist memory (future)                │
│  Summaries + prior_citations in context_packet — not raw │
│  turn replay as live evidence                            │
└─────────────────────────────────────────────────────────┘
```

**Rule:** Persisted turns are **snapshots for resume and learning** — never treat prior turn figures as live corpus data on a new substantive query (wide pass must re-fetch).

---

## Learning from stored turns (Phase 3+)

Each turn already stores `layout_signals`:

- `instrument_recipe`, `composition_mode`, `markup_hash`, `keyed_key_count`, outcome hints

**Planned pipeline:**

1. **Harvest** — batch job over `atlas.turns` where `route=substantive` and `answer_spec` not null  
2. **Cluster** — group by `(outcome_hint, instrument_recipe, layout_signals.markup_hash)`  
3. **Promote** — human-approved clusters → eval golden cases + optional recipe locks  
4. **Reuse pattern** — agent receives *similar past layout* as hint, not copied numbers; wide pass + gate unchanged  

**Not automatic yet:** the AI does not auto-reuse prior answers. That requires eval gates before promotion (see blueprint §16 eval memory).

---

## Next implementation steps

| Step | Effort | Value |
|------|--------|-------|
| LangGraph Postgres checkpointer (durability across agent restart) | Medium | Agent memory survives Railway deploy |
| Append `session_history` on each live turn (client) | Small | Resume-quality context without reload |
| Admin export: anonymised turn corpus for recipe mining | Medium | Learning loop |
| Eval: `layout_signals` → golden trajectory per decision surface | Medium | Prove reuse safely |

---

## Voice (separate track)

STT on SoWhatRail input → same persist path. Full duplex voice (LiveKit) is a new transport — see `thread.tsx` placeholder only.
