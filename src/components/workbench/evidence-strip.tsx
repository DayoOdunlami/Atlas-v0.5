"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Citation {
  id: string;
  title?: string;
  organisation?: string;
  score?: number;
}

interface Props {
  citations: Citation[];
  collapsed?: boolean;
  onExpand?: () => void;
  className?: string;
}

export function EvidenceStrip({
  citations,
  collapsed = true,
  onExpand,
  className,
}: Props) {
  if (citations.length === 0) return null;

  const label = `${citations.length} verified source${citations.length !== 1 ? "s" : ""}`;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg border border-border/80 bg-muted/30 px-4 py-2.5",
          "text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
          className,
        )}
      >
        <span className="font-medium">{label}</span>
        <ChevronRight className="w-4 h-4 ml-auto shrink-0 opacity-60" />
      </button>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Evidence ({citations.length})
      </p>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
        {citations.slice(0, 12).map((c) => (
          <li key={c.id} className="text-sm text-foreground/90 leading-snug">
            <span className="font-medium">{c.title ?? c.id}</span>
            {c.organisation && (
              <span className="text-muted-foreground"> · {c.organisation}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
