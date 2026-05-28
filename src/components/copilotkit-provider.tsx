/**
 * Dynamic CopilotKit provider.
 *
 * Reads the active agent from the Atlas 5 surface-gateway Zustand store and
 * passes it to <CopilotKit agent={…}> so chat messages are routed to the right
 * Python agent (atlas | jarvis | cicerone | hyve).
 *
 * Only agents registered in /api/copilotkit/route.ts will actually run — others
 * fall back to "atlas" until their Python graphs are wired up.
 */
"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import type { AgentId } from "@/lib/atlas5/types";

/** Map from Atlas 5 AgentId (uppercase) to the name registered in CopilotKit. */
const AGENT_NAME: Record<AgentId, string> = {
  ATLAS:    "atlas",
  JARVIS:   "jarvis",
  CICERONE: "atlas",   // not yet wired — fall back to atlas
  HYVE:     "atlas",   // not yet wired — fall back to atlas
};

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  const activeAgent = useSurfaceStore((s) => s.surface.active_agent);
  const agentName = AGENT_NAME[activeAgent] ?? "atlas";

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent={agentName}
      showDevConsole={false}
    >
      {children}
    </CopilotKit>
  );
}
