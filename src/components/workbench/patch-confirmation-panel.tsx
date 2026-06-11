"use client";

/**
 * PatchConfirmationPanel — Hard-confirm Sheet (M0.9 / M2.0)
 *
 * In the M2.0 act-don't-ask model this panel ONLY surfaces when the agent
 * proposes a patch that would overwrite or remove a PINNED block (analyst
 * work). All other patches auto-apply with a sonner undo toast.
 *
 * Surfaces:
 *   - Agent rationale (why)
 *   - Each destructive op (update_block / remove_block on a pinned block)
 *   - Confidence tier badge
 *   - Corpus citations backing the proposal
 *   - "Apply anyway" / "Keep my version" buttons
 *
 * Five Case / economic_analysis (M1.0):
 *   When the economic_analysis route produces a model_patch containing
 *   EconomicCaseBlock, this same panel handles it — no new component needed.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Sparkles, FileText } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import type { ModelPatchOp } from "@/lib/workbench/workbench-agent-contract";
import { tierClass, toConfidenceTier } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Op summary row
// ---------------------------------------------------------------------------

function OpRow({ op }: { op: ModelPatchOp }) {
  if (op.op === "add_block") {
    const block = op.block as { type?: string; headline?: string };
    return (
      <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
        <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 shrink-0">
          + add
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium">{block.headline ?? block.type ?? "New block"}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{block.type}</p>
        </div>
        {typeof op.at_index === "number" && (
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
            at position {op.at_index}
          </span>
        )}
      </div>
    );
  }

  if (op.op === "update_block") {
    const patchKeys = Object.keys(op.patch ?? {});
    return (
      <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
        <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
          ~ edit
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium font-mono">{op.block_id}</p>
          <p className="text-[11px] text-muted-foreground">
            Updating: {patchKeys.join(", ") || "fields"}
          </p>
        </div>
      </div>
    );
  }

  if (op.op === "remove_block") {
    return (
      <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
        <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 shrink-0">
          − remove
        </span>
        <p className="text-xs font-medium font-mono">{op.block_id}</p>
      </div>
    );
  }

  if (op.op === "update_spine") {
    const spineKeys = Object.keys(op.patch ?? {});
    return (
      <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
        <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
          ↻ spine
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium">Decision spine update</p>
          <p className="text-[11px] text-muted-foreground">
            Updating: {spineKeys.join(", ") || "fields"}
          </p>
        </div>
      </div>
    );
  }

  return null;
}


// ---------------------------------------------------------------------------
// PatchConfirmationPanel
// ---------------------------------------------------------------------------

export function PatchConfirmationPanel() {
  const { pendingPatch, applyPatch, dismissPatch } = useWorkbench();

  const isOpen = Boolean(pendingPatch);

  if (!pendingPatch) return null;

  const tierStyle = tierClass(toConfidenceTier(pendingPatch.confidence_tier));
  const opCount = pendingPatch.ops?.length ?? 0;
  const citations = pendingPatch.corpus_citations ?? [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) dismissPatch(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[60vh] flex flex-col rounded-t-xl"
      >
        <SheetHeader className="shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <SheetTitle className="text-sm">Confirm change to pinned block</SheetTitle>
            <Badge
              variant="outline"
              className={cn("text-[11px] ml-auto", tierStyle)}
            >
              {pendingPatch.confidence_tier}
            </Badge>
          </div>
          <SheetDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            <span className="block mb-1">
              <strong>The agent wants to edit a block you&apos;ve pinned.</strong> Other
              changes apply automatically — this one needs your confirmation.
            </span>
            {pendingPatch.rationale}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable ops + citations */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2">

          {/* Operations */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0 mb-1">
            {opCount} change{opCount !== 1 ? "s" : ""}
          </p>
          <div className="rounded-lg border border-border divide-y divide-border bg-muted/20 mb-4">
            {(pendingPatch.ops as ModelPatchOp[]).map((op, i) => (
              <div key={i} className="px-3">
                <OpRow op={op} />
              </div>
            ))}
          </div>

          {/* Citations */}
          {citations.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Supporting evidence ({citations.length})
              </p>
              <div className="space-y-1.5">
                {citations.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium line-clamp-1">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{c.organisation}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {Math.round((c.score ?? 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <SheetFooter className="shrink-0 flex-row gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={dismissPatch}
          >
            <XCircle className="w-3.5 h-3.5" />
            Keep my version
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => applyPatch(pendingPatch)}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Apply anyway
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
