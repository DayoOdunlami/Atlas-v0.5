# Atlas v5 `/atlas` — Repo alignment addendum

**Status:** GATE 0 prerequisite — authoritative over the original build brief where they conflict.  
**Scope:** `/atlas` route only. Existing workbench + `CLAUDE.md` workbench stack unchanged unless explicitly amended below.

---

## 1. Transport & UI shell

| Topic | Workbench (frozen) | `/atlas` v5 (new) |
|-------|-------------------|-------------------|
| UI runtime | CopilotKit + AG-UI | `@assistant-ui/react` + `@assistant-ui/react-langgraph` |
| API seam | `/api/copilotkit` → FastAPI remote graph | `/api/lg` or `NEXT_PUBLIC_LANGGRAPH_API_URL` → LangGraph (see `src/lib/chatApi.ts`) |
| Rule | Do not refactor | New parallel route; compare against workbench |

**Amendment to build brief:** “Park CopilotKit” means **for `/atlas` only**, not repo-wide removal.

---

## 2. Embeddings (critical — vector space must match corpus)

| Brief (drifted) | Live repo |
|-----------------|-----------|
| Nomic embeddings | **OpenAI `text-embedding-3-small`**, 1536-dim |

All ingestion scripts and live retrieval (`mcps/cpc_corpus`, semantic search) use OpenAI embeddings against the production pgvector index.

**Rule:** Any retrieval Cursor builds for `/atlas` brain or mouth bootstrap **must** use `text-embedding-3-small`. Do not introduce Nomic without a full re-embed migration plan.

---

## 3. Confidence tier (four tiers, not three)

| Brief (drifted) | Live repo |
|-----------------|-----------|
| Indicative \| Supported \| Robust | **Speculative \| Indicative \| Supported \| Robust** |

**Canonical enum** (shared): `src/lib/atlas5/types.ts`, `src/lib/atlas5/artifact-schema.ts`, `agents/spine/citation_guard.py` (`TIER_ORDER`).

**Ceiling heights** (`ConfidenceCeiling` primitive — derived from tier, not decorative):

| Tier | Ceiling fraction | Notes |
|------|------------------|-------|
| Speculative | `0.28` | New in v0.2 — below Indicative; corpus-thin / unverified |
| Indicative | `0.44` | Matches `AtlasSurface.jsx` reference |
| Supported | `0.66` | |
| Robust | `0.88` | |

**Brain enforcement:** `_cap_tier` / `apply_citation_guard` at module scope (`agents/spine/citation_guard.py`). Tier in AnswerSpec is **computed**, never decorative.

---

## 4. Citation IDs (verifiable, not theatre)

| Source | ID field | Verification |
|--------|----------|--------------|
| Corpus project | `atlas.projects.id` | UUID; must exist in Supabase (not format-only) |
| Hive article | `hive.articles.id` | UUID; article-level citation per CLAUDE.md |
| External / web | `ext-{uuid}` or url-keyed | `verification_state: candidate` — never promoted to corpus |

Reuse existing Zod shapes: `CorpusCitationSchema`, `HiveCitationSchema` in `src/lib/atlas5/artifact-schema.ts`.

---

## 5. Phase 1 bootstrap (temporary)

Phase 1 may use a **mouth-side** `buildJ1T1SpecFromQuery()` adapter that queries Supabase and assembles a valid `AnswerSpec` **without** the brain. This is throwaway proving infrastructure until GATE 2; the same Zod validator must accept both bootstrap and brain output.

---

## 6. GenUI composition (Phase 1 vs long-term)

| Phase | Composition model |
|-------|-------------------|
| **Phase 1 proving slice** | Deterministic React composer + LLM-filled prose fields + recipe slots |
| **Post–GATE 2** | Revisit generative shape selection (brain chooses instrument/recipe); do not hard-constrain in schema |

---

## 7. Unified contract (direction only — not Phase 0)

AnswerSpec as the **universal** contract for workbench + `/atlas` is a valid long-term direction. **Not in scope** until `/atlas` passes GATE 2. No workbench retrofit in Phase 0–1.

---

## 8. Brain execution (Phase 2 — not LangGraph-by-default)

See **`BRAIN_EXECUTION_CONTRACT.md`**. Summary:

- **LangGraph for:** thread state, `answer_spec_envelope` streaming, checkpoints, optional interrupt gate
- **Plain functions for:** parallel retrieval, SQL aggregates, reconcile, citation guard, validation
- **Model calls for:** verdict, shape, claims, blind-spot, tier narrative (heavy); query expansion / extraction (light)
- **Phase 2 GATE:** `run_turn()` works as a plain function first; LangGraph wrapper must emit identical AnswerSpec
