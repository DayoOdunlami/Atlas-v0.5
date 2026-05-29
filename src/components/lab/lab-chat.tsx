"use client";

/**
 * LabChat — chat area for /lab/chat-test.
 *
 * - Accepts a Set<PanelId> so any combination of A/B/C/D can be active.
 * - When only A is selected: renders CopilotChat (original behaviour).
 * - When multiple panels (or any non-A): panels sit side-by-side in a flex row
 *   with one shared LabInput at the bottom.
 * - Chain of Thought: ActionExecutionMessages are attached to the following
 *   assistant TextMessage so Panel D can render them.
 * - @ command wires directly to useSurfaceGateway so agent/lens routing works.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import { CopilotChat } from "@copilotkit/react-ui";
import {
  TextMessage,
  MessageRole,
  ActionExecutionMessage,
  AgentStateMessage,
  ResultMessage,
} from "@copilotkit/runtime-client-gql";

import { Header } from "@/components/chat/layout/header";
import { SidebarInput } from "@/components/chat/layout/input";
import { AssistantBubble } from "@/components/chat/layout/assistant-message";
import { UserBubble } from "@/components/chat/layout/user-message";
import { Suggestions } from "@/components/chat/layout/suggestion";

import {
  PanelSwitcher,
  PanelLabel,
  type PanelId,
} from "@/components/lab/chat-panels/panel-switcher";
import { LabInput } from "@/components/lab/chat-panels/at-command-picker";
import { PanelBBlazity } from "@/components/lab/chat-panels/panel-b-blazity";
import { PanelCShadcn } from "@/components/lab/chat-panels/panel-c-shadcn-full";
import { PanelDAtlas } from "@/components/lab/chat-panels/panel-d-atlas-custom";

import type { AgentId, LensId } from "@/lib/atlas5/types";
import { isConversational, getInstantReply } from "@/lib/atlas5/edge-classifier";
import type { DisplayMessage, ToolCallDisplay } from "@/components/lab/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Per-agent config (mirrors chat.tsx)
// ---------------------------------------------------------------------------

const AGENT_CONFIG: Record<
  AgentId,
  { greeting: string; suggestions: Array<{ title: string; message: string }> }
> = {
  ATLAS: {
    greeting:
      "👋 Hi, I'm ATLAS.\n\nI help CPC strategists build evidence-backed Five Case Model investment briefs.\n\nTry one of the prompts below, or ask me anything.",
    suggestions: [
      {
        title: "Autonomous freight corridors",
        message:
          "What is the strategic case for CPC to commission a programme on autonomous freight corridors in the UK?",
      },
      {
        title: "EV charging infrastructure",
        message:
          "Build an investment brief for a CPC-led EV charging infrastructure programme.",
      },
    ],
  },
  JARVIS: {
    greeting:
      "🔍 I'm JARVIS.\n\nI explore the CPC corpus and surface ranked evidence with real citations.",
    suggestions: [
      {
        title: "Active travel evidence",
        message: "What evidence does the CPC corpus have on active travel?",
      },
    ],
  },
  CICERONE: {
    greeting:
      "🧭 I'm CICERONE.\n\nI evaluate cross-sector transferability with a 0–100 score.",
    suggestions: [
      {
        title: "Cross-sector transfer score",
        message:
          "How transferable is the MaaS model from Helsinki to mid-sized UK cities?",
      },
    ],
  },
  HYVE: {
    greeting:
      "🌿 I'm HYVE.\n\nI surface climate adaptation evidence from HIVE case studies.",
    suggestions: [
      {
        title: "Climate resilience for transport",
        message:
          "What HIVE evidence exists on climate resilience interventions for UK transport?",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Transform GQL visibleMessages → DisplayMessage[]
//
// Two sources of "tool calls" for Panel D's Chain of Thought:
//   1. AgentStateMessage.nodeName — LangGraph nodes firing in the Python agent
//   2. ActionExecutionMessage    — CopilotKit frontend actions (add_chart etc.)
//
// Raw JSON state TextMessages (the CopilotKit state snapshot) are suppressed
// the same way AssistantBubble does in Panel A.
// ---------------------------------------------------------------------------

type CpkMessage = ReturnType<typeof useCopilotChat>["visibleMessages"][number];

/** Human-readable labels for known ATLAS/JARVIS/CICERONE/HYVE graph nodes. */
const NODE_LABELS: Record<string, string> = {
  // ATLAS
  extract_query:            "Extracting query intent",
  classify_intent:          "Classifying intent",
  select_recipe_intent:     "Selecting recipe intent",
  search_corpus:            "Searching CPC corpus",
  external_evidence_search: "Searching external evidence",
  build_five_case:          "Building Five Case brief",
  select_visual_recipe:     "Selecting visual recipe",
  verify_citations:         "Verifying citations",
  // JARVIS
  search_projects:          "Searching corpus projects",
  search_live_calls:        "Searching live funding calls",
  retrieve_evidence:        "Retrieving evidence",
  reason_and_cite:          "Reasoning and citing",
  // CICERONE
  evaluate_transfer:        "Evaluating transferability",
  score_transfer:           "Scoring transferability",
  // HYVE
  search_hive:              "Searching HIVE case studies",
  map_transport_modes:      "Mapping transport modes",
};

