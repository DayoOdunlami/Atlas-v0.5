# ATLAS — Sprint Status (June 2026)

**Last updated:** 2026-06-03

---

## Sprint 4 — SHIPPED ✅

### Track A — Orient regression
- Orient surface renders collapsed supporting sections (Landscape Overview, Key Players, CPC Position, etc.) even when heatmap/graph blocks appear above
- Structured fields on artifact: `orient_domains`, `cpc_position`
- Artifact contract test suite (offline + optional live)

### Track B — Live progress & progressive artifact
- **RunProgress** — expandable workflow trace from `reasoning_trace` (not raw model thinking tokens)
- CopilotKit path syncs reasoning trace + partial artifact to shared store
- Progressive `_run_stage`: search → build → complete
- LangGraph lab path handles partial artifact updates

### Track C — Conversation doctrine
- **Turn lanes:** clarify / refine / analyze
- Clarify: full chat answer from prior artifact
- Refine: patch artifact, short chat acknowledgment
- Analyze: full pipeline unchanged
- Lane-aware chat doctrine documented
- Schema stub: `artifact.appendix[]` for future "Pin to artifact"

### UX
- Panel ratio artifact-primary: **38/62** (main app), **40/60** (langgraph lab)
- Rationale: analyst workstations bias 60–65% to analysis surface (OpenBB, Bloomberg, NotebookLM pattern)

---

## Sprint 3 — SHIPPED ✅

- insight_card in schema + UI
- Knowledge graph render pass (height, labels on hover)
- Live 5-query parity gate script
- Golden fixtures in skills (orient, diagnose, act, connect)
- Showcase layout mode on artifact pane

---

## Sprint 2 — SHIPPED ✅

- Citation fallback when LLM returns 0 citations
- Chat slim-down for analyze lane (headline + sources pointer)
- Escalation buttons (Orient→Connect, Diagnose→Act)
- Diagnose gap matrix from routing_gaps
- Horsemen / parity smoke tests

---

## Offline tests passing (as of 2026-06-03)

- Turn intent routing: 5/5
- Artifact contract helpers: PASS
- Recipe routing: PASS
- Graph compiles: PASS

---

## Do NOT re-recommend as new work (unless eval shows failure)

- Three-lane router (clarify/refine/analyze)
- RunProgress / progressive artifact
- Orient empty-card fix
- Artifact-primary panel split

Research should focus on **step-change beyond this baseline**.
