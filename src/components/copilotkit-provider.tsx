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
import { usePathname } from "next/navigation";
import { useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import type { AgentId } from "@/lib/atlas5/types";

const ORCHESTRATOR_V1 =
  process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 === "true";

/** Map from Atlas 5 AgentId (uppercase) to the name registered in CopilotKit. */
const AGENT_NAME: Record<AgentId, string> = {
  ATLAS:    "atlas",
  JARVIS:   "jarvis",
  CICERONE: "atlas",   // not yet wired — fall back to atlas
  HYVE:     "atlas",   // not yet wired — fall back to atlas
};

function isOrchestratorWorkbenchRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/workbench") && !pathname.startsWith("/workbench/demo")) {
    return true;
  }
  return pathname === "/lab/orchestrator";
}

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeAgent = useSurfaceStore((s) => s.surface.active_agent);
  const surfaceAgent = AGENT_NAME[activeAgent] ?? "atlas";
  const agentName =
    ORCHESTRATOR_V1 && isOrchestratorWorkbenchRoute(pathname)
      ? "workbench"
      : surfaceAgent;

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