/** Nodes that are internal routing artefacts — never shown in CoT. */
const HIDDEN_NODES = new Set([
  "__start__", "__end__", "_route_after_intent",
  "route_after_intent", "router",
]);

/** Mirrors AssistantBubble's isRawStateMessage — suppresses JSON state dumps. */
function isRawStateContent(content: string): boolean {
  const trimmed = content.trim();
  let inner = trimmed;
  if (trimmed.startsWith("```")) {
    inner = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }
  if (!inner.startsWith("{")) return false;
  return (
    inner.includes('"sections"') ||
    inner.includes('"corpus_citations"') ||
    inner.includes('"decision_spine"') ||
    inner.includes('"confidence_tier"') ||
    inner.includes('"artifact_block"') ||
    inner.includes('"five_case_model"') ||
    inner.includes('"evidence_gaps"')
  );
}

function toDisplayMessages(raw: CpkMessage[]): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  let pendingNodes: ToolCallDisplay[] = [];
  let pendingActions: ToolCallDisplay[] = [];

  for (const m of raw) {
    if (m.isAgentStateMessage()) {
      const asm = m as AgentStateMessage;
      const stateObj = (asm as unknown as { state?: Record<string, unknown> }).state;

      // KEY FIX: CopilotKit may send only ONE final AgentStateMessage with the
      // complete state snapshot (not one per node). We therefore scan the ENTIRE
      // reasoning_trace array and upsert an entry for every node found.
      // This works for both streaming (one msg per node) and batch (one final msg).
      const traceArr = Array.isArray(stateObj?.reasoning_trace)
        ? (stateObj!.reasoning_trace as Array<Record<string, unknown>>)
        : [];

      for (const traceEntry of traceArr) {
        const node = traceEntry.node as string | undefined;
        if (!node || HIDDEN_NODES.has(node)) continue;

        const existing = pendingNodes.findIndex((n) => n.id === node);
        const step: ToolCallDisplay = {
          id: node,
          name: NODE_LABELS[node] ?? node.replace(/_/g, " "),
          args: "",
          kind: "node",
          trace: {
            thought: traceEntry.thought as string | undefined,
            tool_calls: traceEntry.tool_calls as import("@/components/lab/types").TraceToolCall[] | undefined,
            status: traceEntry.status as "ok" | "error" | undefined,
          },
        };
        if (existing >= 0) {
          pendingNodes[existing] = step;
        } else {
          pendingNodes.push(step);
        }
      }

      // Also handle the case where nodeName is set but no reasoning_trace entries exist yet
      // (early nodes that don't write to reasoning_trace, e.g. extract_query)
      const node = asm.nodeName;
      if (node && !HIDDEN_NODES.has(node)) {
        const alreadyInTrace = pendingNodes.some((n) => n.id === node);
        if (!alreadyInTrace) {
          pendingNodes.push({
            id: node,
            name: NODE_LABELS[node] ?? node.replace(/_/g, " "),
            args: "",
            kind: "node",
            trace: undefined, // no thought yet — node fired but left no trace entry
          });
        }
      }
    } else if (m.isResultMessage()) {
      // CopilotKit frontend action result — update the matching action entry's trace
      const rm = m as ResultMessage;
      const idx = pendingActions.findIndex((a) => a.id === rm.actionExecutionId);
      if (idx >= 0) {
        pendingActions[idx] = {
          ...pendingActions[idx],
          trace: { thought: `Result: ${String(rm.result ?? "").slice(0, 200)}`, status: "ok" },
        };
      }
    } else if (m.isActionExecutionMessage()) {
      const aem = m as ActionExecutionMessage;
      pendingActions.push({
        id: aem.id ?? crypto.randomUUID(),
        name: aem.name ?? "unknown_tool",
        args: JSON.stringify(aem.arguments ?? {}),
        kind: "action",
      });
    } else if (m.isTextMessage()) {
      const tm = m as TextMessage;
      if (tm.role === MessageRole.User) {
        // Reset pending context on each new user turn
        pendingNodes = [];
        pendingActions = [];
        result.push({
          id: tm.id ?? crypto.randomUUID(),
          role: "user",
          content: tm.content ?? "",
        });
      } else if (tm.role === MessageRole.Assistant) {
        const content = tm.content ?? "";
        // Skip CopilotKit raw JSON state snapshots
        if (isRawStateContent(content)) continue;
        const allCalls = [...pendingNodes, ...pendingActions];
        result.push({
          id: tm.id ?? crypto.randomUUID(),
          role: "assistant",
          content,
          toolCalls: allCalls.length > 0 ? allCalls : undefined,
        });
        pendingNodes = [];
        pendingActions = [];
      }
    }
  }

  // Streaming sentinel: if there are accumulated node/action steps that haven't
  // been consumed by a final assistant TextMessage yet (i.e. the agent is still
  // running), inject a placeholder message so Panel D can render the in-flight
  // Chain of Thought in real time.
  if (pendingNodes.length > 0 || pendingActions.length > 0) {
    result.push({
      id: "__streaming__",
      role: "assistant",
      content: "",
      toolCalls: [...pendingNodes, ...pendingActions],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Null input — used for Panel A when side-by-side (shared LabInput used instead)
// ---------------------------------------------------------------------------

const NullInput = () => <div className="hidden" />;

// ---------------------------------------------------------------------------
// Panel A full renderer (used when Panel A is the only selected panel)
// This preserves the card + Header + CopilotChat layout, pixel-identical to /atlas5
// ---------------------------------------------------------------------------

interface PanelAAloneProps {
  activeAgent: AgentId;
}

function PanelAAlone({ activeAgent }: PanelAAloneProps) {
  const config = AGENT_CONFIG[activeAgent] ?? AGENT_CONFIG.ATLAS;
  return (
    <div className="p-4 w-full max-w-[500px]">
      <div className="h-full min-h-0 rounded-2xl border bg-card shadow-xl overflow-hidden flex flex-col">
        <Header />
        <CopilotChat
          key={activeAgent}
          className="flex-1 min-h-0"
          labels={{ initial: config.greeting }}
          suggestions={config.suggestions}
          Input={SidebarInput}
          AssistantMessage={AssistantBubble}
          UserMessage={UserBubble}
          RenderSuggestionsList={Suggestions}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel A inline renderer — used in side-by-side multi-panel mode
// Uses CopilotChat with its input hidden; LabInput at bottom handles sending.
// ---------------------------------------------------------------------------

interface PanelAInlineProps {
  activeAgent: AgentId;
  showLabel: boolean;
}

function PanelAInline({ activeAgent, showLabel }: PanelAInlineProps) {
  const config = AGENT_CONFIG[activeAgent] ?? AGENT_CONFIG.ATLAS;
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden border-r last:border-r-0">
      {showLabel && <PanelLabel id="A" />}
      <CopilotChat
        key={`inline-${activeAgent}`}
        className="flex-1 min-h-0"
        labels={{ initial: config.greeting }}
        suggestions={config.suggestions}
        Input={NullInput}
        AssistantMessage={AssistantBubble}
        UserMessage={UserBubble}
        RenderSuggestionsList={Suggestions}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LabChat
// ---------------------------------------------------------------------------

interface LabChatProps {
  className?: string;
  style?: CSSProperties;
  selectedPanels: Set<PanelId>;
  onToggle: (id: PanelId) => void;
  onSelectAll: () => void;
}

export function LabChat({
  className,
  style,
  selectedPanels,
  onToggle,
  onSelectAll,
}: LabChatProps) {
  const { surface, setAgent, setLens } = useSurfaceGateway();
  const activeAgent = surface.active_agent ?? "ATLAS";
  const activeLens = surface.active_lens ?? "CPC";

  const { visibleMessages, appendMessage, isLoading, stopGeneration } =
    useCopilotChat();

  // Local fast replies — conversational queries answered instantly without hitting Python.
  // Cleared whenever a domain query fires so CopilotKit owns the full thread from that point.
  const [localFastReplies, setLocalFastReplies] = useState<DisplayMessage[]>([]);

  const ckMessages = useMemo(
    () => toDisplayMessages(visibleMessages),
    [visibleMessages]
  );

  // Merge: CopilotKit domain exchanges first, then any trailing conversational replies.
  const displayMessages = useMemo(
    () => [...ckMessages, ...localFastReplies],
    [ckMessages, localFastReplies]
  );

  const handleSend = async (text: string) => {
    if (isConversational(text)) {
      // Edge-classifier: instant local reply — no round-trip to Python agent.
      setLocalFastReplies((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: text },
        { id: crypto.randomUUID(), role: "assistant", content: getInstantReply(text, activeAgent as AgentId) },
      ]);
      return;
    }
    // Domain query — clear local replies (CopilotKit owns the thread from here).
    setLocalFastReplies([]);
    await appendMessage(
      new TextMessage({ role: MessageRole.User, content: text })
    );
  };

  const handleAgentChange = (agent: AgentId) => {
    setAgent(agent);
    console.log("[LabChat] agent →", agent);
  };

  const handleLensChange = (lens: LensId) => {
    setLens(lens);
    console.log("[LabChat] lens →", lens);
  };

  const isSingleA =
    selectedPanels.size === 1 && selectedPanels.has("A");
  const showLabel = selectedPanels.size > 1;

  // ---------------------------------------------------------------------------
  // Single Panel A: original card layout (pixel-identical below switcher)
  // ---------------------------------------------------------------------------
  if (isSingleA) {
    return (
      <div className={cn("flex flex-col h-full min-h-0 overflow-hidden", className)} style={style}>
        {/* Switcher bar */}
        <div className="shrink-0 bg-background border-b">
          <PanelSwitcher
            selectedPanels={selectedPanels}
            onToggle={onToggle}
            onSelectAll={onSelectAll}
            activeAgent={activeAgent}
            activeLens={activeLens as LensId}
          />
        </div>
        {/* Original panel A layout */}
        <div className="flex-1 min-h-0 overflow-hidden flex items-start justify-start">
          <PanelAAlone activeAgent={activeAgent} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Multi-panel: side-by-side panels + shared input
  // ---------------------------------------------------------------------------
  return (
    <div className={cn("flex flex-col h-full min-h-0 overflow-hidden", className)} style={style}>
      {/* Combined header + switcher */}
      <div className="shrink-0 bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-2 bg-accent/10 border-b">
          <div className="inline-flex items-center justify-center rounded-full border border-accent/40 bg-card size-8 p-2">
            <span className="text-lg p-2">🧭</span>
          </div>
          <span className="text-base font-medium text-foreground">
            ATLAS — CPC Decision Intelligence
          </span>
        </div>
        <PanelSwitcher
          selectedPanels={selectedPanels}
          onToggle={onToggle}
          onSelectAll={onSelectAll}
          activeAgent={activeAgent}
          activeLens={activeLens as LensId}
        />
      </div>

      {/* Panels row */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden divide-x">
        {selectedPanels.has("A") && (
          <PanelAInline activeAgent={activeAgent} showLabel={showLabel} />
        )}

        {selectedPanels.has("B") && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            {showLabel && <PanelLabel id="B" />}
            <PanelBBlazity
              messages={displayMessages}
              isLoading={isLoading}
            />
          </div>
        )}

        {selectedPanels.has("C") && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            {showLabel && <PanelLabel id="C" />}
            <PanelCShadcn
              messages={displayMessages}
              isLoading={isLoading}
            />
          </div>
        )}

        {selectedPanels.has("D") && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            {showLabel && <PanelLabel id="D" />}
            <PanelDAtlas
              messages={displayMessages}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Shared input */}
      <LabInput
        onSend={handleSend}
        isLoading={isLoading}
        onStop={stopGeneration}
        onAgentChange={handleAgentChange}
        onLensChange={handleLensChange}
        activeAgent={activeAgent as AgentId}
        activeLens={activeLens as LensId}
      />
    </div>
  );
}
