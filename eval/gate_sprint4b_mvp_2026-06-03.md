# Sprint 4B MVP — Gate Report — 2026-06-03

## Delivered

| Week | Item | Status |
|------|------|--------|
| 1 | Route swap: `/` = assistant-ui; `/lab/copilotkit` = CopilotKit; `/lab/langgraph` → redirect `/` | ✅ |
| 1 | `citation_guard` module + integration in `verify_citations` | ✅ |
| 1 | Citation guard badge in `ArtifactPane` | ✅ |
| 1 | Extended canonical queries (5) in `eval/test_artifact_contract_live.py` | ✅ |
| 2 | `search_tavily` in `agents/external_search.py` | ✅ |
| 2 | `external_scout` via `ATLAS_EXTERNAL_SCOUT_V1` in `external_evidence_search` | ✅ |
| 2 | `external_citations` on `artifact_block` when scout/gov/exa runs | ✅ |
| 2 | Orient “Evidence limited” empty state | ✅ (if patch applied) |
| 3 | Demo script `eval/demo_script_sprint4b.md` | ✅ |

## Architecture

```
/                          → AtlasWorkspace (assistant-ui + LangGraph SDK)
/lab/copilotkit            → CopilotKit lab shell
/lab/langgraph             → redirect → /

Graph: … → verify_citations → citation_guard → artifact_block
Scout: search_corpus → external_evidence_search (Tavily if flag + thin corpus)
```

## Citation guard rules

| Corpus citations | Max tier |
|------------------|----------|
| 0 | Speculative |
| 1–2 | Indicative |
| 3–4 | Supported |
| 5+ | Robust |

Strong headline language softened when tier ≤ Indicative.

## Feature flags

| Env | Default | Purpose |
|-----|---------|---------|
| `ATLAS_EXTERNAL_SCOUT_V1` | off | Tavily scout on thin corpus / landscape gap |
| `TAVILY_API_KEY` | — | Required when scout enabled |
| `EXA_API_KEY` | — | Existing gap-triggered Exa lane |

## Tests (offline)

```bash
agents\.venv\Scripts\python.exe agents\test_citation_guard.py
agents\.venv\Scripts\python.exe agents\test_turn_intent.py
agents\.venv\Scripts\python.exe eval\test_artifact_contract_live.py
agents\.venv\Scripts\python.exe -m py_compile agents\atlas\graph.py
```

## Manual verify checklist

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | `/` loads assistant-ui + artifact pane | Primary shell |
| 2 | `/lab/copilotkit` loads CopilotKit | Lab preserved |
| 3 | Orient UK CAT | RunProgress + headline + sections |
| 4 | Citation guard | Tier capped when citations thin |
| 5 | Clarify “What is NPV?” | Chat only, artifact unchanged |
| 6 | Refine “Add key players” | Artifact patches |
| 7 | Weak signals + scout flag | External citations in trust rail OR honest Speculative |
| 8 | Panel ratio | ~38–40% chat / 60–62% artifact |

## Live gate (requires API keys)

```bash
agents\.venv\Scripts\python.exe eval\test_artifact_contract_live.py --live
```

## Known gaps / Sprint 5

- Offline recipe routing advisory for weak-signal + connect queries (director heuristic ≠ final recipe)
- `/lab/blocks` gallery not built
- Full `artifact_QA` panel deferred
- `falsification_lane` deferred
- CopilotKit prod path not removed — lab only

## MVP decision

**GO for stakeholder demo** on `/` once manual checklist passes and live gate run on queries 1–2–4 minimum.
