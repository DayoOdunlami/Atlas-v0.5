# Sprint 5 — Object layer (orchestrator pack)

This folder is **repo presetup** for hands-off Cloud Agent runs. It is not executable code by itself: the **orchestrator prompt** tells one agent how to run S5a → S5b → S5c in a single session, use parallel subagents safely, and write gate files between phases.

## What is set up vs what is “just a prompt”

| Artifact | Role |
|----------|------|
| `ORCHESTRATOR.md` | Master rules + **copy-paste block** for Cursor Cloud Agent |
| `08-SPRINT-5-OBJECT-LAYER.md` | Product/tech spec (scope SSOT) |
| `brief-s5a.md` / `brief-s5b.md` / `brief-s5c.md` | Per-phase implementer scope |
| `gate-s5a.md` / `gate-s5b.md` / `gate-s5c.md` | Verdict files (`PENDING` until agent runs) |
| `scripts/check-sprint5-gates.mjs` | Validates gate markdown format (`pnpm eval:sprint5:gates`) |

**Not included (platform limit):** auto-starting a *second* Cloud Agent when phase 1 ends. Unattended flow = **one orchestrator job** that continues on `PASS`, or GitHub automation you add later.

## Quick start (travel / unattended)

1. Create branch: `git checkout -b cursor/sprint5-object-layer-99bd` (or let the agent create it).
2. Open **Cursor → Cloud Agent** on that branch.
3. Paste the prompt from `ORCHESTRATOR.md` § **Cloud Agent prompt (copy-paste)**.
4. Ensure Cloud Agent secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `POSTGRES_URL` / Supabase (needed for S5c live routing tests only).
5. Agent runs S5a → gate → S5b → gate → S5c → final gate; commits and pushes each phase.

## Commands (every phase)

```bash
pnpm install
pnpm eval:tier1
pnpm eval:sprint5
```

S5c additionally (if secrets present):

```bash
node scripts/python-bin.mjs eval/test_artifact_contract_live.py --live
```

## Gate verdicts

- **PASS** — phase acceptance met; orchestrator may continue to next phase.
- **PARTIAL** — offline OK, live blocked (missing secrets) or advisory failures only; orchestrator continues only if brief allows.
- **BLOCKED** — stop pipeline; document fix in Recommendations.

## Parallel subagents (safe boundaries)

| Parallel OK | Serial only |
|-------------|-------------|
| `skills/*.md` | `agents/atlas/graph.py` (S5c only) |
| `eval/fixtures/*`, `eval/sprint5/*` | Same TS file edited by two agents |
| New block types in `block-vocabulary.ts` + matching renderer (one owner) | S5a + S5c both touching graph |
| `/lab/objects`, `/lab/stakeholder-maps` pages | `select_recipe` / routing before S5c |

## Related docs

- Prior sprint gate (trust lanes): `eval/gate_sprint5_2026-06-03.md`
- Eval harness: `eval/README.md`
- Architecture: `CLAUDE.md`, `eval/notion-research-pack/02-ARCHITECTURE.md`
