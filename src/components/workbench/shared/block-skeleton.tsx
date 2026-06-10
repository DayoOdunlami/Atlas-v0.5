// BlockSkeleton variants — stream-ready loading placeholders.
//
// Each variant matches the visual footprint of its corresponding block so the
// layout does not shift when the real data arrives.
//
// Usage:
//   if (isLoading) return <BlockSkeletonRecommendation />;
//   return <RecommendationConfidenceBlock block={block} ... />;

import { Skeleton } from "@/components/ui/skeleton";
import { BlockShell } from "./block-shell";

// ---------------------------------------------------------------------------
// RecommendationConfidence skeleton
// ---------------------------------------------------------------------------

export function BlockSkeletonRecommendation() {
  return (
    <BlockShell headline="Recommendation & Confidence">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="flex flex-col gap-2 items-start md:items-end">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 rounded-md bg-muted/40 px-3 py-2">
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// DimensionGap skeleton
// ---------------------------------------------------------------------------

export function BlockSkeletonDimensionGap() {
  return (
    <BlockShell headline="Dimension Gaps">
      <div className="space-y-2">
        {[80, 65, 72, 55, 60].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className={`h-3.5`} style={{ width: `${w}%` }} />
            <Skeleton className="h-3.5 w-12 ml-auto shrink-0" />
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// MatchBench skeleton
// ---------------------------------------------------------------------------

export function BlockSkeletonMatchBench() {
  return (
    <BlockShell headline="Evidence Match Bench">
      <div className="space-y-0">
        {/* Table header */}
        <div className="flex gap-3 pb-2 border-b border-border">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20 ml-auto" />
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// ClaimLedger skeleton
// ---------------------------------------------------------------------------

export function BlockSkeletonClaimLedger() {
  return (
    <BlockShell headline="Claim Ledger">
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full shrink-0" />
            </div>
            <Skeleton className="h-3 w-4/5 ml-6" />
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

// ---------------------------------------------------------------------------
// Generic block skeleton (fallback for any other block type)
// ---------------------------------------------------------------------------

export function BlockSkeletonGeneric({ headline }: { headline?: string }) {
  return (
    <BlockShell headline={headline ?? "Loading…"}>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </BlockShell>
  );
}
