/**
 * Atlas 5 — Agent Switcher
 *
 * Tab bar that switches between the four Atlas 5 agents.
 * Each tab carries data-agent="<id>" for Playwright assertions.
 */
"use client";

import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import type { AgentId } from "@/lib/atlas5/types";

const AGENTS: Array<{ id: AgentId; label: string; description: string }> = [
  {
    id: "ATLAS",
    label: "ATLAS",
    description: "Green Book business case + Five Case Model",
  },
  {
    id: "JARVIS",
    label: "JARVIS",
    description: "Corpus explorer — evidence triage & citation",
  },
  {
    id: "CICERONE",
    label: "CICERONE",
    description: "Cross-sector transfer & transferability scoring",
  },
  {
    id: "HYVE",
    label: "HYVE",
    description: "Climate adaptation — HIVE corpus analysis",
  },
];

export function AgentSwitcher() {
  const { surface, setAgent } = useSurfaceGateway();

  return (
    <nav
      aria-label="Agent switcher"
      data-testid="agent-switcher"
      className="flex items-center gap-1 px-2"
    >
      {AGENTS.map((agent) => {
        const isActive = surface.active_agent === agent.id;
        return (
          <button
            key={agent.id}
            type="button"
            data-agent={agent.id}
            data-testid={`agent-tab-${agent.id}`}
            aria-pressed={isActive}
            aria-label={agent.description}
            onClick={() => setAgent(agent.id)}
            className={[
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            ].join(" ")}
          >
            {agent.label}
          </button>
        );
      })}
    </nav>
  );
}
