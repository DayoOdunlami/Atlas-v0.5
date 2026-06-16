import type { ActionPlanBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";

export function ActionPlanBlock({ block }: { block: T }) {
  const sorted = [...block.content].sort((a, b) => a.sequence - b.sequence);

  return (
    <BlockShell headline={block.headline} caption={block.caption}>
      <ol className="space-y-3">
        {sorted.map((item) => (
          <li key={item.sequence} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
              {item.sequence}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.action}</p>
              <div className="flex flex-wrap gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium">Gap: </span>{item.linked_gap}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium">Owner: </span>{item.owner}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </BlockShell>
  );
}
