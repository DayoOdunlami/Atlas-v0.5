# Atlas Case File — colleague brief (Jun 2026)

**To:** CPC Atlas colleagues  
**From:** Atlas 5 build team  
**Re:** Case File programme, current build status, and how to test

---

Hi all,

We’ve shipped the first slice of the **Case File** programme on `/atlas` and updated the canonical docs so we’re aligned on what’s live, what’s next, and how to validate it.

## What changed (product)

**Case File** is now the centre of the workbench — not a matcher-first flow. When a user states their situation (“I’ve got a rail idea, not sure what I’m asking”), Atlas:

1. Captures **declared claims** in the sidebar Case File panel (confirm / edit / reject).
2. Surfaces a **gold “declared situation” block** on the canvas when relevant.
3. Supports **SWOT on stated claims** (panel button or explicit “SWOT my stated claims”).
4. Lets you **promote to a case entity** and attach it to the thread (Postgres persist when enabled).

**Showcase mode** still works for demos: `Show me what you can do` → reply **`1`**, **`2`**, **`3`** or **`demo rail`** / **`demo aviation`** / **`demo flex`** → **`next`** to advance.

## Docs & Notion

| Resource | Purpose |
|----------|---------|
| [`docs/ATLAS_V5_BLUEPRINT.md`](ATLAS_V5_BLUEPRINT.md) §18 | Build status, SWOT modes, validation queries |
| [`docs/ATLAS_V5_CASE_FILE_PLAN.md`](ATLAS_V5_CASE_FILE_PLAN.md) | Phase 0/1 checklist |
| [`ATLAS5_NORTH_STAR.md`](../ATLAS5_NORTH_STAR.md) | Outcomes unchanged; sequencing addendum Jun 2026 |
| [Notion: Case File & Build Status](https://app.notion.com/p/38dc9b382a748166893ed6885d4f7f9d) | Shareable snapshot for non-repo readers |

## How to run locally

```bash
npm run dev          # UI + Python agent (port 8000)
# or
npm run dev:ui       # frontend only
npm run dev:agent    # agent only
```

Open **http://localhost:3000/atlas** (or your configured port).

**Session persist** (optional but recommended for history + restore):

- Set `POSTGRES_URL` (and related Supabase vars per `.env.example`)
- Set `ATLAS_V5_CASEFILE_PERSIST=1`
- Apply migration `supabase/migrations/20260626_atlas_case_entities.sql`

## Suggested test queries

| Query | Expected |
|-------|----------|
| `Show me what you can do` → `2` → `next` | Aviation showcase; canvas updates on substantive steps |
| `I've got a rail idea, not sure what I'm asking` | Declared claims in Case File panel; gold block on canvas when composed |
| SWOT button in Case File panel | SWOT layout grounded on **user claims**, not corpus-only |
| `State of play on rail decarbonisation in our corpus` | Normal corpus brief — **no** declared-claims block |

## Dev tooling

In **development**, expand the left rail → **Dev timing & routing** opens the overlay (route, gate, stage_ms, turn elapsed). The overlay also appears bottom-right as **Atlas dev ▸**.

## Known UX (recent fixes)

- **Session restore:** switching sessions reloads chat + last canvas layout from Postgres (not stale CopilotKit memory).
- **Rename:** hover a session → pencil icon → inline rename.
- **Sidebar list:** no longer flashes “Loading…” on every save when sessions already loaded.
- **Showcase:** numeric picks (`2`, `number 2`) now map to menu options.

## What’s next (not in this slice)

- Phase 2+: entity-linked journeys, richer promote/attach flows, optional matcher as Phase 3
- Full session persistence plan: [`docs/ATLAS_V5_SESSION_PERSISTENCE_PLAN.md`](ATLAS_V5_SESSION_PERSISTENCE_PLAN.md)

Questions or demo walkthrough — reply in Slack or grab 15 minutes on the Atlas stand-up.

— Atlas 5 build
