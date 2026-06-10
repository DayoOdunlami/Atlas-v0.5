import type { ContextCardBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";

export function ContextCardBlock({ block }: { block: T }) {
  const { source, target } = block.content;

  return (
    <BlockShell headline={block.headline}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source */}
        <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source passport</p>
          <p className="text-sm font-medium leading-snug">{source.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{source.summary}</p>
        </div>

        {/* Target */}
        <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target project</p>
          <p className="text-sm font-medium leading-snug">{target.title}</p>
          {target.abstract && (
            <p className="text-xs text-muted-foreground leading-relaxed">{target.abstract}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
            {target.funder && <span><span className="font-medium">Funder:</span> {target.funder}</span>}
            {target.status && <span><span className="font-medium">Status:</span> {target.status}</span>}
            {target.funding_amount && (
              <span><span className="font-medium">Value:</span> £{target.funding_amount.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
