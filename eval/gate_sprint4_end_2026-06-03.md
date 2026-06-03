# Sprint 4 — Gate Report — 2026-06-03

## Delivered

| Track | Item | Status |
|-------|------|--------|
| A | Orient collapsed sections (Landscape, Key Players, CPC Position, …) | ✅ |
| A | `orient_domains` + `cpc_position` on `artifact_block` | ✅ |
| A | `eval/test_artifact_contract_live.py` (offline + `--live`) | ✅ |
| B | `RunProgress` component (expandable workflow trace) | ✅ |
| B | CopilotKit `MainLayout` → `reasoning_trace` + progressive artifact sync | ✅ |
| B | Progressive `_run_stage`: search → build → complete | ✅ |
| B | LangGraph lab `onValues` partial artifact handling | ✅ |
| C | `classify_turn_intent` + clarify / refine / analyze lanes | ✅ |
| C | `handle_clarify` / `handle_refine` graph nodes | ✅ |
| C | `skills/surface-composition.md` lane-aware chat doctrine | ✅ |
| C | `artifact.appendix[]` schema stub (pin-to-artifact backlog) | ✅ |
| UX | Panel ratio 38/62 (`/`) and 40/60 (`/lab/langgraph`) — artifact-primary | ✅ |

## Tests (offline)

| Suite | Result |
|-------|--------|
| `py_compile agents/atlas/graph.py` | PASS |
| `agents/test_turn_intent.py` | 5/5 |
| `eval/test_artifact_contract_live.py` (offline) | PASS |

## Architecture notes

### Turn lanes
```
extract_query → classify_turn_intent
  clarify  → handle_clarify  → END (chat prose, artifact unchanged)
  refine   → handle_refine   → END (patch artifact, short chat ack)
  analyze  → reset_analyze_state → classify_intent → … full pipeline
```

### Progressive artifact
- `search`: citation preview + `_run_stage: search`
- `build`: headline + insight + sections (`emit_build_partial` node)
- `complete`: visual_blocks + verified citations in `verify_citations`

### Panel width rationale
Analyst workstations (Bloomberg Terminal, OpenBB, NotebookLM) bias **60–65%** to the
analysis surface; chat is dialogue, artifact is the durable record. Was 58/42 chat-heavy.

### Backlog (not in sprint)
- `artifact.appendix[]` UI — "Pin to artifact" from chat
- External scout lane (Sprint 4B)
- Live artifact contract gate in CI (`--live` requires API keys)

## Manual verify

1. Restart `pnpm run dev` + LangGraph lab (`python -m langgraph_cli dev`)
2. **Orient UK CAT** — artifact shows RunProgress steps; headline appears before verify finishes; Orient card has collapsed sections
3. **Follow-up:** "What is NPV?" after Act brief → clarify lane (long chat, artifact unchanged)
4. **Follow-up:** "Add key players" after Orient → refine lane (artifact patches, short chat ack)
5. **Showcase toggle** — still works with progressive build
6. **Panel resize** — artifact column wider by default; drag handle still works
7. Live gate: `agents\.venv\Scripts\python.exe eval\test_artifact_contract_live.py --live`

## Appendix schema stub

```typescript
appendix?: Array<{
  id: string;
  title: string;
  content: string;
  source?: "chat" | "user";
  pinned_at?: string;
}>;
```

Future UI: "Pin to artifact" on assistant chat messages merges into `appendix[]`.
