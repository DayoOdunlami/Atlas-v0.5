"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid } from "lucide-react";
import type { AgentId, LensId } from "@/lib/atlas5/types";

export type PanelId = "A" | "B" | "C" | "D";

const PANEL_META: Record<PanelId, { label: string; title: string }> = {
  A: { label: "A", title: "A · Current" },
  B: { label: "B", title: "B · Blazity" },
  C: { label: "C", title: "C · shadcn" },
  D: { label: "D", title: "D · Atlas" },
};

interface PanelSwitcherProps {
  selectedPanels: Set<PanelId>;
  onToggle: (id: PanelId) => void;
  onSelectAll: () => void;
  activeAgent?: AgentId;
  activeLens?: LensId;
}

const ALL_PANELS: PanelId[] = ["A", "B", "C", "D"];

export function PanelSwitcher({
  selectedPanels,
  onToggle,
  onSelectAll,
  activeAgent,
  activeLens,
}: PanelSwitcherProps) {
  const allSelected =
    ALL_PANELS.every((id) => selectedPanels.has(id));

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/20 shrink-0">
      {/* Panel toggle buttons */}
      <div className="flex items-center gap-0.5">
        {ALL_PANELS.map((id) => {
          const active = selectedPanels.has(id);
          return (
            <button
              key={id}
              onClick={() => onToggle(id)}
              title={PANEL_META[id].title}
              className={cn(
                "px-2 py-0.5 text-xs font-mono rounded border transition-colors",
                active
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-card text-muted-foreground border-border hover:border-accent/60 hover:text-foreground"
              )}
            >
              {id}
            </button>
          );
        })}

        <button
          onClick={onSelectAll}
          title="Select all panels"
          className={cn(
            "px-2 py-0.5 text-xs rounded border transition-colors flex items-center gap-1 ml-1",
            allSelected
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-card text-muted-foreground border-border hover:border-accent/60 hover:text-foreground"
          )}
        >
          <LayoutGrid className="size-3" />
          All
        </button>
      </div>

      {/* Active agent / lens badges */}
      <div className="ml-auto flex items-center gap-1">
        {activeAgent && (
          <Badge
            variant="secondary"
            className="text-[10px] font-mono h-4 px-1.5 py-0"
          >
            @{activeAgent.toLowerCase()}
          </Badge>
        )}
        {activeLens && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono h-4 px-1.5 py-0"
          >
            @{activeLens.toLowerCase()}
          </Badge>
        )}
      </div>
    </div>
  );
}

/** Compact per-panel label bar shown when multiple panels are visible. */
export function PanelLabel({ id }: { id: PanelId }) {
  return (
    <div className="flex items-center px-3 py-1 border-b bg-muted/25 shrink-0">
      <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wide">
        {PANEL_META[id].title}
      </span>
    </div>
  );
}
