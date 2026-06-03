# Sprint 3 — Gate Report — 2026-06-02

## Delivered

| # | Item | Status |
|---|------|--------|
| 1 | `insight_card` schema + UI | ✅ `_extract_insight_card`, LLM JSON fields, `InsightCard` in RecipeView |
| 2 | Knowledge graph render pass | ✅ 360px/420px height, scaled repulsion, hover labels |
| 3 | Live 5-query parity gate | ✅ `eval/test_parity_gate.py` (offline + `--live` via run_atlas) |
| 4 | Golden fixtures in skills | ✅ `skills/golden-{orient,diagnose,act,connect}.md` loaded per recipe |
| 5 | Showcase layout | ✅ `SurfaceMode.showcase`, toggle in artifact pane, compact surface actions |

## Tests

| Suite | Result |
|-------|--------|
| `py_compile` graph.py | PASS |
| `agents/test_citation_fallback.py` | 3/3 |
| `eval/test_parity_gate.py` | 5/5 offline |
| `eval/test_parity_smoke.py` | 5/5 offline |

## Manual verify

1. Restart `pnpm run dev` + LangGraph lab
2. Run Orient query → headline + **insight card** above heatmap/graph
3. Click **Showcase** in artifact header → full-width visuals, compact action row
4. Hover knowledge graph nodes → legible labels
5. Live gate: `agents\.venv\Scripts\python.exe eval\test_parity_gate.py --live`
