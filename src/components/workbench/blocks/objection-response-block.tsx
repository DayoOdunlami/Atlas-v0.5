import type { ObjectionResponseBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { EvidenceStateBadge } from "../shared/evidence-state-badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

export function ObjectionResponseBlock({
  block,
  onInspect,
}: {
  block: T;
  onInspect: (key: string) => void;
}) {
  return (
    <BlockShell headline={block.headline}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-[32%]">Challenge</TableHead>
            <TableHead className="text-xs">Response</TableHead>
            <TableHead className="text-xs w-28">Evidence state</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.content.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-medium align-top">{row.challenge}</TableCell>
              <TableCell className="text-xs text-muted-foreground align-top">
                <p>{row.response}</p>
                {(row.linked_gap_ids?.length || row.linked_claim_ids?.length || row.linked_evidence_ids?.length) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.linked_gap_ids?.map((id) => (
                      <button
                        key={id}
                        onClick={() => onInspect(id)}
                        className="text-xs text-sky-600 hover:underline underline-offset-2"
                      >
                        {id}
                      </button>
                    ))}
                    {row.linked_claim_ids?.map((id) => (
                      <button
                        key={id}
                        onClick={() => onInspect(`claim.${id.replace(/^claim\./, "")}`)}
                        className="text-xs text-indigo-600 hover:underline underline-offset-2"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
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
