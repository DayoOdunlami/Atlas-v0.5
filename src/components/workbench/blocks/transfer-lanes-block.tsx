"use client";

import type {
  TransferLanesBlock as T,
  TransferLaneItem,
  TransferOutcome,
} from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { EvidenceStateBadge } from "../shared/evidence-state-badge";
import { cn } from "@/lib/utils";

const LANES: Array<{
  outcome: TransferOutcome;
  title: string;
  subtitle: string;
  ring: string;
  header: string;
}> = [
  {
    outcome: "travels-as-is",
    title: "Travels as-is",
    subtitle: "Credible transfer with current evidence",
    ring: "border-emerald-200 dark:border-emerald-900/60",
    header: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    outcome: "needs-reframing",
    title: "Needs reframing",
    subtitle: "Thematic fit — re-express for target context",
    ring: "border-amber-200 dark:border-amber-900/60",
    header: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  {
    outcome: "not-credible-here",
    title: "Not credible here",
    subtitle: "Do not claim without new evidence",
    ring: "border-rose-200 dark:border-rose-900/60",
    header: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  },
  {
    outcome: "evidence-needed",
    title: "Evidence needed",
    subtitle: "Gap — verification required before transfer",
    ring: "border-sky-200 dark:border-sky-900/60",
    header: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  },
];

function groupByLane(items: TransferLaneItem[]): Record<TransferOutcome, TransferLaneItem[]> {
  const grouped: Record<TransferOutcome, TransferLaneItem[]> = {
    "travels-as-is": [],
    "needs-reframing": [],
    "not-credible-here": [],
    "evidence-needed": [],
  };
  for (const item of items) {
    const key = item.transfer_outcome in grouped ? item.transfer_outcome : "evidence-needed";
    grouped[key].push(item);
  }
  return grouped;
}

function LaneCard({ item }: { item: TransferLaneItem }) {
  return (
    <div className="rounded-md border border-border/80 bg-background px-2.5 py-2 space-y-1.5">
      <p className="text-xs text-foreground leading-snug line-clamp-4">{item.claim_text}</p>
      {item.note && (
        <p className="text-[11px] text-muted-foreground leading-snug">{item.note}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <EvidenceStateBadge state={item.evidence_state} />
        <span className="text-[11px] text-muted-foreground capitalize">{item.provenance}</span>
      </div>
    </div>
  );
}

export function TransferLanesBlock({ block }: { block: T }) {
  const grouped = groupByLane(block.content);

  return (
    <BlockShell headline={block.headline} caption={block.caption}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {LANES.map((lane) => {
          const items = grouped[lane.outcome];
          return (
            <div
              key={lane.outcome}
              className={cn(
                "rounded-lg border bg-muted/10 flex flex-col min-h-[180px]",
                lane.ring,
              )}
            >
              <div className={cn("px-3 py-2 border-b border-border/60", lane.header)}>
                <p className="text-[11px] font-semibold uppercase tracking-wide">{lane.title}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{lane.subtitle}</p>
                <p className="text-[11px] font-medium mt-1">{items.length} item{items.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-1 py-2">None in this lane</p>
                ) : (
                  items.slice(0, 6).map((item) => <LaneCard key={item.id} item={item} />)
                )}
                {items.length > 6 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    +{items.length - 6} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BlockShell>
  );
}
