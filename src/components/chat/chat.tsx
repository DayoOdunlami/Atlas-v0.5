/**
 * Chat panel — CopilotKit chat with agent-aware suggestions.
 * Reads the active agent from useSurfaceGateway and swaps suggestions accordingly.
 */
"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { SidebarInput } from "@/components/chat/layout/input";
import { AssistantBubble } from "@/components/chat/layout/assistant-message";
import { UserBubble } from "@/components/chat/layout/user-message";
import { Suggestions } from "@/components/chat/layout/suggestion";
import { cn } from "@/lib/utils";
import { Header } from "@/components/chat/layout/header";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import type { AgentId } from "@/lib/atlas5/types";

interface ChatProps {
  className: string;
}

// ---------------------------------------------------------------------------
// Per-agent suggestions and greeting
// ---------------------------------------------------------------------------

const AGENT_CONFIG: Record<
  AgentId,
  { greeting: string; suggestions: Array<{ title: string; message: string }> }
> = {
  ATLAS: {
    greeting:
      "👋 Hi, I'm ATLAS.\n\nI help CPC strategists build evidence-backed Five Case Model investment briefs grounded in the CPC corpus — real projects, live funding calls, policy evidence, and HIVE case studies.\n\nTry one of the prompts below, or ask me anything.",
    suggestions: [
      {
        title: "Autonomous freight corridors",
        message:
          "What is the strategic case for CPC to commission a programme on autonomous freight corridors in the UK?",
      },
      {
        title: "EV charging infrastructure",
        message:
          "Build an investment brief for a CPC-led EV charging infrastructure programme targeting underserved regions.",
      },
      {
        title: "Stress test a scenario",
        message:
          "Stress test the assumption that autonomous freight will achieve commercial viability in the UK by 2032.",
      },
    ],
  },
  JARVIS: {
    greeting:
      "🔍 I'm JARVIS.\n\nI explore the CPC corpus and surface ranked evidence with real citations — projects, knowledge docs, and live funding calls — grounded in similarity scores and confidence tiers.\n\nAsk me what the corpus knows.",
    suggestions: [
      {
        title: "Active travel evidence",
        message:
          "What evidence does the CPC corpus have on active travel and urban mobility innovation?",
      },
      {
        title: "Smart mobility projects",
        message:
          "Find CPC projects related to smart mobility, MaaS platforms, and data-driven transport.",
      },
      {
        title: "Live funding opportunities",
        message:
          "What live funding calls are currently open that align with CPC's digital infrastructure portfolio?",
      },
    ],
  },
  CICERONE: {
    greeting:
      "🧭 I'm CICERONE.\n\nI evaluate whether insights and models from one sector or geography can transfer to another. I score transferability 0–100, identify analogues, and flag HAVE / PARTIAL / MISSING evidence gaps.\n\nAsk me about cross-sector transfer.",
    suggestions: [
      {
        title: "Cross-sector transfer score",
        message:
          "How transferable is the MaaS model from Helsinki to mid-sized UK cities? Score the transferability and identify key evidence gaps.",
      },
      {
        title: "Analogue identification",
        message:
          "Find analogues from the energy sector that CPC could apply to last-mile freight decarbonisation.",
      },
      {
        title: "Evidence gap analysis",
        message:
          "What evidence is missing before CPC can make a strong case for rural autonomous transport?",
      },
    ],
  },
  HYVE: {
    greeting:
      "🌿 I'm HYVE.\n\nI surface climate adaptation and resilience evidence from the HIVE case studies database, mapped to transport modes and confidence tiers.\n\nAsk me about climate risk and adaptation.",
    suggestions: [
      {
        title: "Climate resilience for transport",
        message:
          "What HIVE evidence exists on climate resilience interventions for UK transport infrastructure?",
      },
      {
        title: "Flood risk and roads",
        message:
          "Find HIVE case studies on flood risk adaptation for road networks in coastal and low-lying areas.",
      },
      {
        title: "Active travel and heat",
        message:
          "What does the HIVE corpus say about heat stress impacts on active travel infrastructure?",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Chat({ className }: ChatProps) {
  const { surface } = useSurfaceGateway();
  const activeAgent = surface.active_agent ?? "ATLAS";
  const config = AGENT_CONFIG[activeAgent] ?? AGENT_CONFIG.ATLAS;

  return (
    <div className={cn(className, "p-4 max-w-[500px]")}>
      <div className="h-full min-h-0 rounded-2xl border bg-card shadow-xl overflow-hidden flex flex-col">
        <Header />
        <CopilotChat
          key={activeAgent} // re-mount on agent switch to reset chat state display
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
