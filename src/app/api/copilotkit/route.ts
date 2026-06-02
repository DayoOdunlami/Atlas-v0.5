import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
// Allow up to 5 min for long agent runs (ATLAS Five Case can take 35-40 s);
// without this, Vercel serverless cuts the stream at the default 10 s limit.
export const maxDuration = 300;

// ExperimentalEmptyAdapter — each Python agent handles its own LLM calls
const serviceAdapter = new ExperimentalEmptyAdapter();

// Base URL for the Python agent service (port 8000).
// Vercel env: PYTHON_AGENTS_URL=https://agents-production-d347.up.railway.app
// Local dev:  PYTHON_AGENTS_URL=http://localhost:8000  (or unset → same default)
const AGENT_BASE = (
  process.env.PYTHON_AGENTS_URL ??
  process.env.AGENT_URL ??        // legacy alias — remove once all envs updated
  "http://localhost:8000"
).replace(/\/$/, "");

// CopilotRuntime — routes to the right AG-UI agent by name
// JARVIS   → /jarvis    (corpus explorer — evidence search + citation verification)
// ATLAS    → /atlas     (Green Book strategist — Five Case Model + NPV)
// CICERONE → /cicerone  (cross-sector transfer — transferability score + HAVE/PARTIAL/MISSING gaps)
// HYVE     → /hyve      (climate adaptation — HIVE case studies + transport mode classification)
const agentRuntime = new CopilotRuntime({
  agents: {
    jarvis: new HttpAgent({
      url: `${AGENT_BASE}/jarvis`,
    }),
    atlas: new HttpAgent({
      url: `${AGENT_BASE}/atlas`,
    }),
    cicerone: new HttpAgent({
      url: `${AGENT_BASE}/cicerone`,
    }),
    hyve: new HttpAgent({
      url: `${AGENT_BASE}/hyve`,
    }),
  },
});

const makeHandler = (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: agentRuntime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};

export const POST = makeHandler;
export const GET = makeHandler;
