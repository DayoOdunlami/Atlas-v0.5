"use client";

/**
 * ModelSelector — grouped provider + model dropdown.
 * Shows Anthropic / OpenAI / Google models based on available API keys.
 * Value stored locally; passes to Python via context_packet when Tier 1 is wired.
 */

import { ChevronDown, Cpu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

export interface ModelDef {
  id: string;
  label: string;
  provider: "anthropic" | "openai" | "google";
  badge?: string;
}

const MODEL_GROUPS: Array<{ provider: string; color: string; models: ModelDef[] }> = [
  {
    provider: "Anthropic",
    color: "text-amber-600",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", badge: "Default" },
      { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  provider: "anthropic", badge: "Fast"    },
      { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   provider: "anthropic", badge: "Powerful" },
    ],
  },
  {
    provider: "OpenAI",
    color: "text-emerald-600",
    models: [
      { id: "gpt-4.1",   label: "GPT-4.1",   provider: "openai" },
      { id: "gpt-4o",    label: "GPT-4o",    provider: "openai" },
      { id: "o3-mini",   label: "o3-mini",   provider: "openai", badge: "Reasoning" },
    ],
  },
  {
    provider: "Google",
    color: "text-blue-600",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google", badge: "Fast"    },
      { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   provider: "google"                   },
    ],
  },
];

export const ALL_MODELS: ModelDef[] = MODEL_GROUPS.flatMap((g) => g.models);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
  const active = ALL_MODELS.find((m) => m.id === value) ?? ALL_MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            "bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted",
            className
          )}
        >
          <Cpu className="size-3 shrink-0" />
          <span className="truncate max-w-[120px]">{active.label}</span>
          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {MODEL_GROUPS.map((group, gi) => (
          <div key={group.provider}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className={cn("text-[10px] font-semibold uppercase tracking-wide", group.color)}>
                {group.provider}
              </DropdownMenuLabel>
              {group.models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => onChange(model.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 cursor-pointer",
                    model.id === value && "bg-accent/50"
                  )}
                >
                  <span className="text-xs">{model.label}</span>
                  {model.badge && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                      {model.badge}
                    </Badge>
                  )}
                  {model.id === value && (
                    <span className="ml-auto size-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
