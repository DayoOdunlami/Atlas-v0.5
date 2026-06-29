# Repository Guidelines

## Project Structure & Module Organization

- Frontend (Next.js + TypeScript): `src/app/**` (pages: `page.tsx`, `layout.tsx`, styles: `globals.css`). API route for CopilotKit: `src/app/api/copilotkit/route.ts`.
- Agent (ADK/Python): `agent/agent.py`, virtual env in `agent/.venv`, deps in `agent/requirements.txt`.
- Public assets: `public/`. Config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`.
- Scripts: `scripts/run-agent.sh`, `scripts/setup-agent.sh`.

## Build, Test, and Development

- `npm run dev` — runs UI (`next dev --turbopack`) and the Python agent concurrently.
- `npm run dev:ui` — frontend only; useful for UI iteration.
- `npm run dev:agent` — agent only; activates `.venv` and runs `agent.py`.
- `npm run build` — production build for the Next.js app.
- `npm start` — serve the built app.
- `npm run lint` — lint the frontend with Next/ESLint.
- First-time setup installs the agent via `postinstall` (creates `.venv` and installs Python deps).

## Coding Style & Naming Conventions

- TypeScript/React: 2-space indent, PascalCase components, camelCase variables, file-based routing under `src/app/**`.
- Python agent: follow PEP 8; keep modules small and composable.
- Linting: Next.js ESLint config (`npm run lint`). Prefer explicit types in exported APIs.
- Components: colocate with usage; export from an `index.ts` when creating reusable modules.

## Testing Guidelines

- Currently no test harness. When adding tests:
  - Frontend: Jest/Vitest in `src/__tests__/` with `*.test.ts(x)`.
  - Agent: `pytest` in `agent/tests/` with `test_*.py`.
  - Aim for high coverage on data shaping (dashboard spec generation, adapters).

## Commit & Pull Request Guidelines

- Conventional Commits: `type(scope): message`.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
  - Example: `feat(charts): support pie charts`.
- PRs: clear description, linked issue, before/after screenshots or JSON spec samples, and testing notes.
- Keep PRs focused; call out env/config changes explicitly.

## Environment, Security & Config

- Place secrets in `.env.local` (frontend) and `agent/.env` (agent). Never commit secrets.
- Example keys (adjust to your provider):
  - Frontend: `NEXT_PUBLIC_CPK_ENDPOINT=/api/copilotkit`.
  - Agent: `GOOGLE_API_KEY=...` (Gemini), or `OPENAI_API_KEY=...` if applicable.
- Validate/sanitize prompts; avoid logging PII. Prefer `INFO` logs with redaction.

## Charts & CopilotKit Tips

- Dashboard spec (example): `{ "type": "line", "title": "Revenue", "x": "date", "y": "revenue" }`.
- Supported types to target in UI: `line`, `bar`, `pie`
- Naming: use singular `x`/`y` for series
- Recharts via CPK: map spec→props; e.g., `LineChart` with `dataKey={spec.y}` and `XAxis dataKey={spec.x}`;

## Architecture Overview

- Next.js app hosts CopilotKit UI and API route; Python agent performs ADK/Gemini orchestration. `npm run dev` runs both together.

## Cursor Cloud specific instructions

> **Note:** Root `README.md` and parts of this file still describe the legacy `agent/` ADK layout. For Atlas 5, use `agents/` + `pnpm` (see `CLAUDE.md` and `package.json`).

### Services and ports

| Service | Port | Start command |
|---------|------|---------------|
| Next.js UI | **3005** | `pnpm run dev:ui` or `pnpm run dev` |
| FastAPI agents | **8000** | `pnpm run dev:agents` or `pnpm run dev` |
| LangGraph dev (homepage `/` only) | **2024** | `cd agents && .venv/bin/langgraph dev` |

`pnpm run dev` starts UI + FastAPI only. CopilotKit lab routes (`/lab/copilotkit`, `/atlas5-test`) work with those two. The main shell at `/` also needs LangGraph on 2024 (`LANGGRAPH_API_URL`).

### First-time / dependency setup

- Node: `pnpm install` (lockfile is `pnpm-lock.yaml`).
- Python: venv at `agents/.venv` — `python3 -m venv agents/.venv && agents/.venv/bin/pip install -r agents/requirements.txt` (requires `python3.12-venv` on Debian/Ubuntu).
- Env: copy `.env.example` → `.env.local`. Live corpus search and LLM turns need `POSTGRES_URL`, `ANTHROPIC_API_KEY`, and optionally `OPENAI_API_KEY` for pgvector embeddings.

### Verify without secrets

```bash
pnpm run dev          # UI :3005 + agents :8000
curl -s localhost:8000/health
curl -s "localhost:3005/api/atlas5/fixture?recipe=brief_five_case" | jq '{ok,can_render,recipe_detected}'
pnpm run build
node scripts/python-bin.mjs agents/test_atlas5_battery.py   # Tier 1 unit; 6+/8 without DB keys
```

### Lint and tests

- `pnpm run lint` may open an interactive Next.js ESLint wizard if no `eslint.config.*` exists; use `pnpm run build` for compile checks instead.
- `pnpm run eval:tier1` runs Vitest mechanical checks; many D2+ cases need Supabase credentials. Duplicate `eval/eval/tier1.test.ts` inflates failure counts.
- `pnpm run check-types` may report pre-existing errors in passport/auth modules; production build skips type validation.

### Live agent demo

With `ANTHROPIC_API_KEY` + `POSTGRES_URL` in `.env.local`, open `/lab/copilotkit` on port 3005 and send a domain query to ATLAS.
