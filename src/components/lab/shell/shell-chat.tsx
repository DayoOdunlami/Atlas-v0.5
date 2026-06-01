"use client";

/**
 * ShellChat — polished single-panel production chat view.
 *
 * Features:
 *  - Agent tabs (ATLAS / JARVIS / CICERONE / HYVE) in the header
 *  - Model selector with Anthropic / OpenAI / Google grouping
 *  - Edge classifier: conversational queries answered instantly, no Python round-trip
 *  - Chain of Thought (shared component) displayed above assistant messages
 *  - Inline citations as chips
 *  - Suggestion chips on the empty state
 *  - Streaming sentinel: CoT shown live before final answer arrives
 *  - Shared LabInput for @mention agent/lens switching
 */

import { useRef, useEffect, useMemo, useState } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import {
  TextMessage,
  MessageRole,
} from "@copilotkit/runtime-client-gql";

import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import { toDisplayMessages } from "@/lib/atlas5/display-messages";
import { isConversational, getInstantReply } from "@/lib/atlas5/edge-classifier";
import { ChainOfThought } from "@/components/lab/chain-of-thought";
import { Markdown } from "@/components/chat/layout/markdown";
import { Badge } from "@/components/ui/badge";
import { LabInput } from "@/components/lab/chat-panels/at-command-picker";
import { AGENTS } from "@/components/lab/chat-panels/agent-selector";
import { ModelSelector } from "./model-selector";

import type { AgentId, LensId } from "@/lib/atlas5/types";
import type { DisplayMessage } from "@/components/lab/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Per-agent suggestions shown on empty state
// ---------------------------------------------------------------------------

const AGENT_SUGGESTIONS: Record<AgentId, Array<{ label: string; message: string }>> = {
  ATLAS: [
    { label: "Autonomous freight corridors", message: "What is the strategic case for CPC to commission a programme on autonomous freight corridors in the UK?" },
    { label: "EV charging investment brief",  message: "Build an investment brief for a CPC-led EV charging infrastructure programme." },
    { label: "Connected places NPV",          message: "What is the economic case for a connected places programme? Include an NPV at 3.5% STPR." },
  ],
  JARVIS: [
    { label: "Active travel evidence",      message: "What evidence does the CPC corpus have on active travel interventions?" },
    { label: "Smart city projects",          message: "Find CPC corpus projects related to smart city infrastructure and digital transport." },
    { label: "MaaS evidence base",           message: "What does the evidence base say about Mobility as a Service programmes?" },
  ],
  CICERONE: [
    { label: "Helsinki MaaS → UK",           message: "How transferable is the Helsinki MaaS model to mid-sized UK cities?" },
    { label: "EV rollout analogues",         message: "Score the transferability of California's EV charging rollout to UK transport corridors." },
    { label: "Cross-sector transfer score",  message: "What cross-sector analogues exist for autonomous freight in non-transport sectors?" },
  ],
  HYVE: [
    { label: "Climate resilience evidence", message: "What HIVE evidence exists on climate resilience interventions for UK transport?" },
    { label: "Coastal adaptation",           message: "Show me adaptation strategies for coastal transport infrastructure from the HIVE case studies." },
    { label: "Flood risk corridors",         message: "What evidence addresses flood risk on strategic transport corridors?" },
  ],
};

// ---------------------------------------------------------------------------
// Citation chip
// ---------------------------------------------------------------------------

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const REF_RE  = /\[(\d+)\]/g;

function extractCitations(text: string): string[] {
  const uuids = text.match(UUID_RE) ?? [];
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) refs.push(`[${m[1]}]`);
  return [...new Set([...uuids, ...refs])];
}

