# Sprint 5 — Cloud Agent orchestrator

Use this as the **single long-running Cloud Agent** instruction set when you will not be available to start the next phase manually.

---

## Operating model

1. **One Cloud Agent session** runs S5a → S5b → S5c sequentially.
2. **Subagents (`Task`)** only for parallel, non-overlapping folders (see `README.md`).
3. After each phase: run eval commands, update `gate-s5*.md`, **commit + push**, then continue if verdict is `PASS` (or `PARTIAL` where allowed).
4. **Do not** stop for human approval between phases unless `BLOCKED`.
5. **Do not** start a second Cloud Agent from within the session — the platform does not support that reliably.

---

## Branch & PR

- Branch: `cursor/sprint5-object-layer-99bd` (create from `main` if missing).
- Base PR to `main`, draft OK.
- Conventional commits: `feat(sprint5): <phase> <short description>`.

---

## Phase order

| Step | Read | Write gate |
|------|------|------------|
| 1 | `brief-s5a.md` | `gate-s5a.md` |
| 2 | `brief-s5b.md` (only if S5a PASS/PARTIAL-continue) | `gate-s5b.md` |
| 3 | `brief-s5c.md` (only if S5b PASS/PARTIAL-continue) | `gate-s5c.md` |

Spec SSOT: `08-SPRINT-5-OBJECT-LAYER.md`.

---

## Eval checklist (run every phase)

```bash
pnpm install
pnpm eval:tier1
pnpm eval:sprint5
node eval/sprint5/scripts/check-sprint5-gates.mjs
```

Optional final (S5c, secrets required):

```bash
node scripts/python-bin.mjs eval/test_artifact_contract_live.py --live
```

Record exact command output summaries in the gate file (pass counts, not prose-only claims).

---

## Gate file rules

Each `gate-s5*.md` must include:

1. `## Verdict` → exactly one of: `PASS` | `PARTIAL` | `BLOCKED` | `PENDING`
2. `## Commands run` → shell blocks with exit status
3. `## Delivered` → table path → status
4. `## Scope audit` → files touched; flag any forbidden edits (e.g. S5a touched `graph.py` → BLOCKED)
5. `## Recommendations` → non-blocking improvements (eval agent style); implementer may have filled these; orchestrator must not skip

---

## Subagent policy

When spawning `Task` subagents:

- **explore** — readonly; map files before edits.
- **generalPurpose** — one slice per subagent (e.g. "lab pages only", "block vocabulary only").
- Max **2** subagents in parallel per phase.
- Orchestrator **merges** all edits; resolves conflicts; re-runs eval before gate.

---

## Stop conditions

| Condition | Action |
|-----------|--------|
| `pnpm eval:sprint5` fails | BLOCKED, stop programme |
| S5a edited `agents/atlas/graph.py` | BLOCKED (scope violation) |
| Live gate fails, no secrets | S5c gate = PARTIAL if offline tests pass; continue only if brief allows |
| Context limit approaching | Commit push, write gate PARTIAL, stop with clear resume note |

---

## Resume after interrupt

If the job stops mid-programme:

1. Read latest `gate-s5*.md` on the branch.
2. If last gate is `PASS`, start Cloud Agent with: "Resume Sprint 5 from brief-s5b" (or c) — read `eval/sprint5/ORCHESTRATOR.md` and existing gates."

---

## Cloud Agent prompt (copy-paste)

```
You are the Sprint 5 Orchestrator for Atlas 5 (InnovationAtlas4.0).

Read and follow exactly:
- eval/sprint5/ORCHESTRATOR.md
- eval/sprint5/08-SPRINT-5-OBJECT-LAYER.md
- eval/sprint5/brief-s5a.md → brief-s5b.md → brief-s5c.md

Branch: cursor/sprint5-object-layer-99bd (create from main if needed).

Rules:
1. Run S5a, then S5b, then S5c in ONE session without asking the human between phases.
2. Use Task subagents only for parallel non-overlapping work (max 2 at a time). You merge and own the branch.
3. S5a MUST NOT edit agents/atlas/graph.py.
4. S5c ONLY phase may edit graph.py and add ATLAS_OBJECT_ROUTING_V1.
5. After each phase: pnpm install && pnpm eval:tier1 && pnpm eval:sprint5 && node eval/sprint5/scripts/check-sprint5-gates.mjs
6. Update eval/sprint5/gate-s5a.md (then b, then c) with Verdict PASS|PARTIAL|BLOCKED, commands run, scope audit, recommendations.
7. Commit and push after each phase with conventional commits.
8. Continue to next phase only if Verdict is PASS, or PARTIAL with offline complete and live explicitly deferred.
9. Stop entire programme on BLOCKED.
10. Open or update a draft PR to main with phase summary when S5c gate is written.

Do not claim work complete without running the commands. Do not fabricate test pass counts.
```

---

## Optional: eval-only follow-up job

If you want a **second** Cloud Agent after the orchestrator (human- or CI-started):

```
Read eval/sprint5/gate-s5a.md, gate-s5b.md, gate-s5c.md on branch cursor/sprint5-object-layer-99bd.
Re-run pnpm eval:tier1 && pnpm eval:sprint5.
Do not implement features. Update gates only if your verdict differs; add Recommendations section.
```
