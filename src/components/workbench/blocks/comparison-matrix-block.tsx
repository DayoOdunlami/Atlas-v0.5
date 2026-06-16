import type { ComparisonMatrixBlock as T } from "@/lib/workbench/atlas-render-model";
import type { SwotQuadrantContent } from "@/lib/workbench/patch-normalize";
import { BlockShell } from "../shared/block-shell";
import { WorkbenchRichVisual } from "../workbench-rich-visual";
import {
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import type { VisualId } from "@/lib/workbench/visual-registry";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

function isQuadrantContent(
  content: unknown,
): content is SwotQuadrantContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "quadrants" in content &&
    Array.isArray((content as SwotQuadrantContent).quadrants)
  );
}

function isMatchListContent(content: unknown): content is T["content"] {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    typeof (content[0] as { match_id?: string }).match_id === "string"
  );
}

// SWOT quadrant colour map — semantic tinting per quadrant so the eye can
// scan strengths / weaknesses / opportunities / threats at a glance.
const QUADRANT_THEMES: Record<string, { ring: string; chip: string; dot: string }> = {
  strengths: {
    ring: "border-emerald-200 dark:border-emerald-900/60",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  weaknesses: {
    ring: "border-amber-200 dark:border-amber-900/60",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  opportunities: {
    ring: "border-sky-200 dark:border-sky-900/60",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  threats: {
    ring: "border-rose-200 dark:border-rose-900/60",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function themeForQuadrant(label: string) {
  const key = label.trim().toLowerCase();
  return (
    QUADRANT_THEMES[key] ?? {
      ring: "border-border",
      chip: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground",
    }
  );
}

function QuadrantGrid({ content }: { content: SwotQuadrantContent }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {content.quadrants.map((q) => {
        const theme = themeForQuadrant(q.label);
        return (
          <div
            key={q.label}
            className={cn(
              "rounded-md border bg-background p-3.5 space-y-2 transition-colors",
              theme.ring,
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full inline-block", theme.dot)} />
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  theme.chip,
                )}
              >
                {q.label}
              </p>
            </div>
            <div
              className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none
                         [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:pl-4
                         [&_li]:my-0.5 [&_li]:marker:text-muted-foreground/60
                         [&_strong]:font-semibold [&_strong]:text-foreground"
            >
              <ReactMarkdown>{q.body || ""}</ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ComparisonMatrixBlock({
  block,
  effectiveVisual,
}: {
  block: T;
  effectiveVisual: VisualId;
}) {
  const content = block.content as unknown;

  // Visual narrowing: agent-emitted blocks may use either visual; type widens via cast
  const visual = block.visual as string;
  if (visual === "quadrant_grid" || isQuadrantContent(content)) {
    return (
      <BlockShell headline={block.headline} caption={block.caption}>
        <QuadrantGrid content={isQuadrantContent(content) ? content : { quadrants: [] }} />
      </BlockShell>
    );
  }

  const rows = isMatchListContent(content) ? content : [];
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
            <TableHead className="text-xs">Passport</TableHead>
            <TableHead className="text-xs">Target project</TableHead>
            <TableHead className="text-xs w-16">Score</TableHead>
            <TableHead className="text-xs w-28">Funder</TableHead>
            <TableHead className="text-xs w-20">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.match_id}>
              <TableCell className="text-xs align-top">{row.passport}</TableCell>
              <TableCell className="text-xs align-top">{row.target}</TableCell>
              <TableCell className="text-xs align-top tabular-nums">{Math.round(row.score * 100)}%</TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">{row.funder}</TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockShell>
  );
}
