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

  // Defensive: home / minimal models may not have a snapshot
  const safeSnapshot = snapshot ?? {
    title: model.source_object?.title ?? "Snapshot",
    included_blocks: blocks.map((b) => b.id),
    must_include: [],
  };
  const safeNotes = data_quality_notes ?? [];

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
            {safeSnapshot.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Included blocks */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Included blocks
            </p>
            <ul className="space-y-1.5">
              {safeSnapshot.included_blocks.length === 0 ? (
                <li className="text-xs text-muted-foreground italic">
                  No blocks yet — add content to your workspace first.
                </li>
              ) : (
                safeSnapshot.included_blocks.map((id) => (
                  <li key={id} className="flex items-start gap-2 text-xs">
                    <CheckSquare className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                    <span>{blockMap[id] ?? id}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Must-include checklist */}
          {safeSnapshot.must_include.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Required elements
              </p>
              <ul className="space-y-1.5">
                {safeSnapshot.must_include.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span className="capitalize">{item.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data quality notes */}
          {safeNotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Data quality notes
              </p>
              <ul className="space-y-1.5">
                {safeNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Square className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export snapshot */}
          <button
            type="button"
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-xs font-medium hover:bg-muted/60 transition-colors"
            onClick={() => {
              const payload = {
                title: safeSnapshot.title,
                exported_at: new Date().toISOString(),
                canonical_question_id: model.canonical_question_id,
                blocks: blocks
                  .filter((b) => safeSnapshot.included_blocks.includes(b.id))
                  .map((b) => ({
                    id: b.id,
                    type: b.type,
                    headline: b.headline,
                    visual: b.visual,
                    role: b.role,
                  })),
                decision_spine: model.decision_spine,
                data_quality_notes: safeNotes,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `atlas-brief-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export brief (JSON)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
