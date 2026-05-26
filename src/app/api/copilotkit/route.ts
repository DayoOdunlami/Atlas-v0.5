/**
 * Atlas 5 — AG-UI chat endpoint (D6 + D7 + D8)
 *
 * POST /api/copilotkit
 * Body: { messages: UIMessage[], active_agent, active_lens, thread_id }
 *
 * Behaviour:
 * 1. Auth-gates the request (session required)
 * 2. Routes to the correct Python agent based on active_agent
 * 3. Emits the raw agent JSON as a stream data annotation (picked up by
 *    useAtlas5Chat → artifact store → artifact pane)
 * 4. Injects the agent's corpus context into the system prompt
 * 5. Streams a narrative response via Anthropic claude-sonnet-4-6
 *
 * Agent routing:
 *   ATLAS    → POST /agents/atlas    → Five Case Model + NPV
 *   JARVIS   → POST /agents/jarvis   → Evidence citations + analysis
 *   CICERONE → POST /agents/cicerone → Transferability score + gaps
 *   HYVE     → POST /agents/hyve     → HIVE citations + transport mode
 *
 * If the Python agent service is unavailable, falls back to direct
 * Anthropic call with no corpus context.
 *
 * Model: claude-sonnet-4-6 ONLY — never OpenAI.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
} from "ai";
import { type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/server";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENT_MODEL = "claude-sonnet-4-6";
const AGENTS_BASE_URL =
  process.env.PYTHON_AGENTS_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Agent endpoint mapping
// ---------------------------------------------------------------------------

const AGENT_ENDPOINT: Record<string, string> = {
  ATLAS: "atlas",
  JARVIS: "jarvis",
  CICERONE: "cicerone",
  HYVE: "hyve",
};

// ---------------------------------------------------------------------------
// Raw agent data fetcher
// Returns { rawData, contextText } — rawData is the full agent JSON,
// contextText is formatted as system-prompt context.
// ---------------------------------------------------------------------------

interface AgentFetchResult {
  rawData: Record<string, unknown> | null;
  contextText: string;
}

async function fetchAgentResult(
  activeAgent: string,
  query: string,
): Promise<AgentFetchResult> {
  const agentPath = AGENT_ENDPOINT[activeAgent] ?? "jarvis";

  try {
    const res = await fetch(`${AGENTS_BASE_URL}/agents/${agentPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context_packet: {} }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return { rawData: null, contextText: "" };

    const data = (await res.json()) as Record<string, unknown>;
    const contextText = formatAgentContext(activeAgent, data);

    return { rawData: data, contextText };
  } catch {
    return { rawData: null, contextText: "" };
  }
}

// ---------------------------------------------------------------------------
// Context formatter — produces human-readable text for the system prompt
// ---------------------------------------------------------------------------

function formatAgentContext(
  activeAgent: string,
  data: Record<string, unknown>,
): string {
  const tier = data.confidence_tier ?? "Speculative";

  switch (activeAgent) {
    case "ATLAS": {
      const fcm = (data.five_case_model ?? {}) as Record<string, string>;
      const citations =
        (data.corpus_citations as
          | Array<{ id: string; title: string }>
          | undefined) ?? [];
      return [
        `[ATLAS Five Case Model — ${tier}]`,
        `Strategic: ${fcm.strategic ?? ""}`,
        `Economic: ${fcm.economic ?? ""}`,
        `Commercial: ${fcm.commercial ?? ""}`,
        `Financial: ${fcm.financial ?? ""}`,
        `Management: ${fcm.management ?? ""}`,
        data.npv_value != null ? `NPV: £${data.npv_value}` : "",
        data.discount_rate != null
          ? `Discount rate: ${(Number(data.discount_rate) * 100).toFixed(1)}% (HMT STPR)`
          : "",
        citations.length > 0
          ? `Corpus citations: ${citations.map((c) => c.title).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "CICERONE": {
      const gaps =
        (data.evidence_gaps as
          | Array<{
              area: string;
              status: string;
              note: string;
            }>
          | undefined) ?? [];
      const analogues = (data.sector_analogues as string[] | undefined) ?? [];
      return [
        `[CICERONE Transferability — ${tier}]`,
        `Score: ${data.transferability_score ?? "N/A"}/100`,
        analogues.length > 0 ? `Analogues: ${analogues.join("; ")}` : "",
        gaps.length > 0
          ? `Evidence gaps: ${gaps.map((g) => `${g.area} [${g.status}]`).join("; ")}`
          : "",
        data.analysis ? String(data.analysis) : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "HYVE": {
      const citations =
        (data.hive_citations as Array<{ title: string }> | undefined) ?? [];
      return [
        `[HYVE HIVE Intelligence — ${tier}]`,
        data.transport_mode ? `Transport mode: ${data.transport_mode}` : "",
        citations.length > 0
          ? `Articles: ${citations.map((c) => c.title).join("; ")}`
          : "",
        data.analysis ? String(data.analysis) : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    default: {
      // JARVIS
      const citations =
        (data.corpus_citations as
          | Array<{ id: string; title: string }>
          | undefined) ?? [];
      return [
        `[JARVIS Evidence Summary — ${tier}]`,
        data.analysis ? String(data.analysis) : "",
        citations.length > 0
          ? `Corpus citations: ${citations.map((c) => c.title).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  activeAgent: string,
  activeLens: string,
  agentContext: string,
): string {
  const agentDescriptions: Record<string, string> = {
    ATLAS:
      "You are ATLAS, the Green Book business case agent. You help users build structured Five Case Model business cases for innovation and transport projects, with NPV calculations at the HMT STPR of 3.5% and appropriate optimism bias adjustments.",
    JARVIS:
      "You are JARVIS, the corpus explorer agent. You help users find and understand evidence from the Connected Places Catapult project portfolio, providing verified citations and confidence-tiered analysis.",
    CICERONE:
      "You are CICERONE, the cross-sector transfer agent. You evaluate whether insights from one sector or context can transfer to another, using the analogue method and scoring transferability 0–100.",
    HYVE: "You are HYVE, the HIVE intelligence agent. You surface relevant policy and market intelligence articles from the HIVE database, mapping them to transport modes and confidence tiers.",
  };

  const lensContext: Record<string, string> = {
    CPC: "Focus on Connected Places Catapult's own project portfolio.",
    Atlas: "Focus on the full Atlas innovation corpus.",
    Ecosystem: "Focus on ecosystem and partnership opportunities.",
    Funder: "Focus on funding landscape and investment opportunities.",
    Mode: "Focus on transport mode-specific evidence (rail, road, active travel, etc.).",
  };

  const base =
    agentDescriptions[activeAgent] ??
    "You are an Atlas 5 strategic intelligence agent.";
  const lens = lensContext[activeLens] ?? "";
  const contextBlock = agentContext.trim()
    ? `\n\nCORPUS CONTEXT (pre-fetched from ${activeAgent} agent):\n${agentContext}`
    : "";

  return [
    base,
    lens,
    "RULES:",
    "- Never fabricate project IDs or citation references.",
    "- If corpus context is available above, use it to ground your response.",
    "- State the confidence tier (Speculative/Indicative/Supported/Robust) at the end.",
    "- Keep responses concise and structured. The structured artifact has already been emitted — narrate the key points.",
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // Auth gate
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    active_agent?: string;
    active_lens?: string;
    thread_id?: string | null;
  };

  const {
    messages,
    active_agent: activeAgent = "JARVIS",
    active_lens: activeLens = "CPC",
  } = body;

  // Extract the last user query for the Python agent call
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText =
    lastUserMsg?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      ?.map((p) => p.text)
      ?.join(" ") ?? "";

  // Fetch agent result (raw JSON + formatted context text)
  const { rawData, contextText } = lastUserText
    ? await fetchAgentResult(activeAgent, lastUserText)
    : { rawData: null, contextText: "" };

  const systemPrompt = buildSystemPrompt(activeAgent, activeLens, contextText);

  // Stream via Anthropic claude-sonnet-4-6
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const stream = createUIMessageStream({
    // execute receives { writer: UIMessageStreamWriter } — destructure to get the writer.
    // (AI SDK v5: the first param is an options object, not the writer directly.)
    execute: async ({ writer }) => {
      // Emit structured artifact data FIRST so the artifact pane can
      // render the structured output while the narrative is still streaming.
      if (rawData) {
        writer.write({
          type: "data",
          data: [
            {
              type: "atlas5_artifact",
              agent: activeAgent,
              payload: rawData,
            },
          ],
        });
      }

      const result = streamText({
        model: anthropic(AGENT_MODEL),
        system: systemPrompt,
        messages: convertToModelMessages(messages),
        maxTokens: 4096,
        experimental_transform: smoothStream({ chunking: "word" }),
        onError: (error) => {
          writer.write({
            type: "error",
            errorText: String(error),
          });
        },
      });

      // AI SDK v5: writer.merge(result.toUIMessageStream()) — not mergeIntoDataStream
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
