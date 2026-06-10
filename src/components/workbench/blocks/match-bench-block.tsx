import type { MatchBenchBlock as T, EvidenceVerdict } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { EvidenceStateBadge } from "../shared/evidence-state-badge";
import { BlockSkeletonMatchBench } from "../shared/block-skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VERDICT_STYLE: Record<EvidenceVerdict, string> = {
  strong:      "bg-green-50  text-green-700  border-green-200",
  partial:     "bg-amber-50  text-amber-700  border-amber-200",
  relevant:    "bg-sky-50    text-sky-700    border-sky-200",
  contextual:  "bg-purple-50 text-purple-700 border-purple-200",
  judgement:   "bg-slate-50  text-slate-600  border-slate-200",
  "not mapped":"bg-red-50    text-red-500    border-red-200",
};

export function MatchBenchBlock({
  block,
  onInspect,
  loading = false,
}: {
  block: T;
  onInspect: (key: string) => void;
  loading?: boolean;
}) {
  if (loading) return <BlockSkeletonMatchBench />;

  return (
    <BlockShell headline={block.headline}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-[36%]">Claim</TableHead>
            <TableHead className="text-xs w-20">Verdict</TableHead>
            <TableHead className="text-xs">Judgement</TableHead>
            <TableHead className="text-xs w-28">Evidence state</TableHead>
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
              <TableCell className="align-top">
                <span
                  className={cn(
                    "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap",
                    VERDICT_STYLE[row.verdict],
                  )}
                >
                  {row.verdict}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground align-top">
                {row.judgement}
              </TableCell>
              <TableCell className="align-top">
                <EvidenceStateBadge state={row.evidence_state} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockShell>
  );
}
