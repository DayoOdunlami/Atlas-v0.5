"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { RenderBlock } from "@/lib/workbench/atlas-render-model";
import { BlockRenderer } from "./block-renderer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  blocks: RenderBlock[];
  onInspect: (kind: string, payload?: unknown) => void;
  defaultOpen?: boolean;
}

export function CollapsedBlockSection({
  title,
  blocks,
  onInspect,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (blocks.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-4 py-3",
          "text-left text-sm font-medium text-foreground hover:bg-muted/40 transition-colors",
        )}
      >
        <ChevronDown
          className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <span>{title}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {blocks.length} {blocks.length === 1 ? "section" : "sections"}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 space-y-4">
        {blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} onInspect={onInspect} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
