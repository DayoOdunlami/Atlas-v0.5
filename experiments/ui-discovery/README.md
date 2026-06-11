# UI Discovery — Parallel Subagent Experiment

> Two subagents in parallel, each with a different remit, both using real Supabase corpus data via MCP. Goal: surface what Atlas 5's UI should actually look like, evidence-backed, not guessed.

---

## TL;DR

| | Subagent A | Subagent B |
|---|---|---|
| Remit | **Content-first** — let answer shape drive UI | **Composition-first** — fix the library, vary the composition |
| Constraint | None — free to invent new block types | The 14 existing blocks are fixed |
| Question budget | All 50 root + follow-ons | 20-25 selected root questions |
| Variants | 10 hand-crafted bespoke renderings | 3 stylistic forks (Focus / Narrative / Dense) |
| Deliverable | `RECOMMENDATIONS.md` — library refactor proposal | `EVALUATION.md` — pick the v0.6 direction |
| Branch | `experiment/ui-discovery-a` | `experiment/ui-discovery-b` |
| Time | ~5 hours | ~6-8 hours |

The two outputs are **complementary, not competing**. A tells you what shapes are missing from the library; B tells you which composition + style of the existing library wins. Merge findings → v0.6 spec.

---

## Files in this folder

| File | Purpose |
|---|---|
| `README.md` | This file. Coordinates both subagents. |
| `golden-questions.json` | 50 high-value CPC strategist questions + follow-ons. Shared input to both subagents. |
| `subagent-a-content-first.md` | **Paste-able prompt** for Subagent A. Self-contained. |
| `subagent-b-composition-variants.md` | **Paste-able prompt** for Subagent B. Self-contained. |
| `runs/A/*` | Subagent A outputs (created by the agent itself) |
| `runs/B/*` | Subagent B outputs (created by the agent itself) |

---

## How to launch

You have three options for running these.

### Option 1 — In-Cursor parallel subagents (recommended; runs locally with your MCPs)

In a fresh Cursor chat, two calls in the same message:

```
Task: Subagent A — Content-First UI Discovery
Read experiments/ui-discovery/subagent-a-content-first.md and execute it end-to-end. Use all MCP servers available. Push to branch experiment/ui-discovery-a. Open a draft PR.

Task: Subagent B — Composition Variants
Read experiments/ui-discovery/subagent-b-composition-variants.md and execute it end-to-end. Use all MCP servers available. Push to branch experiment/ui-discovery-b. Open a draft PR.
```

Run both in background mode so you can keep working. Each will message you on completion with a PR link.

### Option 2 — Cursor cloud agent (recommended for fire-and-forget, runs without your laptop)

```bash
# Subagent A
cursor agent create \
  --repo DayoOdunlami/Atlas-v0.5 \
  --branch main \
  --prompt-file experiments/ui-discovery/subagent-a-content-first.md \
  --name "subagent-a-content-first"

# Subagent B
cursor agent create \
  --repo DayoOdunlami/Atlas-v0.5 \
  --branch main \
  --prompt-file experiments/ui-discovery/subagent-b-composition-variants.md \
  --name "subagent-b-composition-variants"
```

(Cloud agents have a separate MCP allowlist — verify Supabase + GovUK + Exa are enabled on your cloud agent profile before launching.)

### Option 3 — External agent (ChatGPT, Claude.ai, another machine)

The two subagent prompt files are self-contained. Open the GitHub repo at `https://github.com/DayoOdunlami/Atlas-v0.5/blob/main/experiments/ui-discovery/subagent-a-content-first.md` and copy the entire markdown into your chosen agent. Same for B.

Note: external agents will not have your local MCP allowlist. They'll be limited to whatever tools they can reach (typically web search and `git` only). That degrades the quality of "real Supabase data" runs — they'll have to use the live HTTP endpoint at `http://localhost:8000/agents/<agent>` if your laptop is reachable, OR generate synthetic answers and flag them as such.

---

## Prerequisites before launching

1. **Local dev environment running** (only required for in-Cursor subagents that need real agent backend):
   ```powershell
   cd c:\Dev\atlas5-clone-dashboard
   npm run dev    # starts UI on :3005 + agents on :8000
   ```

2. **Corpus tier verified** — hit `http://localhost:3005/api/health` and confirm transport tier is at least `rest-rpc` (tier 2). Tier 3 (`rest-ilike` keyword fallback) still works but answers will be lower quality. Tier `unavailable` means subagents should switch to web-research fallback via Exa/Firecrawl.

3. **MCP servers authenticated** — check the Cursor MCP panel. At minimum `user-supabase` and `user-govuk` should be green.

4. **Repo is up to date on GitHub** — both subagents clone from `main`.

---

## Outputs you should expect

After both subagents complete:

```
experiments/ui-discovery/runs/
├── A/
│   ├── raw/Q01.json … Q50.json
│   ├── patterns.md              # shape taxonomy + frequency
│   ├── renderings/Q*.tsx        # 10 hand-crafted bespoke renderings
│   ├── gallery/page.tsx         # mounted at /experiments/ui-discovery-a-gallery
│   └── RECOMMENDATIONS.md       # library refactor proposal
└── B/
    ├── fixtures/                # 20-25 extended demo scenarios
    ├── focus/                   # variant 1 implementation
    ├── narrative/               # variant 2 implementation
    ├── dense/                   # variant 3 implementation
    └── EVALUATION.md            # variant comparison + v0.6 recommendation
```

Plus two draft PRs on GitHub, both targeting `main` for review.

---

## What you do with the outputs

1. **Read both memos** (`RECOMMENDATIONS.md` + `EVALUATION.md`) before looking at code. The narratives are the deliverable; the code is the receipts.

2. **Open `/experiments/ui-discovery-b/compare?q=Q03`** to see the three variants side by side.

3. **Open `/experiments/ui-discovery-a-gallery`** to see the 10 bespoke renderings.

4. **Decide:**
   - Does A's library refactor proposal change the calculus? (If yes, B's variants may need re-running against the refactored library.)
   - Which of B's variants is closest to your taste?
   - What hybrid emerges?

5. **Write the v0.6 spec** based on the combined findings. That spec becomes the next sprint.

---

## Guardrails

Both subagents are instructed to:
- Never modify production routes (`/workbench`, `/workbench/demo`) or production block components.
- Never break the locked stack (no OpenAI, no AI SDK as agent runtime, no Excalidraw, no MongoDB).
- Always qualify Supabase schemas (`.schema('atlas')` or `.schema('hive')`).
- Always cite real corpus UUIDs verified to exist in DB.
- Always include `confidence_tier` on recommendations.
- Pass the density audit (`npm run eval:workbench`).

If a subagent breaks one of these, fail their PR and reset.

---

## Cost note

Both subagents run end-to-end without supervision. Each will consume meaningful tokens (Subagent A ~$15-30, Subagent B ~$25-40 on Sonnet-class models, rough order-of-magnitude). Cheaper / faster models will degrade output quality noticeably — recommend a frontier model for both.
