"use client";

/**
 * Renders atlas5 Art Director visuals inside the workbench canvas.
 * Seam 1 — wires /lab/visualisation vocabulary into live blocks.
 */

import { BlockRenderer as Atlas5BlockRenderer } from "@/components/atlas5/block-renderer";
import type { VisualBlock } from "@/lib/atlas5/block-vocabulary";
import { cn } from "@/lib/utils";

interface Props {
  visual: VisualBlock;
  className?: string;
}

export function WorkbenchRichVisual({ visual, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card overflow-hidden",
        className,
      )}
      data-visual-type={visual.type}
    >
      <Atlas5BlockRenderer block={visual} />
    </div>
  );
}
