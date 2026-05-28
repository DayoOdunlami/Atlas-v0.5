"use client";

import { AgentState, AgentSetState, SurfaceState } from "@/lib/types";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import type { AgentId, LensId } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";
import { AgentStatusDot } from "@/components/dashboard/layout/agent-status-dot";

const AGENTS: AgentId[] = ["ATLAS", "JARVIS", "CICERONE", "HYVE"];
const LENSES: LensId[] = ["CPC", "Atlas", "Ecosystem", "Funder", "Mode"];
const MODES = ["chat", "artifact", "canvas"] as const;

const agentDescriptions: Record<AgentId, string> = {
  ATLAS:    "Innovation Strategist",
  JARVIS:   "Corpus Explorer",
  CICERONE: "Cross-Sector Transfer",
  HYVE:     "Climate Adaptation",
};

interface SurfaceSwitcherProps {
  state: AgentState;
  setState: AgentSetState<AgentState>;
}

function patchCoagentState(
  state: AgentState,
  setState: AgentSetState<AgentState>,
  update: Partial<SurfaceState>,
) {
  setState({
    ...state,
    surface_state: {
      mode: state.surface_state?.mode ?? "artifact",
      activeAgent: state.surface_state?.activeAgent ?? "ATLAS",
      lens: state.surface_state?.lens ?? "CPC",
      timestamp: new Date().toISOString(),
      ...update,
    },
  });
}

export function SurfaceSwitcher({ state, setState }: SurfaceSwitcherProps) {
  // useSurfaceGateway is the single source of truth for active agent/lens/mode.
  // Clicking a tab updates BOTH the Zustand gateway (→ CopilotKitProvider agent prop)
  // AND the coagent state (→ Python context packet via useCopilotReadable).
  const { surface, setAgent, setLens } = useSurfaceGateway();
  const active = surface.active_agent;
  const lens = surface.active_lens;
  const mode = state.surface_state?.mode ?? "artifact";

  const handleAgentClick = (agent: AgentId) => {
    // 1. Update Zustand gateway → CopilotKitProvider picks up new agent prop
    setAgent(agent);
    // 2. Sync into coagent state so useCopilotReadable sends correct context to Python
    patchCoagentState(state, setState, { activeAgent: agent });
  };

  const handleLensClick = (l: LensId) => {
    setLens(l);
    patchCoagentState(state, setState, { lens: l });
  };

  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-border">
      {/* Agent row */}
      <div className="flex items-center gap-1 flex-wrap">
        {AGENTS.map((agent) => (
          <button
            key={agent}
            onClick={() => handleAgentClick(agent)}
            title={agentDescriptions[agent]}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
              active === agent
                ? "bg-indigo-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {agent}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden md:inline">
            {agentDescriptions[active]}
          </span>
          <AgentStatusDot />
        </span>
      </div>

      {/* Lens + Mode row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Lens:</span>
          {LENSES.map((l) => (
            <button
              key={l}
              onClick={() => handleLensClick(l)}
              className={cn(
                "px-2 py-0.5 rounded text-xs transition-colors",
                lens === l
                  ? "bg-indigo-100 text-indigo-700 font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => patchCoagentState(state, setState, { mode: m })}
              className={cn(
                "px-2 py-0.5 rounded text-xs capitalize transition-colors",
                mode === m
                  ? "bg-indigo-100 text-indigo-700 font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
