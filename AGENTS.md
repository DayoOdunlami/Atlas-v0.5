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

- Next.js app hosts CopilotKit UI and API route; Python LangGraph agents run in `agents/server.py` (FastAPI on port 8000). `npm run dev` runs Next.js and the agent service together.

## Cursor Cloud specific instructions

### Run the full stack (FastAPI agents + Next.js)

From the repo root (requires `.env.local` with keys listed in `CLAUDE.md`):

```bash
npm run dev
```

This starts:

- **UI:** Next.js with Turbopack on **http://localhost:3005** (`dev:ui`)
- **Agents:** `uvicorn agents.server:app --port 8000` (`dev:agents`)

Health checks:

```bash
curl "$PYTHON_AGENTS_URL/health"
curl "$PYTHON_AGENTS_URL/atlas/health"
```

Split terminals if needed: `npm run dev:ui` and `npm run dev:agents`.

Set `PYTHON_AGENTS_URL` in `.env.local` for CopilotKit (`src/app/api/copilotkit/route.ts`).

### Test-mode authentication (headless / Playwright)

**Dev session bypass** (non-production): `POST /api/auth/dev-bypass` with JSON `{ "role": "admin" | "guest", "password": "<bypass>" }`. Enabled when `NODE_ENV !== "production"` or `ALLOW_VERCEL_DEV_LOGIN=true` or `VERCEL_ENV=preview`. Passwords: `DEV_ADMIN_BYPASS_PASSWORD` / `DEV_GUEST_BYPASS_PASSWORD`, or defaults `atlas-dev-admin` / `atlas-dev-guest` (`src/lib/auth/dev-test-login.ts`).

Playwright helpers (`eval/playwright/helpers/auth.ts`):

- `loginViaDevBypass(page)` — when better-auth + `public.user` (Postgres) are fully wired.
- `loginViaE2eToolSecret(page)` / `loginForPlaywright(page)` — `POST /api/test/e2e-bypass` with `x-tool-secret: $BETTER_AUTH_SECRET`; requires `ALLOW_E2E_AUTH_COOKIE=true` in `.env.local` (sets `atlas_e2e_auth` cookie recognised by `getSession()`).

**Internal tool calls** (no browser session): routes under `src/app/api/passport/*` accept `x-tool-secret: <BETTER_AUTH_SECRET>` (same pattern as `src/lib/passport/internal-fetch.ts`). Use for server-side tool execute paths, not for chat UI.

### Headless chat → artifact verification

Harness page: **http://localhost:3005/atlas5-test** — `ChatPane` + `ArtifactPane` + `CoAgentArtifactBridge` (CopilotKit → artifact store).

Authenticated live claim-state E2E:

```bash
npm run dev   # enable object routes for passport E2E: ATLAS_OBJECT_ROUTING_V1=true
npm run eval:e2e:claim-state
```

For the GoShuttle passport live spec, the Python agent needs `ATLAS_OBJECT_ROUTING_V1=true` (see `agents/object_routing.py`).

Spec: `eval/playwright/claim-state-live.spec.ts` — `loginForPlaywright` (dev-bypass or E2E tool-secret cookie), sends “Show me the GoShuttle passport”, asserts `claim-state-badge-inferred` on live `entity-profile-claim` rows (DB tiers are `self_reported` → UI `inferred`, not fixture `stated`).

E2E env (add to `.env.local` for Cloud Agent runs):

```bash
ALLOW_E2E_AUTH_COOKIE=true
BETTER_AUTH_SECRET=<same secret used for passport internal routes>  # or E2E_TOOL_SECRET=atlas-playwright-e2e in dev
ATLAS_OBJECT_ROUTING_V1=true   # required for GoShuttle passport live spec
```

Auth-free fixture smoke (faster):

```bash
npm run eval:tier1:e2e
```

Uses `/api/atlas5/fixture` + `/atlas5-test?recipe=…` (see `eval/playwright/recipe-smoke.spec.ts`).
