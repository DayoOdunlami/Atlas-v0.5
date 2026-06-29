# Workflow — you verify, automation finds bugs first

Goal: **stop being the first person to discover integration bugs.** You review answer quality and product direction; the MOT runs before you open the browser.

## Three layers (no cloud agent required)

| Layer | Command | What it catches |
|-------|---------|-----------------|
| **1 — Foundation** | `npm run eval:baseline-v06` | Routing, persist, URL helpers |
| **2 — Answer MOT** | `npm run eval:mot:brain` | Multi-turn queries + reply previews → `eval/out/mot-latest.md` |
| **3 — UI glue** | `npm run eval:mot` (needs `npm run dev`) | Entry auto-send, thread switch, threads API |

**Your job after MOT green:** read `eval/out/mot-latest.md` — do the answers *feel* right? Are charts appropriate? That is human judgement, not bug hunting.

## When something fails

1. Read the MOT markdown — which turn, which route, reply preview.
2. **Bug** if invariant broken (bootstrap, thread URL, save failed, wrong route class).
3. **Blueprint gap** if feature simply not built yet.
4. **Quality** if route correct but prose/charts weak — tune agent prompts, not sidebar code.

## Rebuild on Better Chat?

**Not recommended.** This repo is aligned to the locked stack (LangGraph + CopilotKit + AnswerSpec canvas). The Better Chat sprint used a different chat shell; you'd rebuild the same persistence/routing glue here anyway. Foundation is **sound** — integration and eval coverage were thin. MOT fixes that without a repo swap.

## Before merge to production

```bash
npm run dev          # terminal 1
npm run eval:mot     # terminal 2 — must be green
```

Then click through preview once (10 min). Merge `feat/atlas5-stage1` → `main`.

## What "turn" means

- **UI "2 / 4"** — strategist journey step (Orient→Connect→Diagnose→Act), not DB row count.
- **`atlas.turns` rows** — saved user+assistant+canvas pairs for resume. Normal chat persistence.
