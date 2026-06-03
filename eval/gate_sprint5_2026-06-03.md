# Sprint 5 — Gate Report — 2026-06-03

## Delivered

| Item | Status | Location |
|------|--------|----------|
| Diagnose empty-state banner | ✅ | `diagnose-surface.tsx` |
| `/lab/blocks` gallery | ✅ | `src/app/lab/blocks/page.tsx` |
| Artifact QA (backend) | ✅ | `agents/atlas/artifact_qa.py` |
| Artifact QA (UI panel) | ✅ | `artifact-qa-panel.tsx` → `ArtifactPane` |
| Falsification lane | ✅ | `agents/atlas/falsification.py` + graph node |
| Live CI gate | ✅ | `.github/workflows/atlas-eval.yml` |
| npm script bundle | ✅ | `pnpm eval:sprint5` |

## Graph flow (updated)

```
… → select_visual_recipe → falsification_lane → verify_citations → END
                              ↓                      ↓
                         disconfirm search      citation_guard
                                                artifact_qa
```

## Feature flags

| Env | Purpose |
|-----|---------|
| `ATLAS_FALSIFICATION_LANE_V1=true` | Enable disconfirming Tavily/Exa search |
| `ATLAS_EXTERNAL_SCOUT_V1=true` | Tavily scout (Sprint 4B) |
| `TAVILY_API_KEY` / `EXA_API_KEY` | External search providers |

Artifact QA runs **always** (deterministic, no API cost).

## Tests (offline — all pass)

```bash
pnpm eval:sprint5
# or individually:
agents\.venv\Scripts\python.exe agents\test_citation_guard.py      # 5/5
agents\.venv\Scripts\python.exe agents\test_turn_intent.py         # 5/5
agents\.venv\Scripts\python.exe agents\test_artifact_qa.py         # 2/2
agents\.venv\Scripts\python.exe agents\test_falsification.py       # 2/2
agents\.venv\Scripts\python.exe eval\test_artifact_contract_live.py
```

## CI

- **Every push/PR:** offline gate (tests + py_compile)
- **Manual live:** GitHub Actions → Atlas Eval Gate → `run_live: true` + secrets

## Manual verify

1. `/lab/blocks` — all ready blocks render golden + empty cards
2. Run analyze query on `/` — Artifact QA panel shows Content/Evidence %
3. Enable `ATLAS_FALSIFICATION_LANE_V1` + Tavily — falsification note in QA panel when findings exist
4. Diagnose thin query — `diagnose-evidence-limited` banner

## Live gate (local)

```bash
agents\.venv\Scripts\python.exe eval\test_artifact_contract_live.py --live
```
