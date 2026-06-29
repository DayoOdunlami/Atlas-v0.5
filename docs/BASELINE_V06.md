# Baseline v0.6 — working `/atlas` (bug bar, not blueprint)

This is **not** a new product phase. It is the minimum bar before merging `feat/atlas5-stage1` → `main`.

## Must work (human)

1. **Entry handoff** — type on `/atlas`, land on session, question **auto-sends** (no retype).
2. **Thread switch** — sidebar click changes URL once and **stays** on that thread.
3. **New question** — creates a new thread; old threads remain in sidebar.
4. **Reload** — `/atlas?thread=<id>` restores chat + last canvas from Postgres.
5. **Save** — sidebar shows Saved after a turn (not Save failed / Save off).

## Must pass (automated)

```bash
npm run eval:baseline-v06
```

| Check | What it proves |
|-------|----------------|
| Vitest thread-navigation + layout | URL helpers, turn index math |
| pytest persist + routing | Postgres turn write, persona→chat route |
| Trajectories V01 + V02 | Greeting chat-only; rail orient + follow-up |

## Not in baseline (blueprint delta)

Case File Phase 2+, matcher UX, trust T6 research lane, production auth hardening.

## Cloud agent remit (optional, after baseline green)

Browser E2E on preview URL; screenshot UX issues; fix P0 only; file `BASELINE_V06_REPORT.md`.
