/**
 * /api/lg/[...path] — LangGraph CLI proxy
 *
 * Forwards all requests to the LangGraph CLI server (default: localhost:2024).
 * This lets the browser reach the LangGraph server without knowing its address,
 * and works in both local dev and production (where the server runs as a sidecar).
 *
 * chatApi.ts falls back to /api/lg when NEXT_PUBLIC_LANGGRAPH_API_URL is unset:
 *   const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL
 *     || new URL("/api/lg", window.location.href).href;
 *
 * Server-side env var (not exposed to browser):
 *   LANGGRAPH_API_URL=http://localhost:2024  (default)
 *
 * Supports all HTTP methods and streaming responses (NDJSON / SSE).
 */

import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM =
  process.env.LANGGRAPH_API_URL ?? "http://localhost:2024";

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const tail = path.join("/");
  const search = req.nextUrl.search ?? "";
  const upstreamUrl = `${UPSTREAM}/${tail}${search}`;

  // Forward headers, strip host so the upstream doesn't reject us
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.delete("host");

  // Add LangGraph API key if configured
  const lgApiKey = process.env.LANGGRAPH_API_KEY;
  if (lgApiKey) {
    forwardHeaders.set("x-api-key", lgApiKey);
  }

  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = req.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      // Required for streaming request bodies (fetch + duplex)
      ...(body ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "LangGraph server unreachable";
    return NextResponse.json(
      {
        error: "langgraph_proxy_error",
        message,
        upstream: UPSTREAM,
        hint: "Start the LangGraph CLI server: cd agents && langgraph dev",
      },
      { status: 502 },
    );
  }

  // Pass through the upstream response including streaming bodies
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const HEAD    = handler;
export const OPTIONS = handler;

// Allow large streaming responses — no body size limit
export const config = {
  api: { bodyParser: false },
};
