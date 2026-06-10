"use client";

import type { AtlasRenderModel } from "@/lib/workbench/atlas-render-model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckSquare, Square } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  model: AtlasRenderModel;
}

export function SnapshotPreview({ open, onClose, model }: Props) {
  const { snapshot, blocks, data_quality_notes } = model;

  // Resolve block headlines from block IDs
  const blockMap = Object.fromEntries(blocks.map((b) => [b.id, b.headline]));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold leading-snug">
            Snapshot preview
          </DialogTitle>
          <DialogDescription className="text-xs line-clamp-2">
            {snapshot.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Included blocks */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Included blocks
            </p>
            <ul className="space-y-1.5">
              {snapshot.included_blocks.map((id) => (
                <li key={id} className="flex items-start gap-2 text-xs">
                  <CheckSquare className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span>{blockMap[id] ?? id}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Must-include checklist */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Required elements
            </p>
            <ul className="space-y-1.5">
              {snapshot.must_include.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="capitalize">{item.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Data quality notes */}
          {data_quality_notes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Data quality notes
              </p>
              <ul className="space-y-1.5">
                {data_quality_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Square className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Placeholder export button */}
          <button
            disabled
            className="w-full rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed"
          >
            Export snapshot (coming soon)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