function CitationChip({ label }: { label: string }) {
  const isUuid = label.includes("-");
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center text-[10px] font-mono px-1 py-0 h-4 border-primary/30 text-primary/70 hover:border-primary/60 cursor-default"
      title={isUuid ? label : undefined}
    >
      {isUuid ? label.slice(0, 8) + "…" : label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// ShellChat
// ---------------------------------------------------------------------------

export function ShellChat() {
  const { surface, setAgent, setLens } = useSurfaceGateway();
  const activeAgent = (surface.active_agent ?? "ATLAS") as AgentId;
  const activeLens  = (surface.active_lens  ?? "CPC")   as LensId;

  const { visibleMessages, appendMessage, isLoading, stopGeneration } =
    useCopilotChat();

  const [localFastReplies, setLocalFastReplies] = useState<DisplayMessage[]>([]);
  const [activeModel, setActiveModel] = useState("claude-sonnet-4-6");

  const ckMessages  = useMemo(() => toDisplayMessages(visibleMessages), [visibleMessages]);
  const allMessages = useMemo(
    () => [...ckMessages, ...localFastReplies],
    [ckMessages, localFastReplies]
  );

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, isLoading]);

  const handleSend = async (text: string) => {
    if (isConversational(text)) {
      setLocalFastReplies((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user",      content: text },
        { id: crypto.randomUUID(), role: "assistant", content: getInstantReply(text, activeAgent) },
      ]);
      return;
    }
    setLocalFastReplies([]);
    await appendMessage(new TextMessage({ role: MessageRole.User, content: text }));
  };

  const agentDef      = AGENTS.find((a) => a.id === activeAgent) ?? AGENTS[0];
  const AgentIcon     = agentDef.icon;
  const suggestions   = AGENT_SUGGESTIONS[activeAgent] ?? [];
  const isEmpty       = allMessages.length === 0 && !isLoading;
  const hasStreaming  = allMessages.some((m) => m.id === "__streaming__");

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur-sm px-4 py-2 flex items-center gap-2">

        {/* Agent tabs */}
        <div className="flex items-center gap-1">
          {AGENTS.map((a) => {
            const Icon = a.icon;
            const isActive = a.id === activeAgent;
            return (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all",
                  isActive
                    ? cn(a.bg, a.color)
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="size-3 shrink-0" />
                {a.name}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Model selector */}
        <ModelSelector value={activeModel} onChange={setActiveModel} />
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-4 px-6 py-5 max-w-3xl mx-auto">

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <div className={cn(
                "size-14 rounded-2xl flex items-center justify-center border-2",
                agentDef.bg
              )}>
                <AgentIcon className={cn("size-7", agentDef.color)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold text-foreground">{agentDef.name}</p>
                <p className="text-sm text-muted-foreground max-w-sm">{agentDef.description}</p>
              </div>
              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSend(s.message)}
                    className="px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-border transition-colors text-left"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message thread */}
          {allMessages.map((msg) => {
            const isUser     = msg.role === "user";
            const isStreaming = msg.id === "__streaming__";
            const nodeCalls  = !isUser ? (msg.toolCalls ?? []).filter((tc) => tc.kind === "node") : [];
            const citations  = !isUser ? extractCitations(msg.content) : [];

            /* User bubble */
            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              );
            }

            /* Assistant message */
            return (
              <div key={msg.id} className="flex flex-col gap-2">
                {/* Chain of thought */}
                {nodeCalls.length > 0 && (
                  <ChainOfThought
                    toolCalls={nodeCalls}
                    defaultOpen={isStreaming}
                  />
                )}
                {/* Content */}
                {msg.content && !isStreaming && (
                  <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                    <Markdown content={msg.content} />
                  </div>
                )}
                {/* Citations */}
                {citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {citations.map((c) => <CitationChip key={c} label={c} />)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator (before streaming sentinel appears) */}
          {isLoading && !hasStreaming && (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-muted-foreground animate-pulse">
                Analysing evidence…
              </span>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <LabInput
        onSend={handleSend}
        isLoading={isLoading}
        onStop={stopGeneration}
        onAgentChange={setAgent}
        onLensChange={setLens}
        activeAgent={activeAgent}
        activeLens={activeLens}
      />
    </div>
  );
}
