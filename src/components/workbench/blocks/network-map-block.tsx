"use client";

import type { NetworkMapBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { WorkbenchRichVisual } from "../workbench-rich-visual";
import {
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import type { VisualId } from "@/lib/workbench/visual-registry";
import { Badge } from "@/components/ui/badge";

interface Props {
  block: T;
  effectiveVisual: VisualId;
}

export function NetworkMapBlock({ block, effectiveVisual }: Props) {
  const atlasVisual = buildAtlasVisualBlock(block, effectiveVisual);
  const dominant = usesDominantAtlasVisual(block.type, effectiveVisual);
  const { nodes, edges } = block.content;

  return (
    <BlockShell headline={block.headline}>
      {dominant && atlasVisual ? (
        <WorkbenchRichVisual visual={atlasVisual} className="min-h-[360px]" />
      ) : (
        <p className="text-xs text-muted-foreground">No graph data available.</p>
      )}

      {nodes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {nodes.slice(0, 12).map((node) => (
            <Badge
              key={node.id}
              variant="outline"
              className="text-[10px] font-normal capitalize"
            >
              {node.label.slice(0, 36)}
            </Badge>
          ))}
          {nodes.length > 12 && (
            <span className="text-[10px] text-muted-foreground self-center">
              +{nodes.length - 12} more
            </span>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground">
        {nodes.length} entities · {edges.length} relationships
      </p>
    </BlockShell>
  );
}
