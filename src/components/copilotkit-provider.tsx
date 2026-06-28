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
import { useEffect, useState } from "react";
import { useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import type { AgentId } from "@/lib/atlas5/types";

const ORCHESTRATOR_V1 =
  process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 === "true";

const WORKBENCH_THREAD_KEY = "atlas5-workbench-thread-id";
const ATLAS_V5_THREAD_KEY = "atlas5-v5-thread-id";

function readOrCreateThreadId(storageKey: string): string {
  if (typeof sessionStorage === "undefined") return "";
  let id = sessionStorage.getItem(storageKey);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(storageKey, id);
  }
  return id;
}

/** Rotate LangGraph/CopilotKit thread — call from Workbench "New chat". */
export function startNewWorkbenchThread(): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem(WORKBENCH_THREAD_KEY, id);
  window.dispatchEvent(new Event("atlas5:new-workbench-thread"));
  return id;
}

/** Read current v5 thread id (creates one if missing). */
export function readAtlasV5ThreadId(): string {
  return readOrCreateThreadId(ATLAS_V5_THREAD_KEY);
}

/** Set v5 thread id — remounts CopilotKit only when the id actually changes. */
export function setAtlasV5ThreadId(id: string): void {
  if (typeof sessionStorage === "undefined") return;
  const prev = sessionStorage.getItem(ATLAS_V5_THREAD_KEY);
  sessionStorage.setItem(ATLAS_V5_THREAD_KEY, id);
  if (prev !== id) {
    window.dispatchEvent(new Event("atlas5:new-atlas-v5-thread"));
  }
}

/** Rotate /atlas v5 CopilotKit thread. */
export function startNewAtlasV5Thread(): string {
  const id = crypto.randomUUID();
  setAtlasV5ThreadId(id);
  return id;
}

function useStableThreadId(
  enabled: boolean,
  storageKey: string,
  resetEvent: string,
): string | undefined {
  const [threadId, setThreadId] = useState<string | undefined>(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    return readOrCreateThreadId(storageKey);
  });

  useEffect(() => {
    if (!enabled) {
      setThreadId(undefined);
      return;
    }
    const syncFromStorage = () => {
      setThreadId(readOrCreateThreadId(storageKey));
    };
    syncFromStorage();
    window.addEventListener(resetEvent, syncFromStorage);
    return () => window.removeEventListener(resetEvent, syncFromStorage);
  }, [enabled, storageKey, resetEvent]);

  return threadId;
}

function useStableWorkbenchThreadId(enabled: boolean): string | undefined {
  return useStableThreadId(enabled, WORKBENCH_THREAD_KEY, "atlas5:new-workbench-thread");
}

function useStableAtlasV5ThreadId(enabled: boolean): string | undefined {
  return useStableThreadId(enabled, ATLAS_V5_THREAD_KEY, "atlas5:new-atlas-v5-thread");
}

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

function isAtlasV5Route(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/atlas");
}

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeAgent = useSurfaceStore((s) => s.surface.active_agent);
  const surfaceAgent = AGENT_NAME[activeAgent] ?? "atlas";
  const orchestratorRoute = ORCHESTRATOR_V1 && isOrchestratorWorkbenchRoute(pathname);
  const atlasV5Route = isAtlasV5Route(pathname);
  const agentName = orchestratorRoute
    ? "workbench"
    : atlasV5Route
      ? "atlas_v5"
      : surfaceAgent;
  const workbenchThreadId = useStableWorkbenchThreadId(orchestratorRoute);
  const atlasV5ThreadId = useStableAtlasV5ThreadId(atlasV5Route);
  const threadId = orchestratorRoute ? workbenchThreadId : atlasV5Route ? atlasV5ThreadId : undefined;
  // Remount only on explicit thread rotation (New question) — stable id from first client paint.
  const providerKey = orchestratorRoute
    ? workbenchThreadId
    : atlasV5Route
      ? `atlas_v5-${atlasV5ThreadId ?? "init"}`
      : agentName;

  return (
    <CopilotKit
      key={providerKey}
      runtimeUrl="/api/copilotkit"
      agent={agentName}
      threadId={threadId}
      showDevConsole={false}
    >
      {children}
    </CopilotKit>
  );
}
