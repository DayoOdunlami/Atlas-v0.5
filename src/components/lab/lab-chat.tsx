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
import { toDisplayMessages } from "@/lib/atlas5/display-messages";
import type { DisplayMessage } from "@/components/lab/types";
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

// toDisplayMessages is imported from @/lib/atlas5/display-messages (shared with shell)

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
