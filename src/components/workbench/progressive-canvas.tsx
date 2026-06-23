"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { RenderBlock } from "@/lib/workbench/atlas-render-model";
import { BlockRenderer } from "./block-renderer";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsedBlockSectionProps {
  title: string;
  blocks: RenderBlock[];
  defaultOpen?: boolean;
  onInspect: (kind: string, payload?: unknown) => void;
}

export function CollapsedBlockSection({
  title,
  blocks,
  defaultOpen = false,
  onInspect,
}: CollapsedBlockSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (blocks.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {blocks.length} {blocks.length === 1 ? "section" : "sections"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">
              {blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} onInspect={onInspect} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EvidenceStripProps {
  count: number;
  citations: Array<{ id: string; title?: string; organisation?: string }>;
  onInspect: () => void;
}

export function EvidenceStrip({ count, citations, onInspect }: EvidenceStripProps) {
  if (count <= 0 && citations.length === 0) return null;

  const n = count || citations.length;
  const preview = citations.slice(0, 2).map((c) => c.title || c.id.slice(0, 8)).join(" · ");

  return (
    <button
      type="button"
      onClick={onInspect}
      className={cn(
        "w-full flex items-center justify-between gap-3 rounded-lg border border-dashed border-border",
        "px-4 py-3 text-left hover:bg-muted/30 transition-colors",
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {n} verified source{n !== 1 ? "s" : ""}
      </span>
      {preview && (
        <span className="text-xs text-muted-foreground truncate max-w-[55%]">{preview} →</span>
      )}
    </button>
  );
}

interface PrimaryActionChipProps {
  label: string;
}

export function PrimaryActionChip({ label }: PrimaryActionChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
        Next move
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}
