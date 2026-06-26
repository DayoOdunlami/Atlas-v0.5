"use client";

import { Columns2, MessageSquare, Maximize2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SurfaceViewMode } from "@/lib/layout/surface-split-prefs";
import { useSurfaceSplitOptional } from "@/components/layout/surface-split-provider";

const MODES: {
  id: SurfaceViewMode;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "canvas-focus", label: "Canvas focus", short: "Canvas", icon: Maximize2 },
  { id: "balanced", label: "Balanced split", short: "Split", icon: Columns2 },
  { id: "chat-focus", label: "Chat focus", short: "Chat", icon: MessageSquare },
];

export function SurfaceViewModeToggle({
  className,
  compact,
}: {
  className?: string;
  /** Icon-only on narrow headers. */
  compact?: boolean;
}) {
  const ctx = useSurfaceSplitOptional();
  if (!ctx) return null;

  const { viewMode, setViewMode } = ctx;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5",
        className,
      )}
      role="group"
      aria-label="Layout focus"
    >
      {MODES.map(({ id, label, short, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={viewMode === id}
          onClick={() => setViewMode(id)}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
            viewMode === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          {!compact ? <span className="hidden sm:inline">{short}</span> : null}
        </button>
      ))}
    </div>
  );
}
