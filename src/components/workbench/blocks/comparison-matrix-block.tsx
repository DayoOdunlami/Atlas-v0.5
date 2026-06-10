import type { ComparisonMatrixBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

export function ComparisonMatrixBlock({ block }: { block: T }) {
  return (
    <BlockShell headline={block.headline}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Passport</TableHead>
            <TableHead className="text-xs">Target project</TableHead>
            <TableHead className="text-xs w-16">Score</TableHead>
            <TableHead className="text-xs w-28">Funder</TableHead>
            <TableHead className="text-xs w-20">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.content.map((row) => (
            <TableRow key={row.match_id}>
              <TableCell className="text-xs align-top">{row.passport}</TableCell>
              <TableCell className="text-xs align-top">{row.target}</TableCell>
              <TableCell className="text-xs align-top tabular-nums">{Math.round(row.score * 100)}%</TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">{row.funder}</TableCell>
              <TableCell className="text-xs align-top text-muted-foreground">{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockShell>
  );
}
