"use client";

/**
 * AgentSelector — shadcn/ai ModelSelector pattern adapted for Atlas 5 agents and lenses.
 *
 * Uses Dialog + Command (already in our shadcn stack) — no extra dependency.
 * Displayed as a compact chip button in the LabInput footer; opens a searchable
 * command palette with agent/lens options grouped by category.
 */

import { useState } from "react";
import { CheckIcon, ChevronDown, BrainCircuit, Search, Globe, Leaf, FlaskConical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentId, LensId } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// Agent & Lens definitions
// ---------------------------------------------------------------------------

export interface AgentDef {
  id: AgentId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // tailwind text-* class
  bg: string;    // tailwind bg-*/border-* class pair
}

export interface LensDef {
  id: LensId;
  name: string;
  description: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: "ATLAS",
    name: "ATLAS",
    description: "Green Book investment strategist — Five Case Model briefs",
    icon: BrainCircuit,
    color: "text-accent",
    bg: "bg-accent/10 border-accent/40",
  },
  {
    id: "JARVIS",
    name: "JARVIS",
    description: "Corpus explorer — ranked evidence with real citations",
    icon: Search,
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-200",
  },
  {
    id: "CICERONE",
    name: "CICERONE",
    description: "Cross-sector transfer — analogues and transferability scores",
    icon: Globe,
    color: "text-violet-500",
    bg: "bg-violet-50 border-violet-200",
  },
  {
    id: "HYVE",
    name: "HYVE",
    description: "Climate adaptation — HIVE case studies and transport modes",
    icon: Leaf,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
];

export const LENSES: LensDef[] = [
  { id: "CPC", name: "CPC", description: "CPC portfolio and strategic lens" },
  { id: "Atlas", name: "Atlas", description: "Full Atlas evidence base" },
  { id: "Ecosystem", name: "Ecosystem", description: "Innovation ecosystem lens" },
  { id: "Funder", name: "Funder", description: "Funding landscape and calls" },
  { id: "Mode", name: "Mode", description: "Transport mode lens" },
];

// ---------------------------------------------------------------------------
// Tiny model config display (lab-only — shows what MODEL_NAME env var is set to)
// ---------------------------------------------------------------------------

const LAB_MODEL_DISPLAY = "claude-sonnet-4-6"; // mirrors CLAUDE.md lock

// ---------------------------------------------------------------------------
// AgentSelectorTrigger — the chip shown in the input footer
// ---------------------------------------------------------------------------

interface AgentChipProps {
  agent: AgentDef;
  onClick?: () => void;
  className?: string;
}

export function AgentChip({ agent, onClick, className }: AgentChipProps) {
  const Icon = agent.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
        agent.bg,
        agent.color,
        className
      )}
    >
      <Icon className="size-3 shrink-0" />
      {agent.name}
      <ChevronDown className="size-3 opacity-60 shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// LensChip
// ---------------------------------------------------------------------------

interface LensChipProps {
  lens: LensId;
  onClick?: () => void;
  className?: string;
}

export function LensChip({ lens, onClick, className }: LensChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
        "bg-muted/60 border-border text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-primary/40 shrink-0" />
      {lens}
      <ChevronDown className="size-3 opacity-50 shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ModelChip — shows the locked LLM (lab info, non-interactive in prod)
// ---------------------------------------------------------------------------

interface ModelChipProps {
  className?: string;
}

export function ModelChip({ className }: ModelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono",
        "bg-muted/40 border-border/60 text-muted-foreground/60",
        className
      )}
      title="Model locked per CLAUDE.md — change via MODEL_NAME env var"
    >
      <FlaskConical className="size-2.5 shrink-0" />
      {LAB_MODEL_DISPLAY}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AgentSelectorDialog
// ---------------------------------------------------------------------------

interface AgentSelectorProps {
  activeAgent: AgentId;
  activeLens: LensId;
  onAgentChange: (agent: AgentId) => void;
  onLensChange: (lens: LensId) => void;
}

export function AgentSelector({
  activeAgent,
  activeLens,
  onAgentChange,
  onLensChange,
}: AgentSelectorProps) {
  const [agentOpen, setAgentOpen] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);

  const agent = AGENTS.find((a) => a.id === activeAgent) ?? AGENTS[0];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Agent selector */}
      <Dialog open={agentOpen} onOpenChange={setAgentOpen}>
        <DialogTrigger asChild>
          <AgentChip agent={agent} />
        </DialogTrigger>
        <DialogContent className="p-0 max-w-sm" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Select agent</DialogTitle>
          <Command>
            <CommandInput placeholder="Search agents…" className="h-auto py-3" />
            <CommandList>
              <CommandEmpty>No agents found.</CommandEmpty>
              <CommandGroup heading="Agents">
                {AGENTS.map((a) => {
                  const AIcon = a.icon;
                  const isActive = a.id === activeAgent;
                  return (
                    <CommandItem
                      key={a.id}
                      value={a.name}
                      onSelect={() => {
                        onAgentChange(a.id);
                        setAgentOpen(false);
                      }}
                      className="gap-2"
                    >
                      <div
                        className={cn(
                          "size-6 rounded-full flex items-center justify-center border shrink-0",
                          a.bg
                        )}
                      >
                        <AIcon className={cn("size-3", a.color)} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {a.description}
                        </span>
                      </div>
                      {isActive && <CheckIcon className="ml-auto size-4 shrink-0 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Lens selector */}
      <Dialog open={lensOpen} onOpenChange={setLensOpen}>
        <DialogTrigger asChild>
          <LensChip lens={activeLens} />
        </DialogTrigger>
        <DialogContent className="p-0 max-w-xs" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Select lens</DialogTitle>
          <Command>
            <CommandInput placeholder="Search lenses…" className="h-auto py-3" />
            <CommandList>
              <CommandEmpty>No lenses found.</CommandEmpty>
              <CommandGroup heading="Lenses">
                {LENSES.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={l.name}
                    onSelect={() => {
                      onLensChange(l.id as LensId);
                      setLensOpen(false);
                    }}
                    className="gap-2"
                  >
                    <span className="size-2 rounded-full bg-primary/40 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium">{l.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {l.description}
                      </span>
                    </div>
                    {activeLens === l.id && (
                      <CheckIcon className="ml-auto size-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Model lock display */}
      <ModelChip className="hidden sm:inline-flex" />
    </div>
  );
}
