import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// ExperimentalEmptyAdapter — the Python agent handles its own LLM calls
const serviceAdapter = new ExperimentalEmptyAdapter();

// HttpAgent connects to the ag_ui_langgraph FastAPI server
const agentRuntime = new CopilotRuntime({
  agents: {
    my_agent: new HttpAgent({
      url: process.env.AGENT_URL ?? "http://localhost:8000/",
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
