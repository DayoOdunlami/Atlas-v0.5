"use client";

import type { OpportunityListBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { WorkbenchRichVisual } from "../workbench-rich-visual";
import {
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import type { VisualId } from "@/lib/workbench/visual-registry";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface Props {
  block: T;
  effectiveVisual: VisualId;
}

export function OpportunityListBlock({ block, effectiveVisual }: Props) {
  const atlasVisual = buildAtlasVisualBlock(block, effectiveVisual);
  const dominant = usesDominantAtlasVisual(block.type, effectiveVisual);

  return (
    <BlockShell headline={block.headline} caption={block.caption}>
      {dominant && atlasVisual && (
        <div className="mb-4">
          <WorkbenchRichVisual visual={atlasVisual} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Project</TableHead>
            <TableHead className="text-xs">Organisation</TableHead>
            <TableHead className="text-xs w-16">Score</TableHead>
            <TableHead className="text-xs w-24">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.content.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs align-top font-medium">{row.title}</TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">
                {row.organisation ?? row.funder ?? "—"}
              </TableCell>
              <TableCell className="text-xs align-top tabular-nums">
                {row.score != null ? `${Math.round(row.score * 100)}%` : "—"}
              </TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">
                {(row as { source?: string; status?: string }).source === "external"
                  ? "candidate (web)"
                  : (row.status ?? "corpus")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockShell>
  );
}
