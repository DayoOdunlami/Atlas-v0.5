"use client";

/**
 * /lab/stakeholder-maps — stakeholder_map block golden + empty gallery.
 */

import Link from "next/link";
import { getBlock, type VisualBlock } from "@/lib/atlas5/block-vocabulary";
import { BlockRenderer } from "@/components/atlas5/block-renderer";
import { cn } from "@/lib/utils";

const ENTRY = getBlock("stakeholder_map");

function emptyStakeholderData() {
  return { nodes: [], edges: [] };
}

function BlockCard({
  variant,
  block,
}: {
  variant: "golden" | "empty";
  block: VisualBlock;
}) {
  const isEmpty = variant === "empty";

  return (
    <div
      data-testid={`stakeholder-map-${variant}`}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
        <p className="text-xs font-semibold">stakeholder_map — {variant}</p>
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
              Insufficient data — min {ENTRY?.min_data_points ?? 3} stakeholders required
            </p>
          </div>
        ) : (
          <BlockRenderer block={block} />
        )}
      </div>
    </div>
  );
}

export default function StakeholderMapsLabPage() {
  if (!ENTRY) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        stakeholder_map not found in BLOCK_VOCABULARY.
      </p>
    );
  }

  const goldenBlock: VisualBlock = {
    type: "stakeholder_map",
    title: "Programme stakeholder network",
    data: ENTRY.example_data,
  };

  const emptyBlock: VisualBlock = {
    type: "stakeholder_map",
    title: "Stakeholder map (empty)",
    data: emptyStakeholderData(),
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Stakeholder Maps</h1>
            <p className="text-xs text-muted-foreground">{ENTRY.when_to_use}</p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/lab/objects" className="underline text-muted-foreground hover:text-foreground">
              Objects lab
            </Link>
            <Link href="/lab/blocks" className="underline text-muted-foreground hover:text-foreground">
              Block gallery
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 grid gap-4 md:grid-cols-2">
        <BlockCard variant="golden" block={goldenBlock} />
        <BlockCard variant="empty" block={emptyBlock} />
      </main>
    </div>
  );
}
