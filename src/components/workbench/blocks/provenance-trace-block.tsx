import type { ProvenanceTraceBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { EvidenceStateBadge } from "../shared/evidence-state-badge";

export function ProvenanceTraceBlock({
  block,
  onInspect,
}: {
  block: T;
  onInspect: (key: string) => void;
}) {
  const c = block.content;

  return (
    <BlockShell headline={block.headline}>
      {/* Path breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        {c.path.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className="rounded border border-border px-2 py-1 text-xs font-mono bg-muted/40">{step}</span>
            {i < c.path.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
          </span>
        ))}
      </div>

      {/* Evidence map items */}
      <div className="divide-y divide-border">
        {c.evidence_map_items.map((item) => (
          <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2">
              <EvidenceStateBadge state={item.evidence_state} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onInspect(item.id)}
                  className="text-xs font-medium text-left hover:underline underline-offset-2 line-clamp-2"
                >
                  {item.claim_text}
                </button>
                <p className="text-xs text-muted-foreground mt-0.5">{item.judgement}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </BlockShell>
  );
}
