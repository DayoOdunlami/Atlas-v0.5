import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// ExperimentalEmptyAdapter — each Python agent handles its own LLM calls
const serviceAdapter = new ExperimentalEmptyAdapter();

// Base URL for the Python agent service (port 8000)
const AGENT_BASE = (process.env.AGENT_URL ?? "http://localhost:8000/").replace(/\/$/, "");

// CopilotRuntime — routes to the right AG-UI agent by name
// JARVIS  → /jarvis  (corpus explorer — evidence search + citation verification)
// ATLAS   → /atlas   (Green Book strategist — Five Case Model + NPV)
const agentRuntime = new CopilotRuntime({
  agents: {
    jarvis: new HttpAgent({
      url: `${AGENT_BASE}/jarvis`,
    }),
    atlas: new HttpAgent({
      url: `${AGENT_BASE}/atlas`,
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
