# Atlas v5 — Brain execution contract

**Status:** GATE 0a prerequisite — read before Phase 2 brain work.  
**Supersedes:** silent inference that `evidence_pipeline.py` / orchestrator graph nodes *are* the intelligence.

---

## The one rule

> **Functions and model calls by default. LangGraph only where a graph property is genuinely required. Cognition is never graph logic.**

If a step does not need **durable state**, **retry/resume**, **branching control flow**, or **streaming partial state to the UI**, it is a plain async function — not a graph node.

---

## What went wrong in the workbench (the trap)

The existing `agents/orchestrator/graph.py` encodes **judgment as control flow**: triage → outcome routing → deterministic builders → format pass → presentation. That produced reliable plumbing but **robotic answers** — the graph decided the shape of the answer instead of the model.

**`/atlas` must not repeat this.** Reuse retrieval *functions* from Phase F; do not port the orchestrator’s node-per-outcome pattern.

---

## What LangGraph is actually good at (honest test)

| Property | Atlas need? | Verdict |
|----------|-------------|---------|
| **Streaming partial state** to assistant-ui (`answer_spec_envelope` partial → final) | Yes | **Keep** — envelope on thread state |
| **Durable state / resume** across multi-turn sessions | Yes | **Keep** — thread checkpoints |
| **Deterministic guardrails** (tier cap, citation UUID verify) | Yes | **Keep** — Python functions; may be invoked from one graph node |
| **Branching** (user interrupt, confirm gate) | Later | Optional thin nodes |
| **Parallel corpus ‖ web retrieval** | Yes | **Does not need graph** — `asyncio.gather` / `retrieval_fabric.py` |
| **Verdict, shape, reconciliation, blind-spot** | Yes | **Must not be graph** — one heavy model call |

**Conclusion:** LangGraph is the **transport + state shell** for `/atlas`, not the brain. Build like a capable agent first; wrap only the seams that need persistence and streaming.

---

## Default execution shape (build like Claude, not like orchestrator)

```
User query
    │
    ├─► WIDE PASS (parallel, mostly deterministic + light model)
    │     • corpus search (Supabase / semantic)
    │     • web search (GovUK + Exa) in parallel
    │     • optional light model: query expansion, per-source extract, tag corpus vs web
    │     → EvidenceBag + aggregates (SQL counts, funding sums)
    │
    ├─► RECONCILE (deterministic Python)
    │     • merge lanes, conflict notes, tier caps
    │     → reconciliation { notes, retrieval }
    │
    ├─► DEEP PASS (single heavy model call — THE cognition)
    │     • input: evidence bag + reconciliation + answer-quality skill
    │     • output: AnswerSpec JSON (verdict, shape, claims, instrument choice, blindspot)
    │     • NOT scripted as if/else graph branches
    │
    └─► VALIDATE + STREAM (deterministic + envelope)
          • Pydantic/Zod validate AnswerSpec
          • apply_citation_guard (module scope)
          • publish answer_spec_envelope revision to thread state
          • chat_complement = complement only (may be same heavy call or small follow-up)
```

This is **gather → think → emit**. One turn, one deep synthesis. No outcome-specific builder nodes.

---

## Light / heavy model concert (required)

| Tier | Role | Examples |
|------|------|----------|
| **Light** (fast/cheap) | Wide, parallelisable work | Query expansion, snippet extraction, source tagging, summarising N web hits, classifying lane mode |
| **Heavy** (Sonnet-class) | Single irreducible judgment | Verdict sentence, instrument/recipe choice, corpus-vs-web reconciliation narrative, signed blind-spot, tier justification |

**Rule:** The heavy model runs **once per substantive turn** for synthesis (unless user asks a trivial clarify). The light model may run **many times in parallel** during the wide pass.

Do not default to one model doing everything — slower and worse. Do not split synthesis across five graph nodes — robotic.

---

## What to reuse vs ignore from the repo

| Reuse (plumbing) | Ignore for `/atlas` brain (cognition) |
|------------------|----------------------------------------|
| `retrieval_fabric.py` — parallel EvidenceBag | `orchestrator/graph.py` node_loop outcome routing |
| `evidence_pipeline.py` — fetch → reconcile → meta | `outcome_builders.py` per-outcome deterministic models |
| `reconcile.py` | `format_pass.py` / `presentation.py` block-id choreography |
| `spine/citation_guard.py` | Triage-as-product-logic beyond clarify/deep flag |
| `answer-quality` skill | Four separate agent graphs as default |

Phase 2 may register a **single** LangGraph graph (e.g. `atlas_v5`) — not four agents — unless product explicitly requires agent switcher on day one.

---

## Justify every graph node (Cursor checklist)

Before adding a LangGraph node, document:

1. Which of the four properties it needs (state / retry / branch / stream)
2. Why a function called from a single `run_turn()` is insufficient

**Rejected reasons:** “repo convention”, “orchestrator already does this”, “outcome is connect so connect node”.

---

## Phase 2 minimum graph (suggested)

```
START → run_turn (async function, not 12 nodes)
          └─ internally: wide → reconcile → deep → validate → return state patch
END
```

Optional later: `interrupt` node for confirm gate; `router` for clarify-only short path.

**Do not** start Phase 2 by copying `agents/orchestrator/graph.py`.

---

## Relationship to AnswerSpec v0.2

- **AnswerSpec** = what the mouth renders (contract)
- **This doc** = how the brain produces it (execution)
- **LangGraph** = thread state + assistant-ui streaming carrier

The envelope in AnswerSpec v0.2 is the streaming seam that *does* justify LangGraph. The verdict field is what *must not* be produced by graph branches.

---

## Anti-patterns (explicit)

- Encoding outcome (Orient/Connect/…) as separate graph subgraphs with different builder logic
- “Presentation composer” or “format pass” deciding dominant visual before the model sees evidence
- Skipping web pass because corpus returned rows
- Promoting web evidence to `corpus_citations`
- Adding graph nodes without naming which graph property they need

---

## Build order (brain)

1. **`run_turn()` as a plain Python function** — wide + deep + validate; test with J1T1 without LangGraph
2. **Wrap in thinnest LangGraph graph** — one node calling `run_turn`, state holds envelope + messages
3. **Wire assistant-ui** — stream envelope revisions
4. **Add nodes only on pain** — interrupt, resume, multi-turn carriedFrom

GATE 2 passes when (2) emits the same AnswerSpec as (1) for J1T1.
