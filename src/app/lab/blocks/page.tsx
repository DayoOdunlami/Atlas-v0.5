"use client";

/**
 * /lab/blocks — regression gallery for all art-director block types.
 * Golden (example) + empty states for visual QA without running the agent.
 */

import Link from "next/link";
import { BLOCK_VOCABULARY, getReadyBlocks, type VisualBlock } from "@/lib/atlas5/block-vocabulary";
import { BlockRenderer } from "@/components/atlas5/block-renderer";
import { cn } from "@/lib/utils";

function emptyDataForType(type: string): unknown {
  switch (type) {
    case "domain_heatmap":
      return { domains: [] };
    case "knowledge_graph":
      return { nodes: [], edges: [] };
    case "options_comparison":
      return { options: [] };
    case "evidence_bar":
      return { items: [] };
    case "radar":
      return { dimensions: [] };
    case "npv_waterfall":
      return { components: [], discount_rate: 0.035 };
    case "gap_matrix":
      return { rows: [] };
    case "sankey":
      return { flows: [] };
    case "scatter":
      return { points: [] };
    case "bar":
      return { items: [] };
    case "area_line":
      return { points: [], x: "x", y: "y" };
    default:
      return {};
  }
}

function BlockGalleryCard({
  entry,
  variant,
  block,
}: {
  entry: (typeof BLOCK_VOCABULARY)[number];
  variant: "golden" | "empty";
  block: VisualBlock;
}) {
  const isEmpty = variant === "empty";

  return (
    <div
      data-testid={`block-gallery-${entry.type}-${variant}`}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
        <div>
          <p className="text-xs font-semibold">{entry.label}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{entry.type}</p>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
            isEmpty
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200",
          )}
        >
          {variant}
        </span>
      </div>
      <div className="p-3 min-h-[120px]">
        {isEmpty ? (
          <div className="flex h-full min-h-[100px] items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 px-4 text-center">
            <p className="text-xs text-muted-foreground">
              Insufficient data — min {entry.min_data_points} points required
            </p>
          </div>
        ) : (
          <BlockRenderer block={block} />
        )}
      </div>
    </div>
  );
}

export default function BlockGalleryPage() {
  const ready = getReadyBlocks();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Block Gallery</h1>
            <p className="text-xs text-muted-foreground">
              {ready.length} ready blocks — golden + empty regression states
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/" className="underline text-muted-foreground hover:text-foreground">
              ← Workspace
            </Link>
            <Link href="/lab/visualisation" className="underline text-muted-foreground hover:text-foreground">
              Workbench
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 space-y-8">
        {ready.map((entry) => (
          <section key={entry.type} className="space-y-3">
            <p className="text-sm text-muted-foreground">{entry.when_to_use}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <BlockGalleryCard
                entry={entry}
                variant="golden"
                block={{
                  type: entry.type,
                  title: entry.label,
                  data: entry.example_data,
                  source_count: entry.min_data_points,
                }}
              />
              <BlockGalleryCard
                entry={entry}
                variant="empty"
                block={{
                  type: entry.type,
                  title: entry.label,
                  data: emptyDataForType(entry.type),
                }}
              />
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
