"use client";

import { AgentState, AgentSetState, SurfaceState } from "@/lib/types";
import { cn } from "@/lib/utils";

const AGENTS = ["ATLAS", "JARVIS", "CICERONE", "HYVE"] as const;
const LENSES = ["CPC", "Atlas", "Ecosystem", "Funder", "Mode"] as const;
const MODES = ["chat", "artifact", "canvas"] as const;

const agentDescriptions: Record<string, string> = {
  ATLAS: "Innovation Strategist",
  JARVIS: "Corpus Explorer",
  CICERONE: "Cross-Sector Transfer",
  HYVE: "Climate Adaptation",
};

interface SurfaceSwitcherProps {
  state: AgentState;
  setState: AgentSetState<AgentState>;
}

function patch(
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
  const ss = state.surface_state;
  const active = ss?.activeAgent ?? "ATLAS";
  const lens = ss?.lens ?? "CPC";
  const mode = ss?.mode ?? "artifact";

  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-border">
      {/* Agent row */}
      <div className="flex items-center gap-1 flex-wrap">
        {AGENTS.map((agent) => (
          <button
            key={agent}
            onClick={() => patch(state, setState, { activeAgent: agent })}
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
        <span className="ml-auto text-xs text-muted-foreground">
          {agentDescriptions[active]}
        </span>
      </div>

      {/* Lens + Mode row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Lens:</span>
          {LENSES.map((l) => (
            <button
              key={l}
              onClick={() => patch(state, setState, { lens: l })}
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
              onClick={() => patch(state, setState, { mode: m })}
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
