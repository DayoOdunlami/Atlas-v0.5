"use client";

import type { ClaimLedgerBlock as T, EvidenceVerdict } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { EvidenceStateBadge } from "../shared/evidence-state-badge";
import { BlockSkeletonClaimLedger } from "../shared/block-skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const VERDICT_STYLE: Record<EvidenceVerdict, string> = {
  strong:      "bg-green-50  text-green-700  border-green-200",
  partial:     "bg-amber-50  text-amber-700  border-amber-200",
  relevant:    "bg-sky-50    text-sky-700    border-sky-200",
  contextual:  "bg-purple-50 text-purple-700 border-purple-200",
  judgement:   "bg-slate-50  text-slate-600  border-slate-200",
  "not mapped":"bg-red-50    text-red-500    border-red-200",
};

export function ClaimLedgerBlock({
  block,
  onInspect,
  loading = false,
}: {
  block: T;
  onInspect: (key: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(block.state !== "collapsed");

  if (loading) return <BlockSkeletonClaimLedger />;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold text-foreground leading-snug">{block.headline}</p>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {open ? "Collapse" : `Show ${block.content.length} claims`}
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[34%]">Claim</TableHead>
                  <TableHead className="text-xs w-20">Domain</TableHead>
                  <TableHead className="text-xs w-24">Evidence state</TableHead>
                  <TableHead className="text-xs w-24">Map verdict</TableHead>
                  <TableHead className="text-xs">Match note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {block.content.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs align-top">
                      <button
                        onClick={() => onInspect(row.id)}
                        className="text-left hover:underline underline-offset-2 line-clamp-3"
                      >
                        {row.claim_text}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground align-top capitalize">{row.domain}</TableCell>
                    <TableCell className="align-top">
                      <EvidenceStateBadge state={row.evidence_state} />
                    </TableCell>
                    <TableCell className="align-top">
                      {row.evidence_map_verdict && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap",
                            VERDICT_STYLE[row.evidence_map_verdict],
                          )}
                        >
                          {row.evidence_map_verdict}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground align-top">{row.match_note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
